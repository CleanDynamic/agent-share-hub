// SV-03 P3: what opening a draft reads before the page is on screen, started together.
//
// The page's own hooks ask for these on mount, which is after the composer's code has downloaded. Starting them from the
// route, on the same keys, moves them in front of that download: the hooks then find the data fresh (or already on its
// way) and make no second request. Each is its own promise (prefetchQuery on its own key); none waits for another.
// The record carries the node types through the one shared key (nodeTypesKey), so it asks the registry once.

import type { QueryClient } from "@tanstack/react-query";

import { composeBuildQueryKey } from "@/hooks/composeBuildQueryKey";
import { fetchNodeTypes } from "@/hooks/useNodeType";
import { getBuild } from "@/lib/build/builds";
import { listBuildSessionRows } from "@/lib/build/buildSessions";
import { getMadeWith } from "@/lib/build/making";
import { listBuildSessions } from "@/lib/build/sessions";

import { buildSessionRowsKey, buildSessionsKey, madeWithKey } from "./useComposeSessions";

const STALE_MS = 30_000;

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
}
