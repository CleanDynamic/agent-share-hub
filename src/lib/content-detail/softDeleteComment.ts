import { supabase } from "@/integrations/supabase/client";

/**
 * Soft-delete a comment. Calls the SECURITY DEFINER RPC which validates
 * the caller is either the comment author or the post owner.
 * The reply_count trigger handles parent decrement automatically.
 */
export async function softDeleteComment({ commentId }: { commentId: string }) {
  const { error } = await (supabase as any).rpc(
    "soft_delete_primitive_comment",
    { _comment_id: commentId },
  );
  if (error) throw error;
}
