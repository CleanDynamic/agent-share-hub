import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a 'blueprint' group thread pinned to the given blueprint, with
 * the supplied set of members (current user is automatically included as
 * admin). Returns the new thread id.
 */
export async function createBlueprintGroup(
  blueprintId: string,
  memberIds: string[],
  title: string
): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error("Not authenticated");

  const allMembers = Array.from(new Set([me, ...memberIds.filter(Boolean)]));
  if (allMembers.length < 2) throw new Error("Need at least 2 members");

  const insertPayload: any = {
    type: "blueprint",
    title: title.trim() || null,
    created_by: me,
    pinned_content_id: blueprintId,
    pinned_content_type: "blueprint",
    // Keep legacy participant columns populated for backward compat with
    // the existing presence/unread queries (use first two members).
    participant_a: allMembers[0],
    participant_b: allMembers[1],
    request_status: "accepted",
  };

  const { data, error } = await supabase
    .from("dm_threads")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error) throw error;
  const threadId = (data as any).id as string;

  const memberRows = allMembers.map((uid) => ({
    thread_id: threadId,
    user_id: uid,
    is_admin: uid === me,
  }));
  await supabase.from("dm_thread_members").insert(memberRows as any);

  return threadId;
}
