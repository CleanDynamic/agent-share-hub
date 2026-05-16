import { supabase } from "@/integrations/supabase/client";

export interface BookmarkReblogResult {
  bookmarked: boolean;
  newCount: number;
}

export async function bookmarkReblog(args: {
  reblogId: string;
  bookmarkerId: string;
}): Promise<BookmarkReblogResult> {
  const { data: existing } = await (supabase.from("reblog_bookmarks") as any)
    .select("reblog_id")
    .eq("reblog_id", args.reblogId)
    .eq("bookmarker_id", args.bookmarkerId)
    .maybeSingle();

  if (existing) {
    const { error } = await (supabase.from("reblog_bookmarks") as any)
      .delete()
      .eq("reblog_id", args.reblogId)
      .eq("bookmarker_id", args.bookmarkerId);
    if (error) throw error;
  } else {
    const { error } = await (supabase.from("reblog_bookmarks") as any)
      .insert({ reblog_id: args.reblogId, bookmarker_id: args.bookmarkerId });
    if (error) throw error;
  }

  const { data: row } = await (supabase.from("reblogs") as any)
    .select("bookmark_count")
    .eq("id", args.reblogId)
    .maybeSingle();

  return {
    bookmarked: !existing,
    newCount: (row as any)?.bookmark_count ?? 0,
  };
}
