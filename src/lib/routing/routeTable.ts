// SV-03 P6: one entry per page, keyed by its SITE_NAV key.
//
// Each entry holds what is needed to open the page quickly:
//   pattern       the path it answers (react-router's syntax);
//   load()        the page's chunk import, THE SAME FUNCTION its route's lazy() uses (App.tsx builds its lazy pages from here);
//   prefetch()    starts the page's first-screen queries, on the keys and with the functions the page uses;
//   Placeholder   the page's own loading shape (placeholders.tsx).
// They are plain fields: a page prompt (SV-08 to SV-14) replaces them for its new page and nothing else here changes.
//
// This file is imported eagerly (App.tsx), so it holds no page code and no data code: `prefetch` imports what it reads when
// it runs. `gallery` is `/builds` and `bounties` is `/openbuilds` (SV-02 kept the keys); a later rename changes a value.

import type { QueryClient } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { matchPath } from "react-router-dom";

import { SITE_NAV } from "@/components/shell/siteNav";
import { SANDBOX_COMPOSER_ENABLED } from "@/lib/build/flags";
import { SkipToBuild } from "@/pages/site/compose/SkipToBuild";
import { LIST_STALE_MS, SLOW_STALE_MS } from "@/lib/query/client";

import {
  BuildPlaceholder,
  BuildsPlaceholder,
  ComposerPlaceholder,
  DraftsPlaceholder,
  HomePlaceholder,
  LibraryPlaceholder,
  OpenBuildsPlaceholder,
  ProfilePlaceholder,
} from "./placeholders";

export type RouteParams = Record<string, string | undefined>;
export interface RouteContext {
  /** The signed-in reader, from the stored session; null signed out. */
  userId: string | null;
}

export interface RouteEntry {
  key: string;
  pattern: string | readonly string[];
  /** A page that needs a signed-in reader; nothing is started for a signed-out one. */
  signedIn: boolean;
  load: () => Promise<{ default: ComponentType<never> }>;
  prefetch: (params: RouteParams, queryClient: QueryClient, context: RouteContext) => Promise<void> | void;
  Placeholder: ComponentType;
  /** SV-04 P4: what the one frame does for this page. `wide`: no 1428 cap and no side padding; `SkipLink`: the first stop.
      SV-08 `board`: the vision boards' page area (no breadcrumb, the board's padding). */
  frame?: { wide?: boolean; board?: boolean | "home"; SkipLink?: ComponentType };
}


export const ROUTE_TABLE: Record<string, RouteEntry> = {
  home: {
    key: "home",
    pattern: SITE_NAV.home,
    signedIn: false,
    load: () => import("@/pages/site/home/HomePage"),
    /* SV-10: the first screen's reads that need nothing else: the Everyone feed, the room's counts and lists, and a
       signed-in reader's drafts. Same keys and functions as HomePage. */
    prefetch: async (_params, queryClient, { userId }) => {
      const [{ getBuildFeed }, signals, { listOpenBountyCards, OPEN_BOUNTIES_PAGE_SIZE }, { listDraftsWithSessions }, { weekStartUtc }] = await Promise.all([
        import("@/lib/feed/getBuildFeed"),
        import("@/lib/build/signals"),
        import("@/lib/bounty"),
        import("@/lib/build/drafts"),
        import("@/lib/progress/weekly"),
      ]);
      const weekStart = weekStartUtc(new Date()).toISOString();
      await Promise.all([
        queryClient.prefetchInfiniteQuery({
          queryKey: ["feed", "getBuildFeed", "everyone", userId],
          initialPageParam: undefined as string | undefined,
          queryFn: ({ pageParam }) => getBuildFeed({ before: pageParam, onlyFollowing: false }),
          getNextPageParam: (last) => last.nextBefore ?? undefined,
          staleTime: LIST_STALE_MS,
          pages: 1,
        }),
        queryClient.prefetchQuery({ queryKey: ["build", "countLitToday"], queryFn: signals.countLitToday, staleTime: SLOW_STALE_MS }),
        queryClient.prefetchQuery({ queryKey: ["build", "countReproducedToday"], queryFn: () => signals.countReproducedToday(), staleTime: SLOW_STALE_MS }),
        queryClient.prefetchQuery({ queryKey: ["build", "countRunsThisWeek"], queryFn: () => signals.countRunsThisWeek(), staleTime: SLOW_STALE_MS }),
        queryClient.prefetchQuery({
          queryKey: ["build", "listMostReproduced", weekStart],
          queryFn: () => signals.listMostReproduced({ since: new Date(weekStart), limit: 3 }),
          staleTime: SLOW_STALE_MS,
        }),
        queryClient.prefetchInfiniteQuery({
          queryKey: ["bounty-board"],
          initialPageParam: null as string | null,
          queryFn: ({ pageParam }) => listOpenBountyCards({ limit: OPEN_BOUNTIES_PAGE_SIZE, before: pageParam }),
          getNextPageParam: (last) => last.nextCursor ?? undefined,
          staleTime: LIST_STALE_MS,
          pages: 1,
        }),
        userId
          ? queryClient.prefetchQuery({ queryKey: ["build", "listDraftsWithSessions", userId], queryFn: () => listDraftsWithSessions(userId), staleTime: LIST_STALE_MS })
          : undefined,
      ]);
    },
    Placeholder: HomePlaceholder,
    frame: { board: "home" },
  },
  gallery: {
    key: "gallery",
    pattern: SITE_NAV.gallery,
    signedIn: false,
    load: () => import("@/pages/site/builds/BuildsPage"),
    /* SV-11: the first screen's one round: the Table's first page, the stats, the lens counts and the facets. Same keys and
       functions as BuildsPage. On /builds itself (the route warming up) the list follows the address's filters; from a
       link elsewhere, the resting Table, which is what a link to /builds opens. */
    prefetch: async (_params, queryClient) => {
      const here = window.location.pathname === SITE_NAV.gallery ? window.location.search : "";
      const [gallery, { parseGalleryParams }, { listParamsOf, nextTableOffset }] = await Promise.all([
        import("@/lib/build/gallery"),
        import("@/lib/build/galleryParams"),
        import("@/pages/site/builds/buildsModel"),
      ]);
      const listParams = listParamsOf(parseGalleryParams(new URLSearchParams(here)));
      await Promise.all([
        queryClient.prefetchInfiniteQuery({
          queryKey: ["build", "listBuildsTable", listParams],
          initialPageParam: 0,
          queryFn: ({ pageParam }) => gallery.listBuildsTable({ ...listParams, offset: pageParam }),
          getNextPageParam: nextTableOffset,
          staleTime: LIST_STALE_MS,
          pages: 1,
        }),
        queryClient.prefetchQuery({ queryKey: ["build", "getGalleryStats"], queryFn: gallery.getGalleryStats, staleTime: SLOW_STALE_MS }),
        queryClient.prefetchQuery({ queryKey: ["build", "countGalleryLenses"], queryFn: gallery.countGalleryLenses, staleTime: SLOW_STALE_MS }),
        queryClient.prefetchQuery({ queryKey: ["build", "getClassificationFacets"], queryFn: gallery.getClassificationFacets, staleTime: SLOW_STALE_MS }),
        queryClient.prefetchQuery({ queryKey: ["build", "getGalleryFacets"], queryFn: gallery.getGalleryFacets, staleTime: SLOW_STALE_MS }),
      ]);
    },
    Placeholder: BuildsPlaceholder,
    frame: { board: true },
  },
  bounties: {
    key: "bounties",
    pattern: SITE_NAV.bounties,
    signedIn: false,
    load: () => import("@/pages/site/openbuilds/OpenBuildsPage"),
    /* SV-14: the first screen's one round: the step requests in the address's sort (their own second round is inside the
       read), the top contributors, the model release check, the week's goal, and a signed-in reader's requests and record. Same keys and functions as
       OpenBuildsPage. On /openbuilds itself the sort follows the address; from a link elsewhere, Most needed. */
    prefetch: async (_params, queryClient, { userId }) => {
      const here = window.location.pathname === SITE_NAV.bounties ? window.location.search : "";
      const [bounty, modelChecks, reviews, { readAddress, sizeOfTab, stepRequestsKey, contributorsKey, releaseCheckKey, weekGoalKey, CONTRIBUTORS_SHOWN, CONTRIBUTORS_DAYS }] = await Promise.all([
        import("@/lib/bounty"),
        import("@/lib/bounty/modelChecks"),
        import("@/lib/bounty/reviews"),
        import("@/pages/site/openbuilds/openBuildsModel"),
      ]);
      const { sort, tab } = readAddress(new URLSearchParams(here));
      const size = sizeOfTab(tab);
      await Promise.all([
        queryClient.prefetchInfiniteQuery({
          queryKey: stepRequestsKey(sort, size, userId),
          initialPageParam: 0,
          queryFn: ({ pageParam }) => bounty.listStepRequests({ sort, size, offset: pageParam, viewerId: userId }),
          getNextPageParam: (last) => last.nextOffset ?? undefined,
          staleTime: LIST_STALE_MS,
          pages: 1,
        }),
        queryClient.prefetchQuery({
          queryKey: contributorsKey,
          queryFn: () => bounty.listTopSolvers({ limit: CONTRIBUTORS_SHOWN, sinceDays: CONTRIBUTORS_DAYS }),
          staleTime: SLOW_STALE_MS,
        }),
        // SV-22: the model release check is one request of the same round.
        queryClient.prefetchQuery({ queryKey: releaseCheckKey, queryFn: () => modelChecks.getReleaseCheck(), staleTime: SLOW_STALE_MS }),
        queryClient.prefetchQuery({ queryKey: weekGoalKey, queryFn: () => reviews.getWeekGoal(), staleTime: LIST_STALE_MS }),
        userId ? queryClient.prefetchQuery({ queryKey: ["bounty", "listMyOpenRequests", userId], queryFn: () => bounty.listMyOpenRequests(userId), staleTime: LIST_STALE_MS }) : undefined,
        userId ? queryClient.prefetchQuery({ queryKey: ["bounty", "listMyClaims", userId], queryFn: () => bounty.listMyClaims(userId), staleTime: LIST_STALE_MS }) : undefined,
        userId ? queryClient.prefetchQuery({ queryKey: ["bounty", "getMyRecord", userId], queryFn: () => bounty.getMyRecord(userId), staleTime: SLOW_STALE_MS }) : undefined,
      ]);
    },
    Placeholder: OpenBuildsPlaceholder,
    frame: { board: true },
  },
  library: {
    key: "library",
    pattern: SITE_NAV.library,
    signedIn: true,
    load: () => import("@/pages/site/library/LibraryPage"),
    /* SV-09: the first screen is the saves (with their count) and the collections, started together. */
    prefetch: async (_params, queryClient, { userId }) => {
      if (!userId) return;
      const [{ listMySavedBuilds }, { listCollections }, { LIBRARY_SAVED_KEY, LIBRARY_COLLECTIONS_KEY }] = await Promise.all([
        import("@/lib/social"),
        import("@/lib/library"),
        import("@/components/library/addToCollection"),
      ]);
      await Promise.all([
        queryClient.prefetchInfiniteQuery({
          queryKey: [LIBRARY_SAVED_KEY],
          initialPageParam: undefined as string | undefined,
          queryFn: ({ pageParam }) => listMySavedBuilds({ before: pageParam }),
          getNextPageParam: (last) => last.nextBefore ?? undefined,
          pages: 1,
        }),
        queryClient.prefetchQuery({ queryKey: [LIBRARY_COLLECTIONS_KEY, "mine"], queryFn: () => listCollections() }),
      ]);
    },
    Placeholder: LibraryPlaceholder,
    frame: { board: true },
  },
  drafts: {
    key: "drafts",
    pattern: SITE_NAV.drafts,
    signedIn: true,
    load: () => import("@/pages/site/drafts/DraftsPage"),
    prefetch: async (_params, queryClient, { userId }) => {
      if (!userId) return;
      const { listDraftsWithSessions } = await import("@/lib/build/drafts");
      await queryClient.prefetchQuery({
        queryKey: ["build", "listDraftsWithSessions", userId],
        queryFn: () => listDraftsWithSessions(userId),
        staleTime: LIST_STALE_MS,
      });
    },
    Placeholder: DraftsPlaceholder,
    frame: { board: true },
  },
  create: {
    key: "create",
    pattern: ["/compose/:buildId", "/compose/new"],
    signedIn: true,
    load: async () => {
      const { preloadComposeRoute, preloadComposer } = await import("@/pages/site/compose/preload");
      void preloadComposeRoute();
      return preloadComposer() as Promise<{ default: ComponentType<never> }>;
    },
    prefetch: async ({ buildId }, queryClient, { userId }) => {
      if (!userId || !buildId || buildId === "new" || buildId === "start") return;
      const { startComposerReads } = await import("@/pages/site/compose/composerOpen");
      startComposerReads(queryClient, buildId);
    },
    Placeholder: ComposerPlaceholder,
    frame: SANDBOX_COMPOSER_ENABLED ? { wide: true, SkipLink: SkipToBuild } : undefined,
  },
  build: {
    key: "build",
    pattern: "/b2/:slug",
    signedIn: false,
    load: () => import("@/pages/site/build/BuildPage"),
    prefetch: async ({ slug }, queryClient) => {
      if (!slug) return;
      const { getBuildBySlug } = await import("@/lib/build/builds");
      await queryClient.prefetchQuery({ queryKey: ["build", "getBuildBySlug", slug], queryFn: () => getBuildBySlug(slug), staleTime: 60_000 });
    },
    Placeholder: BuildPlaceholder,
  },
  profile: {
    key: "profile",
    pattern: ["/profile/:handle", SITE_NAV.profile],
    signedIn: false,
    load: () => import("@/pages/site/profile/ProfilePage"),
    prefetch: async ({ handle }, queryClient, { userId }) => {
      const lookup = handle ?? userId;
      if (!lookup) return;
      const { getProfileSummary } = await import("@/lib/profile/getProfileSummary");
      await queryClient.prefetchQuery({
        queryKey: ["profile", "getProfileSummary", lookup, userId],
        queryFn: () => getProfileSummary(lookup, userId),
        staleTime: 60_000,
      });
    },
    Placeholder: ProfilePlaceholder,
  },
};

export interface RouteMatch {
  entry: RouteEntry;
  params: RouteParams;
}

/** The entry that answers a path, with the parameters it carried. Nothing for an address the table does not hold. */
export function matchRoute(pathname: string): RouteMatch | null {
  for (const entry of Object.values(ROUTE_TABLE)) {
    for (const pattern of Array.isArray(entry.pattern) ? entry.pattern : [entry.pattern as string]) {
      const found = matchPath({ path: pattern, end: true }, pathname);
      if (found) return { entry, params: found.params as RouteParams };
    }
  }
  return null;
}
