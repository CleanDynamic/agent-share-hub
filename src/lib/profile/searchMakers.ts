// Makers whose name matches a search (RC-P07).
//
// The search box finds builds; this finds the few people a query might also
// mean — "maya" is more likely a maker than a build. Three at most, by
// username: a hint beside the results, never a second list to page through
// (hicks-law › Budgets, suggestion lists: at most 3). RC-P10 decides where the
// gallery shows them.
//
// THE READER'S TEXT IS MATCHED LITERALLY. `%`, `_` and `\` are LIKE's
// wildcards and its escape, so each is escaped before the text goes between
// the two `%`s. The whole pattern then goes into PostgREST's `or=(…)` filter as
// a double-quoted value, because a comma or a bracket in a query would
// otherwise end the value early; inside those quotes PostgREST takes one
// backslash per character, so every backslash is doubled once more. One thing
// cannot be escaped: PostgREST reads `*` in a LIKE pattern as `%`, so a `*` in
// the query matches anything there. That widens a result; it cannot reach
// anything the reader could not already read.
//
// THE QUERY NEVER LEAVES IN AN ERROR ⟦neoscale-error-monitoring › Privacy⟧: a
// failure names this function and the database's error code, nothing else.

import { supabase } from "@/integrations/supabase/client";

/** One maker a search matched: the four columns a name and an avatar need. */
export interface MakerHit {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/** A maker with a handle, so a profile address to link to. */
export type LinkableMaker = MakerHit & { username: string };

/** The makers a caller can link to: those with a handle (RC-P11). */
export function linkableMakers(makers: MakerHit[]): LinkableMaker[] {
  return makers.filter((maker): maker is LinkableMaker => Boolean(maker.username));
}

/** How many makers a search offers. */
const MAKER_HITS_MAX = 3;

/** `%`, `_` and `\` escaped, so ILIKE reads the reader's text literally. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** A value for PostgREST's `or=(…)`: double-quoted, `"` and `\` escaped inside. */
function filterValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (ch) => `\\${ch}`)}"`;
}

/**
 * Up to three makers whose username or display name contains `query`,
 * ordered by username. Pass a query through normaliseQuery first.
 */
export async function searchMakers(query: string): Promise<MakerHit[]> {
  const pattern = filterValue(`%${escapeLike(query)}%`);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .order("username")
    .limit(MAKER_HITS_MAX);

  if (error) {
    const code = "code" in error && error.code ? `code ${error.code}` : "no error code";
    throw new Error(`searchMakers failed: ${code}`);
  }

  return (data ?? []) as MakerHit[];
}
