/* SV-10 — `/`: the container.

   Loads Home's data through `src/lib/` functions only, maps it to `HomeView`'s props and renders it. No Supabase call in
   this file. Every section loads on its own and says so in its own place when it fails.

   TWO ROUNDS. Round 1: every read that does not depend on another starts at once with the feed's first page, the left
   and right columns included. Round 2: only what needs the feed's ids: the build posts' `post_doc` (in batches, below),
   their engagement, and the reader's Me too marks on the asks shown.

   `post_doc` ONLY WHERE IT IS SEEN. It is heavy (SV-03 took it out of list reads). The posts in the first screen are read
   as soon as the feed answers; the rest as each comes within one screen of view, one request per batch.

   THE ADDRESS HOLDS THE TAB AND THE KIND (`?tab=following`, `?kind=notes`): the same page with new parameters, so the old
   items stay until the new arrive and nothing fades. A signed-out reader who asks for Following is sent to sign in. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { MEDIA_WIDTH } from "@/components/build/MediaFigure";
import { rewardLabel } from "@/components/bounty/bountyDisplay";
import { coverMedia, feedMedia, stillFor, useSignedMedia, type CardMedia } from "@/components/gallery/cardMedia";
import { PageArrival } from "@/components/shell/PageArrival";
import { useAuth } from "@/contexts/AuthContext";
import { engagementFor, useEngagement } from "@/hooks/useEngagement";
import { librarySessionsKey, useLibrarySessions } from "@/hooks/useLibrarySessions";
import { useMyWeek } from "@/hooks/useProgressPage";
import { listOpenBountyCards, myMeToo, OPEN_BOUNTIES_PAGE_SIZE, toggleMeToo } from "@/lib/bounty";
import { listDraftsWithSessions } from "@/lib/build/drafts";
import { getGalleryBuildsByIds, listGallery, type GalleryBuild, type GalleryMedia } from "@/lib/build/gallery";
import { attachSession } from "@/lib/build/sessions";
import { countLitToday, countReproducedToday, countRunsThisWeek, listMostReproduced } from "@/lib/build/signals";
import { getWhereNextForViewer } from "@/lib/build/whereNext";
import { getBuildFeed, type FeedItem } from "@/lib/feed/getBuildFeed";
import { getStreakDays } from "@/lib/progress";
import { weekStartUtc, weeklyProgress } from "@/lib/progress/weekly";
import { LIST_STALE_MS, SLOW_STALE_MS } from "@/lib/query/client";
import { usePageReady } from "@/lib/routing/pageReady";
import { draftMeta, draftTitle, isUntitled, promptLine, sessionDate, sessionSource } from "@/pages/site/drafts/draftsModel";

import { HomeLoadingView } from "./HomeFrame";
import { HomeView, type HomeScope, type Loadable } from "./HomeView";
import {
  filterOf,
  homeItemOf,
  homeWeek,
  newerThan,
  readHomeSeen,
  runRows,
  timeLeft,
  whereNextRows,
  writeHomeSeen,
  type HomeAskDetail,
  type HomeFilter,
  type HomePostDetail,
} from "./homeModel";

const STALE_MS = LIST_STALE_MS;
/** The headline counts are estimates; a minute is as fresh as they mean to be. */
const COUNT_STALE_MS = SLOW_STALE_MS;
/** How far back the streak is read: far enough that a long one is counted whole. */
const STREAK_LOOKBACK_DAYS = 400;
/** Every thumbnail on Home is signed at the smallest slot width the read path has. */
const THUMB_WIDTH = MEDIA_WIDTH.variant;
/** The posts read with the first screen: at 1440 × 900 two or three posts fill it. */
export const FIRST_SCREEN_POSTS = 3;

const SIGN_IN = "/login?redirect=/";

/** A section's state: signed out, loading, failed, or its data mapped for the view. */
function loadable<T, U>(
  signedIn: boolean | null,
  query: { isLoading: boolean; error: unknown; data: T | undefined; refetch: () => unknown },
  map: (data: T) => U,
): Loadable<U> {
  if (signedIn === null) return { status: "loading" };
  if (!signedIn) return { status: "signed-out" };
  return publicLoadable(query, map);
}

function publicLoadable<T, U>(query: { isLoading: boolean; error: unknown; data: T | undefined; refetch: () => unknown }, map: (data: T) => U): Loadable<U> {
  if (query.data !== undefined) return { status: "ready", data: map(query.data) };
  if (query.error) return { status: "error", onRetry: () => void query.refetch(), error: query.error };
  return { status: "loading" };
}

/** The ids of a feed's build posts, in order. */
const postIds = (items: readonly FeedItem[]) => items.filter((item) => item.kind === "build").map((item) => item.build.id);

export function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();

  const userId = user?.id ?? null;
  const signedIn = authLoading ? null : userId !== null;
  const scope: HomeScope = params.get("tab") === "following" && userId ? "following" : "everyone";
  const filter = filterOf(params.get("kind"));

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const onScopeChange = (next: HomeScope) => {
    if (next === "following" && !userId) {
      navigate(SIGN_IN);
      return;
    }
    setParam("tab", next === "following" ? "following" : null);
  };
  const onFilterChange = (next: HomeFilter) => setParam("kind", next === "all" ? null : next);

  /* ── round 1: the feed ── */

  const feedQuery = useInfiniteQuery({
    queryKey: ["feed", "getBuildFeed", scope, userId],
    enabled: !authLoading,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getBuildFeed({ before: pageParam, onlyFollowing: scope === "following" }),
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    staleTime: STALE_MS,
    // Everyone to Following keeps the first list on screen until the second arrives.
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => {
    const byKey = new Map<string, FeedItem>();
    for (const page of feedQuery.data?.pages ?? []) for (const item of page.items) byKey.set(item.key, item);
    return [...byKey.values()];
  }, [feedQuery.data]);

  /* New since you looked: the previous visit, read once; this one is recorded when the first page has arrived. The items
     newer than it are held back until the pill is chosen. */
  const [seenAt] = useState(readHomeSeen);
  const [revealed, setRevealed] = useState(false);
  const recorded = useRef(false);
  useEffect(() => {
    if (feedQuery.isSuccess && !recorded.current) {
      recorded.current = true;
      writeHomeSeen(Date.now());
    }
  }, [feedQuery.isSuccess]);
  const newCount = revealed ? 0 : newerThan(items, seenAt);
  const shown = newCount === 0 ? items : items.filter((item) => Date.parse(item.at) <= (seenAt ?? 0));

  /* ── round 1: the columns ── */

  const lit = useQuery({ queryKey: ["build", "countLitToday"], queryFn: countLitToday, staleTime: COUNT_STALE_MS });
  const reproduced = useQuery({ queryKey: ["build", "countReproducedToday"], queryFn: () => countReproducedToday(), staleTime: COUNT_STALE_MS });
  const runsWeek = useQuery({ queryKey: ["build", "countRunsThisWeek"], queryFn: () => countRunsThisWeek(), staleTime: COUNT_STALE_MS });

  const weekStart = weekStartUtc(new Date()).toISOString();
  const mostRun = useQuery({
    queryKey: ["build", "listMostReproduced", weekStart],
    queryFn: () => listMostReproduced({ since: new Date(weekStart), limit: 3 }),
    staleTime: COUNT_STALE_MS,
  });

  /* The OpenBuilds board's own first page, on its own key: "Most needed first" is its asks by Me too. */
  const requests = useInfiniteQuery({
    queryKey: ["bounty-board"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listOpenBountyCards({ limit: OPEN_BOUNTIES_PAGE_SIZE, before: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE_MS,
  });
  const openCards = useMemo(() => requests.data?.pages[0]?.cards ?? [], [requests.data]);

  const endCards = useQuery({ queryKey: ["build", "listGallery", 2], queryFn: () => listGallery({ limit: 2 }), staleTime: STALE_MS });

  const drafts = useQuery({
    queryKey: ["build", "listDraftsWithSessions", userId],
    queryFn: () => listDraftsWithSessions(userId),
    enabled: userId !== null,
    staleTime: STALE_MS,
  });
  const library = useLibrarySessions({ active: false, withUnfinished: false, enabled: userId !== null });
  const week = useMyWeek();
  const streak = useQuery({
    queryKey: ["progress", "getStreakDays", userId, STREAK_LOOKBACK_DAYS],
    queryFn: () => getStreakDays(userId!, STREAK_LOOKBACK_DAYS),
    enabled: userId !== null,
    staleTime: STALE_MS,
  });
  const whereNext = useQuery({
    queryKey: ["build", "getWhereNextForViewer", userId],
    queryFn: () => getWhereNextForViewer(userId!),
    enabled: userId !== null,
    staleTime: STALE_MS,
  });

  /* ── round 2: the posts near the screen ── */

  const firstBatch = useMemo(() => postIds(shown).slice(0, FIRST_SCREEN_POSTS), [shown]);
  const [nearBatches, setNearBatches] = useState<string[][]>([]);
  const pending = useRef<Set<string>>(new Set());
  const asked = useMemo(() => new Set([...firstBatch, ...nearBatches.flat()]), [firstBatch, nearBatches]);
  const postKinds = useMemo(() => new Set(postIds(items)), [items]);
  const onPostsNear = useCallback(
    (ids: string[]) => {
      const fresh = ids.filter((id) => postKinds.has(id) && !asked.has(id) && !pending.current.has(id));
      if (fresh.length === 0) return;
      const startBatch = pending.current.size === 0;
      for (const id of fresh) pending.current.add(id);
      // The posts that come near together are asked for together: one request per batch.
      if (startBatch) {
        window.setTimeout(() => {
          const batch = [...pending.current];
          pending.current.clear();
          setNearBatches((before) => [...before, batch]);
        }, 0);
      }
    },
    [asked, postKinds],
  );
  const batches = [firstBatch, ...nearBatches].filter((batch) => batch.length > 0);
  const postReads = useQueries({
    queries: batches.map((batch) => ({
      queryKey: ["build", "getGalleryBuildsByIds", batch.join(",")],
      queryFn: () => getGalleryBuildsByIds(batch),
      staleTime: STALE_MS,
    })),
  });
  const details = new Map<string, HomePostDetail>();
  for (const read of postReads) {
    for (const row of read.data ?? []) details.set(row.id, { build: row, modelsUsed: row.models_used, classification: row.classifiedAs ?? null });
  }
  const firstScreenSettled = firstBatch.length === 0 || (postReads[0] !== undefined && !postReads[0].isPending);

  /* ── round 2: engagement and Me too, for the ids the feed holds ── */

  const engagementIds = useMemo(() => items.filter((item) => item.kind === "build" || item.kind === "rebuild").map((item) => item.build.id), [items]);
  const engagement = useEngagement(engagementIds);

  const askIds = useMemo(() => items.flatMap((item) => (item.kind === "bounty" && item.bountyId ? [item.bountyId] : [])), [items]);
  const meToo = useQuery({
    queryKey: ["bounty", "myMeToo", userId, askIds.join(",")],
    queryFn: () => myMeToo(askIds, userId!),
    enabled: userId !== null && askIds.length > 0,
    staleTime: STALE_MS,
  });

  const asks = useMemo(() => {
    const out = new Map<string, HomeAskDetail>();
    for (const card of openCards) out.set(card.bounty.id, { solutions: card.solutions, closesAt: card.bounty.closes_at, meTooCount: card.bounty.me_too_count ?? 0 });
    return out;
  }, [openCards]);

  const onMeToo = async (bountyId: string) => {
    if (!userId) {
      navigate(SIGN_IN);
      return;
    }
    try {
      await toggleMeToo({ bountyId, userId });
    } catch (error) {
      console.error("[Home] toggleMeToo failed", error);
      toast.error("Couldn't save that. Try again.");
    } finally {
      void qc.invalidateQueries({ queryKey: ["bounty", "myMeToo"] });
      void qc.invalidateQueries({ queryKey: ["bounty-board"] });
    }
  };

  const onAddSession = async (sessionId: string) => {
    try {
      const id = await attachSession(sessionId, { kind: "new" });
      toast("New build started.", { action: { label: "Open", onClick: () => navigate(`/compose/${id}`) } });
    } catch (error) {
      console.error("[Home] attachSession (new) failed", error);
      toast.error("Couldn't start a build from that session.");
    } finally {
      void qc.invalidateQueries({ queryKey: ["build", "listDraftsWithSessions"] });
      void qc.invalidateQueries({ queryKey: librarySessionsKey });
      void qc.invalidateQueries({ queryKey: ["build", "countDraftBuilds"] });
    }
  };

  /* ── pictures: one signing pass for the page ── */

  // useSignedMedia keys on the paths, so a new array with the same pictures signs nothing again.
  const media = (() => {
    const rows: CardMedia[] = [];
    const seen = new Set<string>();
    const push = (row: CardMedia | null) => {
      if (!row || seen.has(row.id)) return;
      seen.add(row.id);
      rows.push(row);
    };
    const thumb = (row: GalleryMedia | null) => (row ? { ...row, slotWidth: THUMB_WIDTH } : null);
    for (const item of shown) {
      if (item.kind !== "build") continue;
      for (const row of feedMedia(details.get(item.build.id)?.build ?? item.build)) push(row);
    }
    for (const next of whereNext.data ?? []) push(thumb(next.build.cover));
    for (const card of endCards.data?.builds ?? []) push(thumb(coverMedia(card)));
    return rows;
  })();
  const srcByPath = useSignedMedia(media);

  /* ── mapping ── */

  const now = Date.now();
  const context = {
    details,
    asks,
    engagement: (buildId: string) => (engagement.counts[buildId] ? engagementFor(engagement, buildId) : undefined),
    meTooPressed: meToo.data ?? new Set<string>(),
  };

  const feedStatus = feedQuery.isError && items.length === 0 ? "error" : feedQuery.isPending ? "loading" : "ready";
  usePageReady("home", feedStatus !== "loading" && firstScreenSettled);

  const countsFailed = (reproduced.isError && reproduced.data === undefined) || (runsWeek.isError && runsWeek.data === undefined);
  const coverOf = (build: GalleryBuild) => stillFor(srcByPath, coverMedia(build));

  return (
    <>
      <SeoHead
        title="buildgallery.ai: The AI Agent Tactics Forum"
        description="Download AI assistants, blueprints and workflows. Works with ChatGPT, Claude, Gemini and any AI tool."
        path="/"
      />
      {/* SV-04 P5: the page arrives over its loading state, the route's Placeholder, when the feed lands. */}
      <PageArrival loading={feedStatus === "loading"} placeholder={<HomeLoadingView />}>
        <HomeView
          now={now}
          since={null}
          drafts={loadable(signedIn, drafts, (rows) => ({
            total: rows.length,
            rows: rows
              .filter((draft) => draft.sessionCount > 0)
              .slice(0, 3)
              .map((draft) => ({ id: draft.id, title: draftTitle(draft.title), untitled: isUntitled(draft.title), meta: draftMeta(draft, now) })),
          }))}
          sessions={loadable(signedIn, { isLoading: !library.data && !library.isLoadingError, error: library.isLoadingError ? library.error : null, data: library.data, refetch: library.refetch }, (rows) => ({
            total: rows.length,
            rows: rows.slice(0, 2).map((session) => {
              const inDrafts = (session.draftIds ?? (session.buildId ? [session.buildId] : [])).length;
              return {
                id: session.id,
                title: promptLine(session),
                meta: [sessionSource(session), sessionDate(session.createdAt, now), inDrafts > 0 ? `In ${inDrafts} ${inDrafts === 1 ? "draft" : "drafts"}` : null].filter(Boolean).join(" · "),
                client: session.client,
                model: session.model,
              };
            }),
          }))}
          onAddSession={(id) => void onAddSession(id)}
          week={
            signedIn === false
              ? { status: "signed-out" }
              : week.data !== undefined && streak.data !== undefined
                ? { status: "ready", data: homeWeek(streak.data, weeklyProgress(week.data, new Date(now)), new Date(now)) }
                : week.error || streak.error
                  ? { status: "error", onRetry: () => void Promise.all([week.refetch(), streak.refetch()]), error: week.error ?? streak.error }
                  : { status: "loading" }
          }
          scope={scope}
          onScopeChange={onScopeChange}
          filter={filter}
          onFilterChange={onFilterChange}
          feed={{
            status: feedStatus,
            items: shown.map((item) => homeItemOf(item, context)),
            hasMore: feedQuery.hasNextPage,
            loadingMore: feedQuery.isFetchingNextPage,
            onMore: () => void feedQuery.fetchNextPage(),
            onRetry: () => void feedQuery.refetch(),
            error: feedQuery.error,
          }}
          newCount={newCount}
          onShowNew={() => setRevealed(true)}
          srcByPath={srcByPath}
          onPostsNear={onPostsNear}
          onMeToo={(id) => void onMeToo(id)}
          endCards={(endCards.data?.builds ?? []).map((build) => ({ id: build.id, title: build.title, href: `/b2/${build.slug}`, plaque: build, cover: { src: coverOf(build) } }))}
          room={{
            reproducedToday: reproduced.data ?? null,
            litToday: lit.data ?? null,
            runsThisWeek: runsWeek.data ?? null,
            failure: countsFailed
              ? {
                  onRetry: () => {
                    void reproduced.refetch();
                    void runsWeek.refetch();
                    void lit.refetch();
                  },
                  error: reproduced.error ?? runsWeek.error,
                }
              : undefined,
            runs: runRows(items),
          }}
          requests={publicLoadable({ isLoading: requests.isLoading, error: requests.error, data: requests.data, refetch: requests.refetch }, () =>
            [...openCards]
              .sort((a, b) => (b.bounty.me_too_count ?? 0) - (a.bounty.me_too_count ?? 0))
              .slice(0, 3)
              .map((card) => ({
                id: card.bounty.id,
                title: (card.gapTitle ?? "").trim() || card.build.title,
                detail: [card.build.title, timeLeft(card.bounty.closes_at, now)].filter(Boolean).join(" · "),
                reward: rewardLabel(card.bounty.reward_gbp),
                href: `/bounties/${card.bounty.id}/solve`,
              })),
          )}
          mostRun={publicLoadable(mostRun, (rows) =>
            rows.map((row) => ({
              buildId: row.buildId,
              title: row.title,
              href: `/b2/${row.slug}`,
              maker: { id: row.creatorId, handle: row.maker.handle, name: row.maker.name ?? row.maker.handle ?? "Someone", avatarUrl: row.maker.avatarUrl },
              count: row.count,
            })),
          )}
          whereNext={loadable(signedIn, whereNext, (next) => whereNextRows(next, (item) => stillFor(srcByPath, item.build.cover)))}
        />
      </PageArrival>
    </>
  );
}

export default HomePage;
