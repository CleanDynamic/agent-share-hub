// The me-too count for a LEGACY bounty, read from the counter that still moves.
//
// WHAT CHANGED UNDER THESE CALLERS. Until NS-P54 a me-too write maintained two
// numbers: `content_items.bounty_me_too_count` and `bounties.me_too_count`,
// recomputed from the same COUNT(*) by public.update_bounty_me_too_count() so
// they could not drift. NS-P47 made that a dual-write ON PURPOSE, because the
// legacy surfaces read the content_items one. NS-P54's migration
// (20260830140000_single_me_too_counter.sql) drops the content_items leg: that
// column keeps its last value and stops moving. This module is the other half
// of that change — the surfaces that read the frozen column now read the one
// that is still maintained.
//
// THE SEAM IS resolveLegacy.ts, as it has been since NS-P50: a legacy surface
// holds a `content_items` id, the data lives on `public.bounties`, and
// `bounties.legacy_item_id` is the mapping. The BATCH form is used here rather
// than the single-id `resolveBountyByLegacyItem`, and deliberately:
// that one THROWS when a legacy bounty has no header, which is right for a page
// that has nothing else to render and wrong for a feed card, where one
// unbackfilled row should cost that row's counter and not the card.
//
// WHY IT COALESCES. BountyCard renders once per bounty in a feed, and
// docs' cause #2 for this application's load time is the home feed already
// firing about twenty round trips before content paints. A naive hook would add
// one more per card. Every id asked for within the same microtask is answered by
// ONE resolve and ONE count query, so a screenful of bounty cards costs the same
// two round trips as a single one.
//
// AND IT NEVER BLOCKS PAINT. Each caller passes the frozen `content_items`
// value as its fallback and renders it immediately; the live count replaces it
// when it arrives, and if it never arrives — no header, an unapplied migration,
// an error — the frozen number stays. That is the same best-effort posture
// src/lib/bounty/meToo.ts takes for the new path's marks, for the same reason:
// a counter is not worth failing a surface over.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveBountiesByLegacyItems } from "./resolveLegacy";

/** A screenful of bounty cards is a handful; anything past this is a bug. */
const COUNT_LIMIT = 200;

/** Ids waiting for the next flush, and the callers waiting on each. */
let pending = new Set<string>();
let flush: Promise<Map<string, number>> | null = null;

/**
 * The live me-too counts for a set of legacy `content_items` bounty ids.
 *
 * A legacy id with no `bounties` header is ABSENT from the returned map rather
 * than present as zero: absent means "no answer", which the caller renders as
 * the frozen value, while zero would mean "nobody needs this" and overwrite a
 * true number with a false one.
 *
 * Best effort. Any error resolves to an empty map and is warned rather than
 * thrown — see the module comment.
 */
export async function legacyMeTooCounts(
  legacyItemIds: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const wanted = [...new Set(legacyItemIds)].filter(Boolean);
  if (wanted.length === 0) return out;

  try {
    // The mapping, memoised for the session by resolveLegacy: immutable, since
    // idx_bounties_legacy_item_unique keeps one header per legacy item and
    // nothing rewrites legacy_item_id.
    const byLegacy = await resolveBountiesByLegacyItems(wanted);
    if (byLegacy.size === 0) return out;

    const bountyIds = [...byLegacy.values()];
    // Named columns, and a limit. The COUNT itself is maintained by trigger, so
    // this is a lookup rather than an aggregate.
    const { data, error } = await supabase
      .from("bounties")
      .select("id, me_too_count")
      .in("id", bountyIds)
      .limit(COUNT_LIMIT);
    if (error) throw error;

    const byBounty = new Map<string, number>();
    for (const row of (data ?? []) as { id: string; me_too_count: number | null }[]) {
      byBounty.set(row.id, row.me_too_count ?? 0);
    }
    for (const [legacyId, bountyId] of byLegacy) {
      const n = byBounty.get(bountyId);
      if (n !== undefined) out.set(legacyId, n);
    }
    return out;
  } catch (e) {
    // Not thrown: the caller has a frozen number to fall back on, and a bounty
    // header table that is not there yet (PGRST205 on the project this
    // repository points at) must not empty a feed card's stats row.
    console.warn("[legacyMeTooCounts] unreadable", e);
    return out;
  }
}

/**
 * Every id asked for before the next microtask boundary, answered together.
 *
 * The flush promise is shared by every caller in the window, so a feed of N
 * bounty cards mounting in one commit issues one resolve and one count query
 * between them rather than N of each.
 */
function loadCoalesced(legacyItemId: string): Promise<Map<string, number>> {
  pending.add(legacyItemId);
  if (!flush) {
    flush = Promise.resolve().then(() => {
      const batch = [...pending];
      pending = new Set();
      flush = null;
      return legacyMeTooCounts(batch);
    });
  }
  return flush;
}

/**
 * One legacy bounty's me-too count, for a component that holds the row.
 *
 * `frozen` is `content_items.bounty_me_too_count` off that row — the value the
 * column stopped at — and is what renders until the live count arrives, and
 * what keeps rendering if it never does.
 */
export function useLegacyMeTooCount(
  legacyItemId: string | null | undefined,
  frozen: number,
): number {
  const [live, setLive] = useState<number | null>(null);

  useEffect(() => {
    if (!legacyItemId) return;
    let cancelled = false;
    loadCoalesced(legacyItemId).then((counts) => {
      if (cancelled) return;
      const n = counts.get(legacyItemId);
      if (n !== undefined) setLive(n);
    });
    return () => {
      cancelled = true;
    };
  }, [legacyItemId]);

  return live ?? frozen;
}

/**
 * The same thing for a LIST that has to be ordered by the count rather than
 * just display it — the me-too sort on the legacy discover page.
 *
 * Returns an empty map until the counts arrive, so the caller's comparator must
 * fall back to the frozen `content_items` value per row. That is why this hands
 * back a map rather than a sorted list: a sort that silently treated "not
 * loaded yet" as zero would reorder the page under the reader's cursor, and one
 * that waited would leave the tab blank on a counter.
 *
 * The effect is keyed on the ids themselves, not on the array's identity, so a
 * caller may pass a freshly-built array every render without looping.
 */
export function useLegacyMeTooCounts(
  legacyItemIds: readonly string[],
): Map<string, number> {
  const key = [...new Set(legacyItemIds)].filter(Boolean).sort().join(",");
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    legacyMeTooCounts(key.split(",")).then((loaded) => {
      if (cancelled || loaded.size === 0) return;
      setCounts(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return counts;
}

/** Drops the in-flight batch. For tests. */
export function clearLegacyMeTooBatch(): void {
  pending = new Set();
  flush = null;
}
