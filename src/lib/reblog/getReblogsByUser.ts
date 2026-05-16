import { supabase } from "@/integrations/supabase/client";
import type { Reblog } from "./types";
import { attachRebloggers } from "./_shared";

export interface GetReblogsByUserInput {
  userId: string;
  limit?: number;
  offset?: number;
  viewerId?: string | null;
}

export async function getReblogsByUser(
  input: GetReblogsByUserInput
): Promise<{ reblogs: Reblog[]; total: number }> {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  const { data, error, count } = await (supabase.from("reblogs") as any)
    .select("*", { count: "exact" })
    .eq("reblogger_id", input.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  const rows = await attachRebloggers((data ?? []) as Reblog[]);
  return { reblogs: rows, total: count ?? rows.length };
}
