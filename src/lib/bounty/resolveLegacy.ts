// The seam between a content_items id and a public.bounties id (NS-P50).
//
// WHAT THIS REPLACES. NS-P46 through NS-P48 moved every bounty satellite off
// content_items and onto bounties, and kept the legacy surfaces working by
// carrying the old id along on each row in a derived shim column —
// solutions.legacy_bounty_item_id and its five siblings. A read starting from a
// route param filtered that column and cost the one round trip it always did.
//
// NS-P50 drops those columns, because a column whose only job is to make a
// migration reversible is a column two writers can disagree about, and the
// mapping it duplicates is one indexed lookup away in bounties.legacy_item_id.
// Every read that used to name a shim column now resolves the id here first and
// filters bounty_id, which is the column the data actually lives on.
//
// THE COST, STATED HONESTLY. That is a second round trip on the first read of a
// legacy bounty page. The memo below removes it for every read after the first:
// the mapping is immutable — idx_bounties_legacy_item_unique keeps exactly one
// header per legacy item, and nothing rewrites legacy_item_id — so a resolved
// pair can be held for the life of the session without going stale.

import { supabase } from "@/integrations/supabase/client";
import { bountyLayerError } from "./types";

/** legacy content_items id -> public.bounties id, for this session. */
const forward = new Map<string, string>();
/** public.bounties id -> legacy content_items id, or null for a build bounty. */
const reverse = new Map<string, string | null>();

/** A legacy bounty page's read set is one bounty; a strip's is a screenful. */
const RESOLVE_LIMIT = 200;

/**
 * The `bounties` id for a legacy `content_items` bounty.
 *
 * Throws rather than returning null when there is no header. Every legacy
 * bounty has exactly one — NS-P45's backfill wrote one per content_items
 * bounty, and the two legacy authoring paths that have run since write their
 * own — so a bounty with none is a broken write, not an empty listing, and a
 * caller that got null back would render "no solutions yet" over the truth.
 */
export async function resolveBountyByLegacyItem(legacyItemId: string): Promise<string> {
  const memo = forward.get(legacyItemId);
  if (memo) return memo;

  const { data, error } = await supabase
    .from("bounties")
    .select("id")
    .eq("legacy_item_id", legacyItemId)
    .maybeSingle();
  if (error) throw bountyLayerError("resolveBountyByLegacyItem", error);

  const bountyId = (data as { id: string } | null)?.id;
  if (!bountyId) {
    throw new Error(
      "This bounty has no bounties record, so it cannot be read or written through",
    );
  }

  forward.set(legacyItemId, bountyId);
  reverse.set(bountyId, legacyItemId);
  return bountyId;
}

/**
 * The same mapping for a list of legacy ids, in one query.
 *
 * A legacy id with no header is absent from the returned map rather than
 * throwing: the callers are strips and search expansions assembling many
 * bounties at once, where one unbackfilled row should cost that row and not the
 * whole surface. The single-id form above is the one that speaks for a page.
 */
export async function resolveBountiesByLegacyItems(
  legacyItemIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted: string[] = [];
  for (const id of new Set(legacyItemIds)) {
    const memo = forward.get(id);
    if (memo) out.set(id, memo);
    else wanted.push(id);
  }
  if (wanted.length === 0) return out;

  const { data, error } = await supabase
    .from("bounties")
    .select("id, legacy_item_id")
    .in("legacy_item_id", wanted)
    .limit(RESOLVE_LIMIT);
  if (error) throw bountyLayerError("resolveBountiesByLegacyItems", error);

  for (const row of (data ?? []) as { id: string; legacy_item_id: string | null }[]) {
    if (!row.legacy_item_id) continue;
    out.set(row.legacy_item_id, row.id);
    forward.set(row.legacy_item_id, row.id);
    reverse.set(row.id, row.legacy_item_id);
  }
  return out;
}

/**
 * The mapping the other way round: `bounties` id -> the `content_items` id it
 * was backfilled from, or null for a bounty that lives on a build.
 *
 * Every caller of this is a surface that has to hand a reader a URL. A legacy
 * bounty is reachable at /content/:id and a bounties id there is a 404 on a
 * bounty that exists, so the id that goes in the href has to come back out of
 * the row it was stored against.
 */
export async function resolveLegacyItemsByBounty(
  bountyIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const wanted: string[] = [];
  for (const id of new Set(bountyIds)) {
    if (reverse.has(id)) out.set(id, reverse.get(id) ?? null);
    else wanted.push(id);
  }
  if (wanted.length === 0) return out;

  const { data, error } = await supabase
    .from("bounties")
    .select("id, legacy_item_id")
    .in("id", wanted)
    .limit(RESOLVE_LIMIT);
  if (error) throw bountyLayerError("resolveLegacyItemsByBounty", error);

  for (const row of (data ?? []) as { id: string; legacy_item_id: string | null }[]) {
    out.set(row.id, row.legacy_item_id);
    reverse.set(row.id, row.legacy_item_id);
    if (row.legacy_item_id) forward.set(row.legacy_item_id, row.id);
  }
  return out;
}

/**
 * The legacy `content_items` id one bounty was backfilled from, or null when it
 * lives on a build.
 *
 * The single-id form of resolveLegacyItemsByBounty, for the legacy data layer's
 * write paths: each of them holds a solution or a comment, which carries a
 * bounties id, and needs the content_items row to notify against or merge into.
 */
export async function legacyItemForBounty(bountyId: string): Promise<string | null> {
  if (reverse.has(bountyId)) return reverse.get(bountyId) ?? null;

  const { data, error } = await supabase
    .from("bounties")
    .select("id, legacy_item_id")
    .eq("id", bountyId)
    .maybeSingle();
  if (error) throw bountyLayerError("legacyItemForBounty", error);

  const legacyItemId = (data as { legacy_item_id: string | null } | null)?.legacy_item_id ?? null;
  reverse.set(bountyId, legacyItemId);
  if (legacyItemId) forward.set(legacyItemId, bountyId);
  return legacyItemId;
}

/** Drops the session memo. For tests, and for anything that reseeds the table. */
export function clearBountyResolutionCache(): void {
  forward.clear();
  reverse.clear();
}
