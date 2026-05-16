import { supabase } from "@/integrations/supabase/client";
import type { Reblog } from "./types";
import { attachRebloggers } from "./_shared";

export interface GetReblogsOfPostInput {
  postId: string;
  limit?: number;
  offset?: number;
  viewerId?: string | null;
}

export async function getReblogsOfPost(
  input: GetReblogsOfPostInput
): Promise<{ reblogs: Reblog[]; total: number }> {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  const { data, error, count } = await (supabase.from("reblogs") as any)
    .select("*", { count: "exact" })
    .eq("original_post_id", input.postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  const rows = await attachRebloggers((data ?? []) as Reblog[]);
  return { reblogs: rows, total: count ?? rows.length };
}
