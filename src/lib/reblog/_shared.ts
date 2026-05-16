import { supabase } from "@/integrations/supabase/client";
import type { Reblog, RebloggerProfile } from "./types";

const PROFILE_COLS = "id, username, display_name, avatar_url";

export async function attachRebloggers(rows: Reblog[]): Promise<Reblog[]> {
  if (rows.length === 0) return rows;
  const ids = Array.from(new Set(rows.map((r) => r.reblogger_id)));
  const { data } = await (supabase.from("profiles") as any)
    .select(PROFILE_COLS)
    .in("id", ids);
  const map = new Map<string, RebloggerProfile>();
  for (const p of (data ?? []) as RebloggerProfile[]) map.set(p.id, p);
  return rows.map((r) => ({ ...r, reblogger: map.get(r.reblogger_id) ?? null }));
}
