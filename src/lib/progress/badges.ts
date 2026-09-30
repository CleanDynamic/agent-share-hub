// RC-P27 — which of the ten badges the reader holds, and the order the page draws them in.
//
// A BADGE IS HELD WHEN ITS ROW EXISTS. user_badges is written by the database
// alone (rc_award_badge, 20261001260000); a row in any state counts, because
// the state that held a badge back, pending_reveal, belonged to the depth
// reveal, and RC-P27 unmounted that. The read asks for the ten slugs only, so
// a key left from the old product is never fetched.
//
// EARNED FIRST, THEN NOT YET, each in the catalogue's own order
// (XP-DESIGN.md › Badges), so a newly earned badge moves up a row and nothing
// else moves.

import { supabase } from "@/integrations/supabase/client";
import { progressFailure } from "./errors";

/** The slugs among `slugs` that the reader holds. */
export async function getMyBadgeKeys(userId: string, slugs: readonly string[]): Promise<Set<string>> {
  const response = await supabase
    .from("user_badges")
    .select("badge_key")
    .eq("user_id", userId)
    .in("badge_key", [...slugs])
    .limit(Math.max(slugs.length, 1));
  if (response.error) throw progressFailure("getMyBadgeKeys", userId, response);
  return new Set((response.data ?? []).map((row) => row.badge_key));
}

/** The catalogue with each badge marked earned or not: earned first, then the rest, order kept. */
export function badgesInOrder<T extends { id: string }>(
  catalogue: readonly T[],
  held: ReadonlySet<string>,
): Array<{ badge: T; earned: boolean }> {
  const earned = catalogue.filter((badge) => held.has(badge.id)).map((badge) => ({ badge, earned: true }));
  const notYet = catalogue.filter((badge) => !held.has(badge.id)).map((badge) => ({ badge, earned: false }));
  return [...earned, ...notYet];
}
