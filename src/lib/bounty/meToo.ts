// "I need this too" — the reader's one-click answer to an open bounty.
//
// WHY A NEW TABLE AND NOT THE ONE THAT EXISTS. public.bounty_me_too is a
// GENERATION-1 table keyed on content_items(id), and it is absent from the
// project NS-P44 measured — it answers PGRST205 there, which is why its one
// caller writes `.from("bounty_me_too" as any)` and why NS-P47 refused to
// repoint it. docs/retired-surfaces.md states the rule this follows: a
// generation-1 table is neither repointed nor given a foreign key. So the mark
// a bounty on a BUILD collects lands in its own table, keyed at bounties,
// beside the rest of the new path.
//
// WHY NOT JUST INCREMENT THE COUNTER. bounties.me_too_count is denormalised and
// the UPDATE policy on bounties admits the AUTHOR and nobody else — which is
// right, and which means the one person who must not be able to inflate this
// number is the only person who could write it. The mark row is the fact; the
// counter is maintained from it by trg_bounty_me_too_count, so the column the
// board and the feed already read stays true without any client touching it.

import { supabase } from "@/integrations/supabase/client";
import { bountyLayerError } from "./types";

/** The table the mark lands in. Named once; nothing else spells it out. */
const MARKS_TABLE = "bounty_me_too_marks";

/** One mark: this reader, this bounty. The whole row, minus its timestamp. */
interface MeTooRow {
  bounty_id: string;
  user_id: string;
}

/**
 * The three operations this module performs, described by hand.
 *
 * The marks table is newer than src/integrations/supabase/types.ts, which is
 * generated from the live database — until that file is regenerated the
 * client's table map does not know the name, so the calls go through ONE cast
 * declared here rather than an `as any` at each call site. The same shape
 * src/lib/feed/getBuildFeed.ts uses for a function the generated types have not
 * caught up with. If the two ever disagree, the migration is right.
 */
interface MarksTable {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      in: (
        column: string,
        values: string[],
      ) => {
        limit: (
          count: number,
        ) => PromiseLike<{ data: MeTooRow[] | null; error: unknown }>;
      };
    };
  };
  insert: (row: MeTooRow) => PromiseLike<{ error: unknown }>;
  delete: () => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => PromiseLike<{ error: unknown }>;
    };
  };
}

function marks(): MarksTable {
  return (
    supabase as unknown as { from: (table: string) => MarksTable }
  ).from(MARKS_TABLE);
}

/** A build with more open asks than this has a data problem, not a page. */
const MARKS_LIMIT = 200;

/** Which of these bounties this reader has already marked. ONE query. */
export async function myMeToo(
  bountyIds: readonly string[],
  viewerId: string,
): Promise<Set<string>> {
  const wanted = [...new Set(bountyIds)];
  const out = new Set<string>();
  if (wanted.length === 0) return out;

  const { data, error } = await marks()
    .select("bounty_id, user_id")
    .eq("user_id", viewerId)
    .in("bounty_id", wanted)
    .limit(MARKS_LIMIT);

  // BEST EFFORT, and deliberately so: the marks table arrives with a migration
  // that may not have been applied yet, and a page of gap panels must not fail
  // to render because the thing that says "me too" is not there. An unmarked
  // button is a smaller wrong answer than no panel.
  if (error) {
    console.warn("[myMeToo] marks unreadable", error);
    return out;
  }

  for (const row of data ?? []) out.add(row.bounty_id);
  return out;
}

/**
 * Add or remove this reader's mark, and read the counter back.
 *
 * The count is READ BACK rather than adjusted here for the reason
 * voteOnSolution reads its own: the number is maintained by a trigger, so what
 * the database holds after the write is the truth and any arithmetic in the
 * browser is a guess that drifts the moment two people click at once.
 */
export async function toggleMeToo({
  bountyId,
  userId,
}: {
  bountyId: string;
  userId: string;
}): Promise<{ marked: boolean; count: number }> {
  const held = await myMeToo([bountyId], userId);
  const marking = !held.has(bountyId);

  const table = marks();
  const { error } = marking
    ? await table.insert({ bounty_id: bountyId, user_id: userId })
    : await table.delete().eq("bounty_id", bountyId).eq("user_id", userId);
  if (error) throw bountyLayerError("toggleMeToo", error);

  const { data, error: readError } = await supabase
    .from("bounties")
    .select("me_too_count")
    .eq("id", bountyId)
    .maybeSingle();
  if (readError) throw bountyLayerError("toggleMeToo (count)", readError);

  return {
    marked: marking,
    count: (data as { me_too_count: number } | null)?.me_too_count ?? 0,
  };
}
