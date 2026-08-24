// The compose workspace's view of this build's explanation layers.
//
// ONE QUERY, TWO CONSUMERS. The publish control asks whether there is anything
// to review; the staleness line asks whether what exists still matches the
// record. Both call this hook, both land on the same react-query key, and the
// build_layers table is read once per workspace rather than once per surface.
//
// NOTHING HERE CALLS THE GENERATOR. Reading rows is free; writing them costs a
// model call and can overwrite a creator's words, so every generation in the
// app comes from a press — the review pass at publish, or the one line that
// offers to rewrite a stale layer. There is no effect in this file that could
// become a schedule later.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLayers,
  hashNodeTree,
  shouldOfferLayerReview,
  staleLayers,
  type BuildLayer,
  type NodeTree,
} from "@/lib/build";

const NO_LAYERS: BuildLayer[] = [];

export function buildLayersQueryKey(buildId: string | undefined) {
  return ["build-layers", buildId] as const;
}

export interface BuildLayers {
  /** Every layer this build has, approved or not. */
  layers: BuildLayer[];
  /** The current record's hash, or null while it computes / where it cannot. */
  hash: string | null;
  /** The layers written from a record that has since moved on. */
  stale: BuildLayer[];
  isLoading: boolean;
  /**
   * The rows, fetching them first if they are not in hand yet.
   *
   * Publish presses this before deciding whether to offer the review, so a
   * creator who publishes the moment the workspace opens is asked the same
   * question as one who has been editing for ten minutes.
   */
  ensure: () => Promise<BuildLayer[]>;
  /** Whether pressing Publish should offer the review pass. */
  shouldOffer: (rows?: BuildLayer[]) => boolean;
  /** Fold rows the review pass just wrote into the cache. */
  applyLayers: (rows: BuildLayer[]) => void;
}

export function useBuildLayers(
  buildId: string | undefined,
  tree: NodeTree[]
): BuildLayers {
  const queryClient = useQueryClient();

  const query = useQuery<BuildLayer[]>({
    queryKey: buildLayersQueryKey(buildId),
    queryFn: () => getLayers(buildId as string),
    enabled: Boolean(buildId),
    // Two rows that only this workspace writes. Refetching on focus would ask
    // the database to confirm what the app just told it.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  /**
   * The record's hash, recomputed whenever the tree changes.
   *
   * Asynchronous because SubtleCrypto is, and null until it lands — every
   * reader of it treats null as "cannot tell yet" and shows nothing rather
   * than guessing.
   */
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void hashNodeTree(tree).then((value) => {
      if (!cancelled) setHash(value);
    });
    return () => {
      cancelled = true;
    };
  }, [tree]);

  const layers = query.data ?? NO_LAYERS;

  const stale = useMemo(() => staleLayers(layers, hash), [layers, hash]);

  const ensure = useCallback(async (): Promise<BuildLayer[]> => {
    if (!buildId) return NO_LAYERS;
    return queryClient.ensureQueryData({
      queryKey: buildLayersQueryKey(buildId),
      queryFn: () => getLayers(buildId),
      staleTime: Infinity,
    });
  }, [buildId, queryClient]);

  const shouldOffer = useCallback(
    (rows?: BuildLayer[]) =>
      Boolean(buildId) &&
      shouldOfferLayerReview({
        buildId: buildId as string,
        tree,
        layers: rows ?? layers,
        hash,
      }),
    [buildId, hash, layers, tree]
  );

  const applyLayers = useCallback(
    (rows: BuildLayer[]) => {
      if (!buildId || rows.length === 0) return;
      queryClient.setQueryData<BuildLayer[]>(
        buildLayersQueryKey(buildId),
        (previous) => {
          const next = [...(previous ?? [])];
          for (const row of rows) {
            const index = next.findIndex((entry) => entry.layer === row.layer);
            if (index >= 0) next[index] = row;
            else next.push(row);
          }
          return next;
        }
      );
    },
    [buildId, queryClient]
  );

  return {
    layers,
    hash,
    stale,
    isLoading: query.isPending,
    ensure,
    shouldOffer,
    applyLayers,
  };
}
