import { supabase } from "@/integrations/supabase/client";

/**
 * Records that the current user has clicked through to view the
 * shared content in this message. Idempotent — duplicate inserts
 * for the same (message_id, viewer_id) are silently ignored.
 */
export async function markContentViewed(messageId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const viewerId = auth.user?.id;
  if (!viewerId) return;

  // Best-effort idempotency: check first then insert. (No unique
  // constraint exists on the table yet, so we can't rely on
  // ON CONFLICT — emulate it with a quick existence check.)
  const { data: existing } = await supabase
    .from("content_share_views")
    .select("id")
    .eq("message_id", messageId)
    .eq("viewer_id", viewerId)
    .maybeSingle();
  if (existing) return;

  await supabase.from("content_share_views").insert({
    message_id: messageId,
    viewer_id: viewerId,
  } as any);
}
