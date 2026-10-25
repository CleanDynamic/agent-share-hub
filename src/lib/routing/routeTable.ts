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
}


export const ROUTE_TABLE: Record<string, RouteEntry> = {
  home: {
    key: "home",
    pattern: SITE_NAV.home,
    signedIn: false,
    load: () => import("@/pages/site/home/HomePage"),
    prefetch: async (_params, queryClient, { userId }) => {
      const { getBuildFeed } = await import("@/lib/feed/getBuildFeed");
      await queryClient.prefetchInfiniteQuery({
        queryKey: ["feed", "getBuildFeed", "everyone", userId],
        initialPageParam: undefined as string | undefined,
        queryFn: ({ pageParam }) => getBuildFeed({ before: pageParam, onlyFollowing: false }),
        getNextPageParam: (last) => last.nextBefore ?? undefined,
        staleTime: LIST_STALE_MS,
        pages: 1,
      });
    },
    Placeholder: HomePlaceholder,
  },
  gallery: {
    key: "gallery",
    pattern: SITE_NAV.gallery,
    signedIn: false,
    load: () => import("@/pages/site/gallery/GalleryPage"),
    prefetch: async (_params, queryClient) => {
      const { getClassificationFacets, getGalleryFacets } = await import("@/lib/build/gallery");
      await Promise.all([
        queryClient.prefetchQuery({ queryKey: ["build", "getClassificationFacets"], queryFn: getClassificationFacets, staleTime: SLOW_STALE_MS }),
        queryClient.prefetchQuery({ queryKey: ["build", "getGalleryFacets"], queryFn: getGalleryFacets, staleTime: SLOW_STALE_MS }),
      ]);
    },
    Placeholder: BuildsPlaceholder,
  },
  bounties: {
    key: "bounties",
    pattern: SITE_NAV.bounties,
    signedIn: false,
    load: () => import("@/pages/Bounties"),
    prefetch: async (_params, queryClient) => {
      const { listOpenBountyCards, OPEN_BOUNTIES_PAGE_SIZE } = await import("@/lib/bounty");
      await queryClient.prefetchInfiniteQuery({
        queryKey: ["bounty-board"],
        initialPageParam: null as string | null,
        queryFn: ({ pageParam }) => listOpenBountyCards({ limit: OPEN_BOUNTIES_PAGE_SIZE, before: pageParam }),
        getNextPageParam: (last) => last.nextCursor ?? undefined,
        pages: 1,
      });
    },
    Placeholder: OpenBuildsPlaceholder,
  },
  library: {
    key: "library",
    pattern: SITE_NAV.library,
    signedIn: true,
    load: () => import("@/pages/Library"),
    prefetch: async (_params, queryClient, { userId }) => {
      if (!userId) return;
      const [{ listMySavedBuilds }, { LIBRARY_SAVED_KEY }] = await Promise.all([import("@/lib/social"), import("@/components/library/addToCollection")]);
      await queryClient.prefetchInfiniteQuery({
        queryKey: [LIBRARY_SAVED_KEY],
        initialPageParam: undefined as string | undefined,
        queryFn: ({ pageParam }) => listMySavedBuilds({ before: pageParam }),
        getNextPageParam: (last) => last.nextBefore ?? undefined,
        pages: 1,
      });
    },
    Placeholder: LibraryPlaceholder,
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
  },
  create: {
    key: "create",
    pattern: ["/compose/:buildId", "/compose/new"],
    signedIn: true,
    load: async () => (await import("@/pages/site/compose/preload")).preloadComposer() as Promise<{ default: ComponentType<never> }>,
    prefetch: async ({ buildId }, queryClient, { userId }) => {
      if (!userId || !buildId || buildId === "new" || buildId === "start") return;
      const { startComposerReads } = await import("@/pages/site/compose/composerOpen");
      startComposerReads(queryClient, buildId);
    },
    Placeholder: ComposerPlaceholder,
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
