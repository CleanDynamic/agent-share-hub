import { supabase } from "@/integrations/supabase/client";

/**
 * Returns an existing direct thread between the current user and otherUserId,
 * or creates one. Idempotent.
 */
export async function createDirectThread(otherUserId: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error("Not authenticated");
  if (me === otherUserId) throw new Error("Cannot start a thread with yourself");

  const { data: existing } = await supabase
    .from("dm_threads")
    .select("id, participant_a, participant_b, type")
    .eq("type", "direct")
    .or(
      `and(participant_a.eq.${me},participant_b.eq.${otherUserId}),and(participant_a.eq.${otherUserId},participant_b.eq.${me})`
    )
    .maybeSingle();
  if ((existing as any)?.id) return (existing as any).id as string;

  const insertPayload: any = {
    type: "direct",
    title: null,
    created_by: me,
    participant_a: me,
    participant_b: otherUserId,
    request_status: "accepted",
  };

  const { data, error } = await supabase
    .from("dm_threads")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error) throw error;
  const threadId = (data as any).id as string;

  await supabase.from("dm_thread_members").insert([
    { thread_id: threadId, user_id: me, is_admin: true } as any,
    { thread_id: threadId, user_id: otherUserId, is_admin: false } as any,
  ]);

  return threadId;
}
