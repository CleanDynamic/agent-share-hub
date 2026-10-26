// SV-03 P3: what opening a draft reads before the page is on screen, started together.
//
// The page's own hooks ask for these on mount, which is after the composer's code has downloaded. Starting them from the
// route, on the same keys, moves them in front of that download: the hooks then find the data fresh (or already on its
// way) and make no second request. Each is its own promise (prefetchQuery on its own key); none waits for another.
// The record carries the node types through the one shared key (nodeTypesKey), so it asks the registry once.

import type { QueryClient } from "@tanstack/react-query";

import { composeBuildQueryKey } from "@/hooks/composeBuildQueryKey";
import { librarySessionsKey } from "@/hooks/useLibrarySessions";
import { fetchNodeTypes } from "@/hooks/useNodeType";
import { getBuild } from "@/lib/build/builds";
import { listBuildSessionRows } from "@/lib/build/buildSessions";
import { getMadeWith } from "@/lib/build/making";
import { listBuildSessions, listLibrarySessions, LIBRARY_PAGE } from "@/lib/build/sessions";

import { buildSessionRowsKey, buildSessionsKey, madeWithKey } from "./useComposeSessions";

const STALE_MS = 30_000;

/** SV-04 P4: the session library Sources lists, on useLibrarySessions' key: the composer is ready when it is in (a new
    build has nothing else to wait for), so it is started with the rest rather than when the page mounts. */
export function startLibraryRead(queryClient: QueryClient): void {
  void queryClient.prefetchInfiniteQuery({
    queryKey: librarySessionsKey,
    queryFn: ({ pageParam }) => listLibrarySessions({ offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length * LIBRARY_PAGE : undefined),
    staleTime: STALE_MS,
  });
}

/** Start the draft's first-screen reads. Safe to call twice: a read already on its way is not asked for again. */
export function startComposerReads(queryClient: QueryClient, buildId: string): void {
  void queryClient.prefetchQuery({
    queryKey: composeBuildQueryKey(buildId),
    queryFn: () => getBuild(buildId, { nodeTypes: () => fetchNodeTypes(queryClient) }),
    staleTime: Infinity,
  });
  void queryClient.prefetchQuery({ queryKey: buildSessionsKey(buildId), queryFn: () => listBuildSessions(buildId), staleTime: STALE_MS });
  void queryClient.prefetchQuery({ queryKey: buildSessionRowsKey(buildId), queryFn: () => listBuildSessionRows(buildId), staleTime: STALE_MS });
  void queryClient.prefetchQuery({ queryKey: madeWithKey(buildId), queryFn: () => getMadeWith(buildId), staleTime: Infinity });
  startLibraryRead(queryClient);
}
