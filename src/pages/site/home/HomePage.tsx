/* SV-10: `/`, the container.

   Loads Home's data through `src/lib/` functions only, maps it to `HomeView`'s props and renders it. No Supabase call in
   this file. Every section loads on its own and says so in its own place when it fails.

   TWO ROUNDS. Round 1: every read that does not depend on another starts at once with the feed's first page, the left
   and right columns included. Round 2: only what needs the feed's ids: the build posts' `post_doc` (in batches, below),
   their engagement, and the reader's Me too marks on the asks shown.

   `post_doc` ONLY WHERE IT IS SEEN. It is heavy (SV-03 took it out of list reads). The posts in the first screen are read
   as soon as the feed answers; the rest as each comes within one screen of view, one request per batch.

   THE ADDRESS HOLDS THE TAB AND THE KIND (`?tab=following`, `?kind=notes`): the same page with new parameters, so the old
   items stay until the new arrive and nothing fades. A signed-out reader who asks for Following is sent to sign in. */

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { topicHref } from "@/components/post/postCardModel";
import { reportError } from "@/lib/errors/report";
import { MEDIA_WIDTH } from "@/components/build/MediaFigure";
import { coverMedia, feedMedia, stillFor, useSignedMedia, type CardMedia } from "@/components/gallery/cardMedia";
import { PageArrival } from "@/components/shell/PageArrival";
import { useAuth } from "@/contexts/AuthContext";
import { engagementFor, useEngagement } from "@/hooks/useEngagement";
import { librarySessionsKey, useLibrarySessions } from "@/hooks/useLibrarySessions";
import { useMyWeek } from "@/hooks/useProgressPage";
import { findRunByHandle, myMeToo, toggleMeToo } from "@/lib/bounty";
import { listPosts, postKey } from "@/lib/openbuilds";
import type { PostingWindow } from "../openbuilds/PostingWindows";
import { failedRunDraft } from "./runTopic";
import { listPublishedBuildsByCreator } from "@/lib/build/builds";
import { listDraftFirstPrompts, listDraftsWithSessions } from "@/lib/build/drafts";
import { copyToClipboard } from "@/lib/deepLink";
import { SHARE_ORIGIN } from "@/components/social/EngagementRow";
import { getGalleryBuildsByIds, listGallery, type GalleryBuild, type GalleryMedia } from "@/lib/build/gallery";
import { attachSession } from "@/lib/build/sessions";
import { countLitToday, countReproducedToday, countRunsThisWeek, listMostReproduced } from "@/lib/build/signals";
import { getWhereNextForViewer } from "@/lib/build/whereNext";
import { listActivityFor } from "@/lib/feed/activity";
import { getBuildFeed, type FeedItem, type PostFeedEntry } from "@/lib/feed/getBuildFeed";
import { likePost, unlikePost } from "@/lib/openbuilds";
import { readFeedTopics } from "@/lib/openbuilds/feedTopics";
import { saveItem, savedPostIds, unsaveItem } from "@/lib/library/savedItems";
import { ReplyBox } from "@/pages/site/openbuilds/ReplyBox";
import { replyDraftTitle } from "@/pages/site/openbuilds/postModel";
import { getStreakDays } from "@/lib/progress";
import { weekStartUtc, weeklyProgress } from "@/lib/progress/weekly";
import { LIST_STALE_MS, SLOW_STALE_MS } from "@/lib/query/client";
import { usePageReady } from "@/lib/routing/pageReady";
import { draftMeta, draftRowTitle, isUntitled, promptLine, sessionDate, sessionSource } from "@/pages/site/drafts/draftsModel";

import { HomeLoadingView } from "./HomeFrame";
import { HomeView, type HomeScope, type Loadable } from "./HomeView";
import { feedTopicIds, homePostItemOf } from "./homeTopics";
import {
  filterOf,
  firstScreenPosts,
  feedKey,
  feedWaitsForSession,
  homeItemOf,
  homeWeek,
  newerThan,
  readHomeSeen,
  runRows,
  type HomeRunRow,
  shownItems,
  sinceSection,
  whereNextRows,
  writeHomeSeen,
  type HomeAskDetail,
  type HomeFilter,
  type HomePostDetail,
  HOME_BUILD_ROWS,
  STILL_OPEN_SHOWN,
  stillOpenRows,
  type StillOpenScope,
} from "./homeModel";

/** UX-08 P3: the open requests are no longer read on Home, so the old requests in the feed carry no extra detail. */
/** UX-08 P2: the New post window loads when a failed run first opens it, not with the page. */
const PostingWindows = lazy(() => import("../openbuilds/PostingWindows"));

const NO_ASKS: ReadonlyMap<string, HomeAskDetail> = new Map();

const STALE_MS = LIST_STALE_MS;
/** The headline counts are estimates; a minute is as fresh as they mean to be. */
const COUNT_STALE_MS = SLOW_STALE_MS;
/** How far back the streak is read: far enough that a long one is counted whole. */
const STREAK_LOOKBACK_DAYS = 400;
/** Every thumbnail on Home is signed at the smallest slot width the read path has. */
const THUMB_WIDTH = MEDIA_WIDTH.variant;

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

/** One batch of build posts, read with their post_doc. */
const postsQuery = (ids: string[]) => ({
  queryKey: ["build", "getGalleryBuildsByIds", ids.join(",")],
  queryFn: () => getGalleryBuildsByIds(ids),
  staleTime: STALE_MS,
});

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

  /* New since you looked: the previous visit, read once; this one is recorded when the first page has arrived. The items
     newer than it are held back until the pill is chosen. */
  const [seenAt] = useState(readHomeSeen);
  const [revealed, setRevealed] = useState(false);

  const feedQuery = useInfiniteQuery({
    queryKey: feedKey(scope, userId),
    // UX-01 P5: Everyone starts at once; Following waits for the reader.
    enabled: !feedWaitsForSession(scope) || !authLoading,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const page = await getBuildFeed({ before: pageParam, onlyFollowing: scope === "following" });
      // The first screen's posts are asked for the moment the first page answers, not a render later: round 2 at once.
      if (!pageParam) void qc.prefetchQuery(postsQuery(firstScreenPosts(shownItems(page.items, seenAt, revealed))));
      return page;
    },
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

  /* UX-07 P1: the topics and reply groups the feed carries, kept apart from the build items, newest first. */
  const postEntries = useMemo(() => {
    const byKey = new Map<string, PostFeedEntry>();
    for (const page of feedQuery.data?.pages ?? []) for (const entry of page.postItems ?? []) byKey.set(entry.key, entry);
    return [...byKey.values()];
  }, [feedQuery.data]);

  const recorded = useRef(false);
  useEffect(() => {
    if (feedQuery.isSuccess && !recorded.current) {
      recorded.current = true;
      writeHomeSeen(Date.now());
    }
  }, [feedQuery.isSuccess]);
  const newCount = revealed ? 0 : newerThan([...items, ...postEntries], seenAt);
  const shown = shownItems(items, seenAt, revealed);
  const shownPosts = shownItems(postEntries, seenAt, revealed);

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

  /* Since you were last here: what others did with the reader's builds and saves since the previous visit. `seenAt` is
     read once above, so the window does not move when this visit is recorded. No earlier visit: nothing to say. */
  const activity = useQuery({
    queryKey: ["feed", "listActivityFor", userId, seenAt],
    queryFn: () => listActivityFor({ userId: userId!, since: seenAt!, limit: 5 }),
    enabled: userId !== null && seenAt !== null,
    staleTime: STALE_MS,
  });

  /* UX-08 P3: Still open: the topics still waiting for a piece, from the reader's spaces (everyone's when signed out). One request,
     started with the rest of the first round; it waits only for the session check to say which. */
  const stillOpenScope: StillOpenScope = signedIn ? "spaces" : "everyone";
  const stillOpen = useQuery({
    queryKey: postKey("listPosts", stillOpenScope, "stillOpen", STILL_OPEN_SHOWN),
    queryFn: () => listPosts({ scope: stillOpenScope, stillOpen: true, limit: STILL_OPEN_SHOWN }),
    enabled: signedIn !== null,
    staleTime: STALE_MS,
  });

  const endCards = useQuery({ queryKey: ["build", "listGallery", 2], queryFn: () => listGallery({ limit: 2 }), staleTime: STALE_MS });

  const drafts = useQuery({
    queryKey: ["build", "listDraftsWithSessions", userId],
    queryFn: () => listDraftsWithSessions(userId),
    enabled: userId !== null,
    staleTime: STALE_MS,
  });
  /* UX-03 P7: the untitled drafts' first prompts, beside the drafts, so a draft with no title is shown by its prompt. */
  const draftPrompts = useQuery({
    queryKey: ["build", "listDraftFirstPrompts", userId],
    queryFn: () => listDraftFirstPrompts(userId),
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
  /* UX-03 P6: the maker's live builds, for the room when nothing else in it has anything to show. Started with the rest of round 1. */
  const published = useQuery({
    queryKey: ["build", "listPublishedBuildsByCreator", userId, HOME_BUILD_ROWS],
    queryFn: () => listPublishedBuildsByCreator(userId!, { limit: HOME_BUILD_ROWS }),
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

  // Held by its ids, so the near-screen observers are not set up again on every render.
  const firstKey = firstScreenPosts(shown).join(",");
  const firstBatch = useMemo(() => (firstKey ? firstKey.split(",") : []), [firstKey]);
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
  const postReads = useQueries({ queries: batches.map(postsQuery) });
  const details = new Map<string, HomePostDetail>();
  for (const read of postReads) {
    for (const row of read.data ?? []) details.set(row.id, { build: row, modelsUsed: row.models_used, classification: row.classifiedAs ?? null });
  }
  const firstScreenSettled = firstBatch.length === 0 || (postReads[0] !== undefined && !postReads[0].isPending);

  /* ── round 2: what the topics' cards need beyond the feed rows (their spaces and attachments, the reader's likes) ── */

  const topicIds = feedTopicIds(postEntries);
  const topicKey = ["openbuilds", "readFeedTopics", topicIds.topics.join(","), topicIds.replies.join(","), userId] as const;
  const topicReads = useQuery({
    queryKey: topicKey,
    queryFn: () => readFeedTopics(topicIds.topics, topicIds.replies),
    enabled: topicIds.topics.length > 0 && !authLoading,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (topicReads.error) reportError(topicReads.error, { source: "home", context: "readFeedTopics" });
  }, [topicReads.error]);

  /* A like changes the card at once and asks the database after; a refusal puts it back and says so. */
  const [likeShift, setLikeShift] = useState<Record<string, boolean>>({});
  const onTopicLike = async (postId: string, on: boolean) => {
    if (!userId) {
      navigate(SIGN_IN);
      return;
    }
    setLikeShift((current) => ({ ...current, [postId]: on }));
    try {
      await (on ? likePost(postId) : unlikePost(postId));
      await qc.invalidateQueries({ queryKey: ["openbuilds", "readFeedTopics"] });
    } catch (error) {
      reportError(error, { source: "home", context: "likePost" });
      toast.error("That didn't save. Try again.");
    } finally {
      setLikeShift((current) => {
        const { [postId]: _done, ...rest } = current;
        return rest;
      });
    }
  };

  /* UX-07 P4: Save on a topic keeps it in the reader's Library (saved_items, kind 'post'); nobody else sees a save. */
  const savedTopics = useQuery({
    queryKey: ["library", "savedPostIds", userId, topicIds.topics.join(",")],
    queryFn: () => savedPostIds(topicIds.topics),
    enabled: userId !== null && topicIds.topics.length > 0,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
  const [saveShift, setSaveShift] = useState<Record<string, boolean>>({});
  const isTopicSaved = (postId: string) => saveShift[postId] ?? savedTopics.data?.has(postId) ?? false;
  const onTopicSave = async (postId: string, on: boolean) => {
    if (!userId) {
      navigate(SIGN_IN);
      return;
    }
    setSaveShift((current) => ({ ...current, [postId]: on }));
    try {
      const existing = savedTopics.data?.get(postId);
      if (on) await saveItem({ kind: "post", ref: postId });
      else if (existing) await unsaveItem(existing);
      await qc.invalidateQueries({ queryKey: ["library", "savedPostIds"] });
      void qc.invalidateQueries({ queryKey: ["library", "listSavedItems"] });
      void qc.invalidateQueries({ queryKey: ["library", "countSavedItems"] });
    } catch (error) {
      reportError(error, { source: "home", context: on ? "saveItem" : "unsaveItem" });
      toast.error("That didn't save. Try again.");
    } finally {
      setSaveShift((current) => {
        const { [postId]: _done, ...rest } = current;
        return rest;
      });
    }
  };

  /* The one reply box, under the topic it answers. */
  const [replyAt, setReplyAt] = useState<string | null>(null);
  const replyEntry = replyAt ? postEntries.find((entry) => entry.postId === replyAt) : undefined;

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

  /* UX-08 P2: only when the maker presses it. The feed row has the build and the reproducer's handle, so the run is found now; the
     New post window then opens with the run in its words, and nothing is written until Post is pressed. */
  const [win, setWin] = useState<PostingWindow | null>(null);
  const onOpenRequest = async (run: HomeRunRow) => {
    if (!userId || !run.handle) return;
    try {
      const found = await findRunByHandle(run.buildId, run.handle);
      if (!found) throw new Error("That run is not there any more");
      if (found.worked) throw new Error("That run worked, so there is nothing to start a topic about");
      setWin({ kind: "post", draft: failedRunDraft({ buildId: found.buildId, model: found.model }) });
    } catch (error) {
      reportError(error, { source: "home", context: "failedRunTopic" });
      toast.error("Couldn't start a topic from that run. Try again.");
    }
  };

  const onMeToo = async (bountyId: string) => {
    if (!userId) {
      navigate(SIGN_IN);
      return;
    }
    try {
      await toggleMeToo({ bountyId, userId });
    } catch (error) {
      reportError(error, { source: "home", context: "toggleMeToo" });
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
      reportError(error, { source: "home", context: "attachSession" });
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
    asks: NO_ASKS,
    // Drawn from the start, its counts filling in when they come, so the row does not push the feed down.
    engagement: (buildId: string) => engagementFor(engagement, buildId),
    meTooPressed: meToo.data ?? new Set<string>(),
  };

  /* The page arrives once, with the feed's first page; it never goes back to its loading state after that (a new tab
     keeps the old items instead). Holding it for the first screen's posts as well was measured: no shift as a post takes
     its shape, but the arrival fade then lands on the largest element and LCP is about 150 ms later. The page-ready mark
     still waits for those posts: that is when the first screen is real. */
  const arrived = useRef(false);
  if (!feedQuery.isPending) arrived.current = true;
  const feedStatus = feedQuery.isError && items.length === 0 ? "error" : arrived.current ? "ready" : "loading";
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
          since={seenAt !== null && activity.data ? sinceSection(activity.data, seenAt, now) : null}
          drafts={loadable(signedIn, drafts, (rows) => ({
            total: rows.length,
            rows: rows
              .filter((draft) => draft.sessionCount > 0)
              .slice(0, 3)
              // UX-03 P7: an untitled draft is shown by its first prompt.
              .map((draft) => ({ id: draft.id, title: draftRowTitle({ ...draft, firstPrompt: draftPrompts.data?.get(draft.id) ?? null }), untitled: isUntitled(draft.title), meta: draftMeta(draft, now) })),
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
            items: [
              ...shown.map((item) => homeItemOf(item, context)),
              ...shownPosts.map((entry) => {
                const drawn = homePostItemOf(entry, topicReads.data, now);
                if (drawn.kind !== "topic" || likeShift[drawn.postId] === undefined || likeShift[drawn.postId] === drawn.liked) return drawn;
                const on = likeShift[drawn.postId];
                return { ...drawn, liked: on, likes: Math.max(0, drawn.likes + (on ? 1 : -1)) };
              }),
            ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
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
          topics={{
            onLike: (postId, on) => void onTopicLike(postId, on),
            onReply: (postId) => setReplyAt((current) => (current === postId ? null : postId)),
            save: { isSaved: isTopicSaved, onSave: (postId, on) => void onTopicSave(postId, on) },
            box: replyEntry
              ? {
                  at: replyEntry.postId,
                  node: (
                    <ReplyBox
                      pageId={replyEntry.postId}
                      rootId={replyEntry.postId}
                      parentId={replyEntry.postId}
                      about={null}
                      onRemoveAbout={() => undefined}
                      signInTo={SIGN_IN}
                      draftTitle={replyDraftTitle({ body: replyEntry.kind === "post" ? replyEntry.body : replyEntry.root.body })}
                      onSent={() => {
                        setReplyAt(null);
                        toast("Replied.", { action: { label: "Open topic", onClick: () => navigate(topicHref(replyEntry.postId)) } });
                        void qc.invalidateQueries({ queryKey: feedKey(scope, userId) });
                      }}
                    />
                  ),
                }
              : null,
          }}
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
            runs: runRows(items, 3, userId),
            onOpenRequest: userId ? (run) => void onOpenRequest(run) : undefined,
          }}
          requests={publicLoadable({ isLoading: stillOpen.isLoading || signedIn === null, error: stillOpen.error, data: stillOpen.data, refetch: stillOpen.refetch }, (page) => stillOpenRows(page.posts))}
          stillOpenScope={stillOpenScope}
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
          published={loadable(signedIn, published, (result) => ({
            total: result.total,
            reproduced: result.reproduced,
            rows: result.rows.map((row) => ({ id: row.id, title: row.title, slug: row.slug, href: `/b2/${row.slug}`, published: row.published_at ? sessionDate(row.published_at, now) : "" })),
          }))}
          onCopyLink={(slug) =>
            void copyToClipboard(`${SHARE_ORIGIN}/b2/${slug}`).then((copied) => toast(copied ? "Link copied" : "The link could not be copied."))
          }
        />
      </PageArrival>
      {win ? (
        <Suspense fallback={null}>
          <PostingWindows window={win} onClose={() => setWin(null)} onReopen={setWin} />
        </Suspense>
      ) : null}
    </>
  );
}

export default HomePage;
