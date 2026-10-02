/* UI-P27 — `/` in the site frame: the container.

   Loads Home's data through `src/lib/` functions only, maps it to `HomeView`'s
   props and renders it. No Supabase call in this file. Every panel loads on its
   own, so a slow streak never holds the visitors' book back, and a panel that
   fails says so in its own place.

   THE FEED SCOPE IS THE FEED'S OWN. `getBuildFeed` takes `onlyFollowing`, and
   Following is that argument; the choice rides `?tab=following` as the old Home
   did, so a link to either survives. A signed-out reader who asks for Following
   is sent to sign in and back. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { MEDIA_WIDTH } from "@/components/build/MediaFigure";
import { coverMedia, stillFor, useSignedMedia, type CardMedia } from "@/components/gallery/cardMedia";
import { useAuth } from "@/contexts/AuthContext";
import { useMyWeek } from "@/hooks/useProgressPage";
import { getWhereNextForViewer } from "@/lib/build/whereNext";
import { countLitToday, countReproducedToday, countRunsThisWeek } from "@/lib/build/signals";
import type { GalleryMedia } from "@/lib/build/gallery";
import { getBuildFeed, type FeedItem } from "@/lib/feed/getBuildFeed";
import { getStreakDays } from "@/lib/progress";
import { weeklyProgress } from "@/lib/progress/weekly";

import { HomeView, type HomeScope, type Loadable } from "./HomeView";
import {
  challengeRows,
  homeRowOf,
  readHomeSeen,
  streakOf,
  whereNextRows,
  writeHomeSeen,
} from "./homeModel";

/** Nothing is refetched for half a minute; Home is not a live ticker. */
const STALE_MS = 30_000;
/** The headline counts are estimates; a minute is as fresh as they mean to be. */
const COUNT_STALE_MS = 60_000;
/** How far back the streak is read: far enough that a long one is counted whole. */
const STREAK_LOOKBACK_DAYS = 400;
/** Every thumbnail on Home is signed at the smallest slot width the read path has. */
const THUMB_WIDTH = MEDIA_WIDTH.variant;

const SIGN_IN = "/login?redirect=/";

/** A signed-in-only panel's state: signed out, loading, failed, or its data mapped for the view. */
function loadable<T, U>(
  gate: { authLoading: boolean; signedIn: boolean },
  query: { isLoading: boolean; error: unknown; data: T | undefined; refetch: () => unknown },
  map: (data: T) => U,
): Loadable<U> {
  if (gate.authLoading) return { status: "loading" };
  if (!gate.signedIn) return { status: "signed-out" };
  if (query.isLoading) return { status: "loading" };
  if (query.data === undefined) {
    return query.error ? { status: "error", onRetry: () => void query.refetch(), error: query.error } : { status: "loading" };
  }
  return { status: "ready", data: map(query.data) };
}

export function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const userId = user?.id ?? null;
  const scope: HomeScope = params.get("tab") === "following" && userId ? "following" : "everyone";

  const onScopeChange = (next: HomeScope) => {
    if (next === "following" && !userId) {
      navigate(SIGN_IN);
      return;
    }
    const nextParams = new URLSearchParams(params);
    if (next === "following") nextParams.set("tab", "following");
    else nextParams.delete("tab");
    setParams(nextParams, { replace: true });
  };

  /* ── the visitors' book ── */

  const feedQuery = useInfiniteQuery({
    queryKey: ["feed", "getBuildFeed", scope, userId],
    enabled: !authLoading,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getBuildFeed({ before: pageParam, onlyFollowing: scope === "following" }),
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    staleTime: STALE_MS,
  });

  const items = useMemo(() => {
    const byKey = new Map<string, FeedItem>();
    for (const page of feedQuery.data?.pages ?? []) for (const item of page.items) byKey.set(item.key, item);
    return [...byKey.values()];
  }, [feedQuery.data]);

  /* The previous visit, read once; this visit is recorded when the first page has arrived. */
  const [seenAt] = useState(readHomeSeen);
  const recorded = useRef(false);
  useEffect(() => {
    if (feedQuery.isSuccess && !recorded.current) {
      recorded.current = true;
      writeHomeSeen(Date.now());
    }
  }, [feedQuery.isSuccess]);

  /* ── the right-hand column ── */

  const lit = useQuery({ queryKey: ["build", "countLitToday"], queryFn: countLitToday, staleTime: COUNT_STALE_MS });
  const reproduced = useQuery({
    queryKey: ["build", "countReproducedToday"],
    queryFn: () => countReproducedToday(),
    staleTime: COUNT_STALE_MS,
  });
  const runsWeek = useQuery({
    queryKey: ["build", "countRunsThisWeek"],
    queryFn: () => countRunsThisWeek(),
    staleTime: COUNT_STALE_MS,
  });

  const week = useMyWeek();

  const streakQuery = useQuery({
    queryKey: ["progress", "getStreakDays", userId, STREAK_LOOKBACK_DAYS],
    queryFn: () => getStreakDays(userId!, STREAK_LOOKBACK_DAYS),
    enabled: !!userId,
    staleTime: STALE_MS,
  });

  const whereNextQuery = useQuery({
    queryKey: ["build", "getWhereNextForViewer", userId],
    queryFn: () => getWhereNextForViewer(userId!),
    enabled: !!userId,
    staleTime: STALE_MS,
  });

  /* ── covers: one signing pass for every thumbnail on the page ── */

  const covers = useMemo(() => {
    const rows: CardMedia[] = [];
    const seen = new Set<string>();
    const push = (media: GalleryMedia | null) => {
      if (!media || seen.has(media.id)) return;
      seen.add(media.id);
      rows.push({ ...media, slotWidth: THUMB_WIDTH });
    };
    for (const item of items) push(coverMedia(item.build));
    for (const next of whereNextQuery.data ?? []) push(next.build.cover);
    return rows;
  }, [items, whereNextQuery.data]);
  const signed = useSignedMedia(covers);

  const now = Date.now();

  const feedRows = useMemo(
    () => items.map((item) => homeRowOf(item, stillFor(signed, coverMedia(item.build)))),
    [items, signed],
  );

  /* The orbs' two counts fail together: one retry asks for both, and the panel says so in place of the orbs. */
  const orbsFailed = (reproduced.isError && reproduced.data === undefined) || (runsWeek.isError && runsWeek.data === undefined);
  const orbsError = orbsFailed
    ? {
        onRetry: () => {
          void reproduced.refetch();
          void runsWeek.refetch();
        },
        error: reproduced.error ?? runsWeek.error,
      }
    : undefined;

  const gate = { authLoading, signedIn: !!userId };
  const challenges = loadable(gate, week, (events) => challengeRows(weeklyProgress(events, new Date(now))));
  const streak = loadable(gate, streakQuery, (days) => streakOf(days, new Date(now)));
  const whereNext = loadable(gate, whereNextQuery, (next) =>
    whereNextRows(next, (item) => stillFor(signed, item.build.cover)),
  );

  return (
    <>
      <SeoHead
        title="buildgallery.ai — The AI Agent Tactics Forum"
        description="Download AI assistants, blueprints and workflows. Works with ChatGPT, Claude, Gemini and any AI tool."
        path="/"
      />
      <HomeView
        fit="content"
        now={now}
        scope={scope}
        onScopeChange={onScopeChange}
        litToday={lit.data ?? null}
        reproducedToday={reproduced.data ?? null}
        runsThisWeek={runsWeek.data ?? null}
        orbsError={orbsError}
        feed={{
          status: feedQuery.isError && items.length === 0 ? "error" : feedQuery.isPending ? "loading" : "ready",
          rows: feedRows,
          hasMore: feedQuery.hasNextPage,
          loadingMore: feedQuery.isFetchingNextPage,
          onMore: () => void feedQuery.fetchNextPage(),
          onRetry: () => void feedQuery.refetch(),
          error: feedQuery.error,
        }}
        seenAt={seenAt}
        challenges={challenges}
        thisWeekHref={userId ? "/analytics" : undefined}
        streak={streak}
        whereNext={whereNext}
        onNavigate={navigate}
      />
    </>
  );
}

export default HomePage;
