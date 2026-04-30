import { supabase } from "@/integrations/supabase/client";

/**
 * Creates (or returns) a 'bounty' thread between the current user and
 * the bounty author, with the bounty pinned. Idempotent: if a bounty
 * thread already exists between these two users for this bounty, return
 * its id.
 */
export async function createBountyThread(
  bountyId: string,
  otherUserId: string
): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error("Not authenticated");
  if (me === otherUserId) throw new Error("Cannot start a thread with yourself");

  // Look for an existing bounty thread for this bounty between these two
  const { data: existing } = await supabase
    .from("dm_threads")
    .select("id, participant_a, participant_b")
    .eq("type", "bounty")
    .eq("pinned_content_id", bountyId)
    .or(
      `and(participant_a.eq.${me},participant_b.eq.${otherUserId}),and(participant_a.eq.${otherUserId},participant_b.eq.${me})`
    )
    .maybeSingle();
  if ((existing as any)?.id) return (existing as any).id as string;

  const insertPayload: any = {
    type: "bounty",
    title: null,
    created_by: me,
    pinned_content_id: bountyId,
    pinned_content_type: "bounty",
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

  // Add both as members (admin = creator)
  await supabase.from("dm_thread_members").insert([
    { thread_id: threadId, user_id: me, is_admin: true } as any,
    { thread_id: threadId, user_id: otherUserId, is_admin: false } as any,
  ]);

  return threadId;
}
