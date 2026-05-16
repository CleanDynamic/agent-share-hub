import { supabase } from "@/integrations/supabase/client";

export interface LikeReblogResult {
  liked: boolean;
  newCount: number;
}

export async function likeReblog(args: {
  reblogId: string;
  likerId: string;
}): Promise<LikeReblogResult> {
  const { data: existing } = await (supabase.from("reblog_likes") as any)
    .select("reblog_id")
    .eq("reblog_id", args.reblogId)
    .eq("liker_id", args.likerId)
    .maybeSingle();

  if (existing) {
    const { error } = await (supabase.from("reblog_likes") as any)
      .delete()
      .eq("reblog_id", args.reblogId)
      .eq("liker_id", args.likerId);
    if (error) throw error;
  } else {
    const { error } = await (supabase.from("reblog_likes") as any)
      .insert({ reblog_id: args.reblogId, liker_id: args.likerId });
    if (error) throw error;
  }

  const { data: row } = await (supabase.from("reblogs") as any)
    .select("like_count")
    .eq("id", args.reblogId)
    .maybeSingle();

  return {
    liked: !existing,
    newCount: (row as any)?.like_count ?? 0,
  };
}
