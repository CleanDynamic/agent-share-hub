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
// it runs. `gallery` is `/builds` and `openbuilds` is `/openbuilds`.

import type { QueryClient } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { matchPath } from "react-router-dom";

import { SITE_NAV } from "@/components/shell/siteNav";
import { SANDBOX_COMPOSER_ENABLED } from "@/lib/build/flags";
import { SkipToBuild } from "@/pages/site/compose/SkipToBuild";
import { SignInFallback } from "@/pages/site/signin/SignInFallback";
import { LIST_STALE_MS, SLOW_STALE_MS } from "@/lib/query/client";

import {
  BuildPlaceholder,
  BuildsPlaceholder,
  ComposerPlaceholder,
  DraftsPlaceholder,
  HomePlaceholder,
  LegalPlaceholder,
  LibraryPlaceholder,
  OpenBuildsFeedPlaceholder,
  PostPlaceholder,
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
      const [{ getBuildFeed }, signals, { listPosts, postKey }, { listDraftsWithSessions, listDraftFirstPrompts }, { weekStartUtc }, { listPublishedBuildsByCreator }, { HOME_BUILD_ROWS, STILL_OPEN_SHOWN }] = await Promise.all([
        import("@/lib/feed/getBuildFeed"),
        import("@/lib/build/signals"),
        import("@/lib/openbuilds"),
        import("@/lib/build/drafts"),
        import("@/lib/progress/weekly"),
        import("@/lib/build/builds"),
        import("@/pages/site/home/homeModel"),
      ]);
      const weekStart = weekStartUtc(new Date()).toISOString();
      await Promise.all([
        queryClient.prefetchInfiniteQuery({
          queryKey: ["feed", "getBuildFeed", "everyone"],
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
        // UX-08 P3: Still open (the topics still waiting for a piece), where the Open requests read was. Same key as HomePage.
        queryClient.prefetchQuery({
          queryKey: postKey("listPosts", userId ? "spaces" : "everyone", "stillOpen", STILL_OPEN_SHOWN),
          queryFn: () => listPosts({ scope: userId ? "spaces" : "everyone", stillOpen: true, limit: STILL_OPEN_SHOWN }),
          staleTime: LIST_STALE_MS,
        }),
        userId
          ? queryClient.prefetchQuery({ queryKey: ["build", "listDraftsWithSessions", userId], queryFn: () => listDraftsWithSessions(userId), staleTime: LIST_STALE_MS })
          : undefined,
        userId
          ? queryClient.prefetchQuery({ queryKey: ["build", "listDraftFirstPrompts", userId], queryFn: () => listDraftFirstPrompts(userId), staleTime: LIST_STALE_MS })
          : undefined,
        // UX-03 P6: the maker's live builds, for the room when nothing else in it has anything to show.
        userId
          ? queryClient.prefetchQuery({
              queryKey: ["build", "listPublishedBuildsByCreator", userId, HOME_BUILD_ROWS],
              queryFn: () => listPublishedBuildsByCreator(userId, { limit: HOME_BUILD_ROWS }),
              staleTime: LIST_STALE_MS,
            })
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
  openbuilds: {
    key: "openbuilds",
    pattern: SITE_NAV.openbuilds,
    signedIn: false,
    load: () => import("@/pages/site/openbuilds/OpenBuildsFeedPage"),
    /* UX-05 P2: the feed's first screen: the posts in the address's scope (their cards' extras are inside the read), the
       reader's spaces and the busy spaces, started together. Same keys and functions as OpenBuildsFeedPage. */
    prefetch: async (_params, queryClient, { userId }) => {
      const [lib, model] = await Promise.all([import("@/lib/openbuilds"), import("@/pages/site/openbuilds/openBuildsFeedModel")]);
      const here = window.location.pathname === SITE_NAV.openbuilds ? window.location.search : "";
      const { scope, open } = model.readFeedAddress(new URLSearchParams(here), userId !== null);
      await Promise.all([
        queryClient.prefetchInfiniteQuery({
          queryKey: model.feedKey(scope, open, userId),
          initialPageParam: 0,
          queryFn: ({ pageParam }) => lib.listPostCards({ scope: scope === "mine" ? "spaces" : "everyone", stillOpen: open || undefined, offset: pageParam, limit: model.FEED_PAGE }),
          getNextPageParam: (last) => last.next ?? undefined,
          staleTime: LIST_STALE_MS,
          pages: 1,
        }),
        userId ? queryClient.prefetchQuery({ queryKey: model.mySpacesKey(userId), queryFn: lib.listMySpaces, staleTime: LIST_STALE_MS }) : undefined,
        queryClient.prefetchQuery({ queryKey: model.busySpacesKey, queryFn: () => lib.listBusySpaces({ limit: 8 }), staleTime: SLOW_STALE_MS }),
      ]);
    },
    Placeholder: OpenBuildsFeedPlaceholder,
    frame: { board: "home" },
  },
  /* UX-05 P3: a space's page. Round 1 is the space with its people; its posts need the space's id and order. */
  space: {
    key: "space",
    pattern: "/openbuilds/spaces/:slug",
    signedIn: false,
    load: () => import("@/pages/site/openbuilds/SpacePage"),
    prefetch: async ({ slug }, queryClient, { userId }) => {
      if (!slug) return;
      const [lib, model] = await Promise.all([import("@/lib/openbuilds"), import("@/pages/site/openbuilds/spaceModel")]);
      await queryClient.prefetchQuery({ queryKey: model.spaceCrowdKey(slug, userId), queryFn: () => lib.getSpaceCrowd(slug, userId), staleTime: LIST_STALE_MS });
    },
    Placeholder: OpenBuildsFeedPlaceholder,
    frame: { board: "home" },
  },
  /* UX-06: a post's page, at the address UX-05 gave every post (/openbuilds/posts/:id redirects here). Round 1 is the post with
     its replies; the rest needs the post's ids. Same key and function as PostPage. */
  post: {
    key: "post",
    pattern: "/openbuilds/topics/:id",
    signedIn: false,
    load: () => import("@/pages/site/openbuilds/PostPage"),
    prefetch: async ({ id }, queryClient) => {
      if (!id) return;
      const [lib, model] = await Promise.all([import("@/lib/openbuilds"), import("@/pages/site/openbuilds/postModel")]);
      await queryClient.prefetchQuery({ queryKey: model.postPageKey(id), queryFn: () => lib.getPost(id), staleTime: LIST_STALE_MS });
    },
    Placeholder: PostPlaceholder,
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
      const { listDraftsWithSessions, listDraftFirstPrompts, listDraftTopics } = await import("@/lib/build/drafts");
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: ["build", "listDraftsWithSessions", userId],
          queryFn: () => listDraftsWithSessions(userId),
          staleTime: LIST_STALE_MS,
        }),
        // UX-03 P7: the untitled drafts' first prompts, beside the list.
        queryClient.prefetchQuery({ queryKey: ["build", "listDraftFirstPrompts", userId], queryFn: () => listDraftFirstPrompts(userId), staleTime: LIST_STALE_MS }),
        // UX-09 P3: the topic each draft made in a reply was made for, beside the list.
        queryClient.prefetchQuery({ queryKey: ["build", "listDraftTopics", userId], queryFn: () => listDraftTopics(userId), staleTime: LIST_STALE_MS }),
      ]);
    },
    Placeholder: DraftsPlaceholder,
    frame: { board: true },
  },
  /* UX-01 P9: the sign-in page, so that hovering or focusing the header's Sign in opens its chunk before the press. It sits outside the
     app shell (no placeholder is drawn by a page change): its Placeholder is the fallback `SignInSite` draws while the chunk loads. */
  login: {
    key: "login",
    pattern: "/login",
    signedIn: false,
    load: () => import("@/pages/site/signin/LoginPage"),
    prefetch: () => undefined,
    Placeholder: SignInFallback,
  },
  /* UX-12 P2: the two legal pages. Text only, so nothing is read: each is one chunk and no data request. */
  privacy: {
    key: "privacy",
    pattern: "/privacy",
    signedIn: false,
    load: () => import("@/pages/site/legal/PrivacyPage"),
    prefetch: () => undefined,
    Placeholder: LegalPlaceholder,
  },
  terms: {
    key: "terms",
    pattern: "/terms",
    signedIn: false,
    load: () => import("@/pages/site/legal/TermsPage"),
    prefetch: () => undefined,
    Placeholder: LegalPlaceholder,
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
    /* UX-10 P4: with a handle, the profile, its side column and its feed's first page start together, on the page's keys. The
       feed opens on All here; a profile whose owner opens it on another filter reads that one when the page knows it. */
    prefetch: async ({ handle }, queryClient, { userId }) => {
      const lookup = handle ?? userId;
      if (!lookup) return;
      const [{ getProfileSummary }, { getProfileSide }, { getProfileFeed }] = await Promise.all([
        import("@/lib/profile/getProfileSummary"),
        import("@/lib/profile/profileSide"),
        import("@/lib/profile/getProfileFeed"),
      ]);
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: ["profile", "getProfileSummary", lookup, userId],
          queryFn: () => getProfileSummary(lookup, userId),
          staleTime: 60_000,
        }),
        ...(handle
          ? [
              queryClient.prefetchQuery({ queryKey: ["profile", "getProfileSide", handle, userId], queryFn: () => getProfileSide(handle), staleTime: 60_000 }),
              queryClient.prefetchInfiniteQuery({
                queryKey: ["profile", "getProfileFeed", handle, "all", userId],
                queryFn: ({ pageParam }) => getProfileFeed(handle, { filter: "all", cursor: pageParam as string | null }),
                initialPageParam: null as string | null,
                staleTime: 60_000,
              }),
            ]
          : []),
      ]);
    },
    Placeholder: ProfilePlaceholder,
  },
  /* UX-10 P5b: a person's followers and the people they follow. One round: the profile and the list's first page together. */
  followers: {
    key: "followers",
    pattern: "/profile/:handle/followers",
    signedIn: false,
    load: () => import("@/pages/site/profile/FollowListPage").then((module) => ({ default: module.FollowersPage })),
    prefetch: async ({ handle }, queryClient, { userId }) => prefetchFollows(handle, "followers", queryClient, userId),
    Placeholder: ProfilePlaceholder,
  },
  following: {
    key: "following",
    pattern: "/profile/:handle/following",
    signedIn: false,
    load: () => import("@/pages/site/profile/FollowListPage").then((module) => ({ default: module.FollowingPage })),
    prefetch: async ({ handle }, queryClient, { userId }) => prefetchFollows(handle, "following", queryClient, userId),
    Placeholder: ProfilePlaceholder,
  },
};

/** UX-10 P5b: the follow list's first screen: the profile and the list's first page, on the page's keys. */
async function prefetchFollows(handle: string | undefined, which: "followers" | "following", queryClient: QueryClient, userId: string | null) {
  if (!handle) return;
  const [{ getProfileSummary }, { listProfileFollows }] = await Promise.all([import("@/lib/profile/getProfileSummary"), import("@/lib/profile/followLists")]);
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: ["profile", "getProfileSummary", handle, userId], queryFn: () => getProfileSummary(handle, userId), staleTime: 60_000 }),
    queryClient.prefetchInfiniteQuery({
      queryKey: ["profile", "listProfileFollows", handle, which, userId],
      queryFn: ({ pageParam }) => listProfileFollows(handle, which, pageParam as string | null),
      initialPageParam: null as string | null,
      staleTime: 60_000,
    }),
  ]);
}

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
