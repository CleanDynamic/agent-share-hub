// Engagement for a list of builds, in at most three requests (RC-P16).
//
// A grid of cards asks three questions about the builds it shows: how many
// likes and comments each has, which of them the reader likes, and which the
// reader has saved. Each question is ONE request for the whole list
// ⟦neoscale-performance⟧ — never one per card — and a signed-out reader is
// asked only the first, because the other two have no answer for nobody.
//
//   signed in    getEngagementCounts, getMyLikes and getMySaves, together
//   signed out   getEngagementCounts
//
// Every list that renders GalleryCards (the Gallery, Home's feed, where next)
// and the build page call this ONCE for the ids they render and pass each
// card its share.
//
// THE CACHE IS WHERE A LIKE LANDS. The row answers a press at once and asks the
// database after; when the database agrees, updateEngagement writes the same
// change into every cached list holding that build, so the card on the Gallery
// and the header on its page cannot disagree about whether the reader likes it.
//
// A LONG LIST IS ASKED ABOUT IN SLICES OF ENGAGEMENT_SLICE ids, so an
// infinite feed's request stays a bounded URL: the first slice is the one a
// page of cards fits in, and a new page of the feed asks about its own slice
// only. Every list the product renders today fits in one slice.

import { keepPreviousData, useQueries, type QueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getEngagementCounts, getMyLikes, getMySaves, type EngagementCountMap } from "@/lib/social";

/** The most ids one request carries. A page of the gallery is 24, of the feed 20. */
export const ENGAGEMENT_SLICE = 60;

/** Engagement is not a ticker: nothing is re-asked for half a minute. */
const ENGAGEMENT_STALE_MS = 30_000;

/** What one slice's query holds. Plain arrays, so the cache can compare them. */
export interface EngagementSlice {
  ids: string[];
  counts: EngagementCountMap;
  liked: string[];
  saved: string[];
}

export interface Engagement {
  /** Like and comment counts by build id; a build not yet answered is absent. */
  counts: EngagementCountMap;
  /** The builds the reader likes. Always empty when signed out. */
  liked: ReadonlySet<string>;
  /** The builds the reader has saved. Always empty when signed out. */
  saved: ReadonlySet<string>;
  /** True once every slice has answered at least once. */
  loaded: boolean;
}

/** The root of every engagement query, for updateEngagement to find them all. */
export const ENGAGEMENT_KEY = "engagement";

async function fetchSlice(ids: string[], signedIn: boolean): Promise<EngagementSlice> {
  const [counts, liked, saved] = await Promise.all([
    getEngagementCounts(ids),
    signedIn ? getMyLikes(ids) : Promise.resolve(new Set<string>()),
    signedIn ? getMySaves(ids) : Promise.resolve(new Set<string>()),
  ]);
  return { ids, counts, liked: [...liked], saved: [...saved] };
}

function slices(ids: readonly string[]): string[][] {
  const out: string[][] = [];
  for (let start = 0; start < ids.length; start += ENGAGEMENT_SLICE) {
    out.push(ids.slice(start, start + ENGAGEMENT_SLICE));
  }
  return out;
}

/** Like and comment counts, and the reader's likes and saves, for these builds. */
export function useEngagement(buildIds: readonly string[]): Engagement {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const key = buildIds.join(",");
  const ids = useMemo(
    () => [...new Set(key.split(",").filter((id) => id.length > 0))],
    [key],
  );

  return useQueries({
    queries: slices(ids).map((slice) => ({
      queryKey: [ENGAGEMENT_KEY, userId, slice.join(",")],
      queryFn: () => fetchSlice(slice, userId !== null),
      staleTime: ENGAGEMENT_STALE_MS,
      refetchOnWindowFocus: false,
      // A slice that grows keeps showing what it knew while it asks again.
      placeholderData: keepPreviousData,
    })),
    combine,
  });
}

/**
 * The slices, as one answer. Module-level so its reference is stable, which is
 * what lets useQueries re-run it only when a slice's result changes.
 */
function combine(results: UseQueryResult<EngagementSlice>[]): Engagement {
  const counts: EngagementCountMap = {};
  const liked = new Set<string>();
  const saved = new Set<string>();
  for (const result of results) {
    const data = result.data;
    if (!data) continue;
    Object.assign(counts, data.counts);
    for (const id of data.liked) liked.add(id);
    for (const id of data.saved) saved.add(id);
  }
  return { counts, liked, saved, loaded: results.every((result) => result.data !== undefined) };
}

/** One build's share of a list's engagement, as a card or a header takes it. */
export function engagementFor(engagement: Engagement, buildId: string) {
  return {
    counts: engagement.counts[buildId] ?? null,
    liked: engagement.liked.has(buildId),
    saved: engagement.saved.has(buildId),
  };
}

export interface EngagementChange {
  liked?: boolean;
  saved?: boolean;
  /** Added to the like count. */
  likes?: number;
  /** Added to the comment count. */
  comments?: number;
}

/**
 * Write a change the database has accepted into every cached list that holds
 * this build, so every card and header showing it agrees.
 */
export function updateEngagement(queryClient: QueryClient, buildId: string, change: EngagementChange): void {
  queryClient.setQueriesData<EngagementSlice>({ queryKey: [ENGAGEMENT_KEY] }, (slice) => {
    if (!slice || !slice.ids.includes(buildId)) return slice;
    const counts = { ...slice.counts };
    const current = counts[buildId];
    if (current && (change.likes || change.comments)) {
      counts[buildId] = {
        likes: Math.max(0, current.likes + (change.likes ?? 0)),
        comments: Math.max(0, current.comments + (change.comments ?? 0)),
      };
    }
    const toggle = (list: string[], on: boolean | undefined) =>
      on === undefined ? list : on ? [...new Set([...list, buildId])] : list.filter((id) => id !== buildId);
    return {
      ...slice,
      counts,
      liked: toggle(slice.liked, change.liked),
      saved: toggle(slice.saved, change.saved),
    };
  });
}
