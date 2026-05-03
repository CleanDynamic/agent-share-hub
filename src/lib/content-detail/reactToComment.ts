import { supabase } from "@/integrations/supabase/client";

/**
 * Toggle a reaction on a primitive comment.
 * If the (comment, reactor, reaction) triple exists → delete; else insert.
 * Returns the new active state and total count of that reaction.
 */
export async function reactToComment({
  commentId,
  reactorId,
  reaction,
}: {
  commentId: string;
  reactorId: string;
  reaction: string;
}): Promise<{ active: boolean; count: number }> {
  const { data: existing } = await (supabase as any)
    .from("primitive_comment_reactions")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("reactor_id", reactorId)
    .eq("reaction", reaction)
    .maybeSingle();

  let active: boolean;
  if (existing) {
    const { error } = await (supabase as any)
      .from("primitive_comment_reactions")
      .delete()
      .eq("comment_id", commentId)
      .eq("reactor_id", reactorId)
      .eq("reaction", reaction);
    if (error) throw error;
    active = false;
  } else {
    const { error } = await (supabase as any)
      .from("primitive_comment_reactions")
      .insert({ comment_id: commentId, reactor_id: reactorId, reaction });
    if (error) throw error;
    active = true;
  }

  const { count } = await (supabase as any)
    .from("primitive_comment_reactions")
    .select("comment_id", { count: "exact", head: true })
    .eq("comment_id", commentId)
    .eq("reaction", reaction);

  return { active, count: count ?? 0 };
}
