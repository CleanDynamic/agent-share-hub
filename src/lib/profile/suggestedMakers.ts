// The product's one suggestion list (RC-P11) ⟦hicks-law › Budgets: suggestion
// lists: 1⟧.
//
// Shown only on Home's Following tab when the reader follows nobody: at most
// three makers, the creators of the three published builds with the most
// reproductions in the last ninety days. EVIDENCE-ORDERED, not tuned: the
// order is the same one the gallery states, reproductions first, so the
// people suggested are the people whose work other people ran.
//
// ONE REQUEST: the three builds with their creators embedded, named columns,
// .limit(3). Two of the three may share a creator, so the list can be shorter
// than three; it is never padded.

import { supabase } from "@/integrations/supabase/client";
import type { MakerHit } from "./searchMakers";

/** How far back a build counts. */
const WINDOW_DAYS = 90;

/** At most this many makers. */
const SUGGESTIONS_MAX = 3;

const DAY_MS = 86_400_000;

interface SuggestionRow {
  creator: MakerHit | MakerHit[] | null;
}

export async function listSuggestedMakers(): Promise<MakerHit[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString();

  const { data, error } = await supabase
    .from("builds")
    .select("id, creator:profiles!builds_creator_id_fkey(id, username, display_name, avatar_url)")
    .in("status", ["published", "gallery"])
    .gte("published_at", since)
    .order("reproduction_count", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(SUGGESTIONS_MAX);

  if (error) {
    const code = "code" in error && error.code ? `code ${error.code}` : "no error code";
    throw new Error(`listSuggestedMakers failed: ${code}`);
  }

  const seen = new Set<string>();
  const makers: MakerHit[] = [];
  for (const row of (data ?? []) as unknown as SuggestionRow[]) {
    const maker = Array.isArray(row.creator) ? row.creator[0] : row.creator;
    if (!maker || seen.has(maker.id)) continue;
    seen.add(maker.id);
    makers.push(maker);
  }
  return makers;
}
