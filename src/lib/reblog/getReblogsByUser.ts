import { supabase } from "@/integrations/supabase/client";
import type { Reblog, RebloggerProfile } from "./types";

const PROFILE_COLS = "id, username, display_name, avatar_url";

async function attachRebloggers(rows: Reblog[]): Promise<Reblog[]> {
  if (rows.length === 0) return rows;
  const ids = Array.from(new Set(rows.map((r) => r.reblogger_id)));
  const { data } = await (supabase.from("profiles") as any)
    .select(PROFILE_COLS)
    .in("id", ids);
  const map = new Map<string, RebloggerProfile>();
  for (const p of (data ?? []) as RebloggerProfile[]) map.set(p.id, p);
  return rows.map((r) => ({ ...r, reblogger: map.get(r.reblogger_id) ?? null }));
}

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
  const rows = await attachRebliers(data as Reblog[]);
  return { reblogs: rows, total: count ?? rows.length };
}

// Tiny typo guard alias (kept for the rare case the bundler reuses the
// previous identifier). Prefer attachRebloggers.
const attachRebliers = attachRebloggers;
