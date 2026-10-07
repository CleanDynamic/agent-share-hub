/* UI-P48 — the composer's node writes: one queue, and an overlay that keeps
   them on screen.

   ONE QUEUE. Every node the composer writes (a prompt, the breakage, the gap)
   goes through `run`, one at a time and in order. Each write reads the tree as
   the write before it left it, so the next position is never handed out twice,
   and a reorder never reads a row that a text save is about to change.

   THE OVERLAY. Each write's result is kept by node id (null once deleted) and
   laid over the record's tree (`applyNodeWrites`). The record is read again
   now and then (a cover added, a retry), and a read that began before a write
   landed must not take that write off the screen. The overlay is also put back
   into the query cache, so `useComposeBuild`'s completeness, and with it
   Publish, counts what was just written.

   A DIFFERENT BUILD drops the overlay. The writes belong to the build their
   nodes name; the first change on /compose/new makes the build before the
   address follows it, and those writes stay. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import type { BuildNode, BuildRecord, NodeTree } from "@/lib/build";

import { applyNodeWrites } from "./composeModel";

const NO_WRITES: ReadonlyMap<string, BuildNode | null> = new Map();

export interface ComposeNodes {
  /** The record's tree with the composer's writes laid over it. */
  tree: NodeTree[];
  /** The same, as it stands at this moment: for a write that runs after others. */
  current: () => NodeTree[];
  /** Run a write after every write queued before it. */
  run: <T>(task: () => Promise<T>) => Promise<T>;
  /** Keep a node as written; null when it was deleted. */
  record: (id: string, node: BuildNode | null) => void;
  /** Resolves once every write queued so far has finished, failed or not. */
  settled: () => Promise<void>;
}

/** A tree node as the row it is: the columns, without its children. */
export function rowOf(node: NodeTree): BuildNode {
  const { children: _children, ...row } = node;
  return row;
}

export function useComposeNodes(buildId: string | undefined, recordTree: NodeTree[]): ComposeNodes {
  const queryClient = useQueryClient();
  const writes = useRef(new Map<string, BuildNode | null>());
  /** The build the writes belong to. */
  const owner = useRef<string | null>(null);
  const [version, setVersion] = useState(0);

  const buildIdRef = useRef(buildId);
  buildIdRef.current = buildId;
  const recordRef = useRef(recordTree);
  recordRef.current = recordTree;

  /** The writes, unless the page has moved on to another build. */
  const overlay = useCallback(
    () => (owner.current && buildIdRef.current && owner.current !== buildIdRef.current ? NO_WRITES : writes.current),
    [],
  );

  const record = useCallback((id: string, node: BuildNode | null) => {
    const build = node?.build_id ?? buildIdRef.current ?? null;
    if (build && owner.current !== build) {
      writes.current = new Map();
      owner.current = build;
    }
    writes.current.set(id, node);
    setVersion((value) => value + 1);
  }, []);

  // `version` and `buildId` stand for the refs read inside.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tree = useMemo(() => applyNodeWrites(recordTree, overlay()), [recordTree, version, buildId, overlay]);
  const current = useCallback(() => applyNodeWrites(recordRef.current, overlay()), [overlay]);

  /* Put the writes into the record's cache too, so the hook that owns the
     record (and its completeness) sees them. Converges: once the cache holds
     them, applying them again changes nothing. */
  useEffect(() => {
    if (!buildId) return;
    const key = composeBuildQueryKey(buildId);
    const data = queryClient.getQueryData<BuildRecord | null>(key);
    if (!data) return;
    const next = applyNodeWrites(data.tree, overlay());
    if (next !== data.tree) queryClient.setQueryData<BuildRecord | null>(key, { ...data, tree: next });
  }, [buildId, recordTree, version, overlay, queryClient]);

  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const run = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(task);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);
  const settled = useCallback(() => queue.current.then(() => undefined), []);

  return useMemo(() => ({ tree, current, run, record, settled }), [tree, current, run, record, settled]);
}
