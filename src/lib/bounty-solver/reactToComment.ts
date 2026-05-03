import { supabase } from "@/integrations/supabase/client";

export async function reactToComment(args: {
  commentId: string;
  reactorId: string;
  reaction: string;
}): Promise<{ active: boolean; count: number }> {
  const { commentId, reactorId, reaction } = args;

  const { data: existing } = await (supabase as any)
    .from("bounty_comment_reactions")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("reactor_id", reactorId)
    .eq("reaction", reaction)
    .maybeSingle();

  let active: boolean;
  if (existing) {
    const { error } = await (supabase as any)
      .from("bounty_comment_reactions")
      .delete()
      .eq("comment_id", commentId)
      .eq("reactor_id", reactorId)
      .eq("reaction", reaction);
    if (error) throw error;
    active = false;
  } else {
    const { error } = await (supabase as any)
      .from("bounty_comment_reactions")
      .insert({ comment_id: commentId, reactor_id: reactorId, reaction } as any);
    if (error) throw error;
    active = true;
  }

  const { count } = await (supabase as any)
    .from("bounty_comment_reactions")
    .select("comment_id", { count: "exact", head: true })
    .eq("comment_id", commentId)
    .eq("reaction", reaction);
  return { active, count: count ?? 0 };
}
