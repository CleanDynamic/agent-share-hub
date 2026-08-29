// What the workspace knows about the asks already filed on this build.
//
// One read — listBountiesForBuild, over the idx_bounties_build index — held in
// one query key, so the tree's pill and the publish sheet's section are two
// renderings of one answer rather than two reads that can disagree. The same
// arrangement useRebuildDiff has, and for the same reason.
//
// KEYED BY GAP NODE, because that is the only question either surface asks:
// does THIS node already carry an ask? A build-level bounty — legal in the
// schema, filed with no node named — is deliberately absent from the map. It
// belongs to no row of the tree and there is nothing for the publish section to
// offer about it, since createBountyForGap would be filing a second one.
//
// NOT FILTERED TO OPEN. A solved gap is still a gap that carries an ask, and
// both surfaces need to know the difference: the tree says a bounty is there,
// and the publish section must not offer to file a second one on a node whose
// unique index would refuse it. The status is on every row for a caller that
// wants to say which kind.

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listBountiesForBuild, type Bounty } from "@/lib/bounty";

/** How long the workspace trusts its copy. The creator is the only writer. */
const BOUNTIES_STALE_MS = 60_000;

/** Stable identity for the empty case, so a consumer's memo does not re-run. */
const NO_BOUNTIES: Map<string, Bounty> = new Map();

export function buildBountiesQueryKey(buildId: string | undefined) {
  return ["build-bounties", buildId] as const;
}

export interface BuildBounties {
  /** Gap node id -> the bounty filed against it. Empty until the read lands. */
  byNode: Map<string, Bounty>;
  /** True while the first read is open. Neither surface blocks on it. */
  isLoading: boolean;
  /** Re-read, after this workspace has filed some of its own. */
  refresh: () => Promise<void>;
}

export function useBuildBounties(buildId: string | undefined): BuildBounties {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Bounty[]>({
    queryKey: buildBountiesQueryKey(buildId),
    queryFn: () => listBountiesForBuild(buildId as string),
    enabled: Boolean(buildId),
    staleTime: BOUNTIES_STALE_MS,
    refetchOnWindowFocus: false,
    // A workspace that cannot read its bounties still edits, still publishes
    // and still shows the tree. It just does not paint the pill.
    retry: 1,
  });

  const byNode = useMemo(() => {
    if (!data || data.length === 0) return NO_BOUNTIES;
    const map = new Map<string, Bounty>();
    for (const bounty of data) {
      if (bounty.gap_node_id) map.set(bounty.gap_node_id, bounty);
    }
    return map;
  }, [data]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: buildBountiesQueryKey(buildId) });
  }, [buildId, queryClient]);

  return { byNode, isLoading, refresh };
}
