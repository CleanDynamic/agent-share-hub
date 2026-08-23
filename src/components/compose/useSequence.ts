// The sequence half of the compose workspace: its record and its write path.
//
// WHY A SECOND QUERY, NOT useComposeBuild.events
// ----------------------------------------------
// getBuild composes its record with getEvents on default arguments, and those
// defaults drop hidden events in the query. That is exactly right for every
// reader — the public build page, the portable export, the replay NS-P16 will
// add — because an event a creator hid must not cross the wire at all.
//
// It is wrong for precisely one surface: this one. A creator who hides an event
// by mistake has to be able to see it again to reverse it, and a hide they
// cannot undo is a worse privacy control than no hide at all. So the editor
// asks for the full sequence explicitly, under its own query key, and the
// filtered read stays the default everywhere else. Nothing in src/lib/build/
// changes to allow it — getEvents already takes includeHidden.
//
// THE WRITE PATH
// --------------
// Local state leads and the row reconciles, the same bargain useComposeBuild
// strikes for the header. Patches accumulate per event id and flush together,
// so a creator clicking Kept then Folded then Hidden on one row while making up
// their mind writes once, not three times.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getEvents, setEventVisibility, upsertEvent, upsertNode } from "@/lib/build";
import type {
  BuildEvent,
  BuildNode,
  BuildRecord,
  EventKind,
  EventVisibility,
  NodeTree,
} from "@/lib/build";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";

/** Long enough to swallow a creator changing their mind mid-click, short enough
 *  that the write is gone before they look for it. Matches the header's intent
 *  at half its length: a segmented control settles faster than a sentence. */
export const SEQUENCE_DEBOUNCE_MS = 400;

/** Stable identity, so a consumer's useMemo over an empty sequence does not
 *  re-run on every render of this hook. */
const NO_EVENTS: BuildEvent[] = [];

export function sequenceQueryKey(buildId: string | undefined) {
  return ["compose-events", buildId] as const;
}

/** The columns of an event this panel is allowed to change. Ordinals are not
 *  among them: reordering the sequence is reorderEvents' job, and nothing in
 *  NS-P15 reorders. */
export interface SequencePatch {
  visibility?: EventVisibility;
  kind?: EventKind;
  phase?: number | null;
  phase_title?: string | null;
}

export interface Sequence {
  /** Ordinal order, hidden events included. */
  events: BuildEvent[];
  isLoading: boolean;
  loadError: Error | null;
  /** True while a debounced flush is pending or in flight. */
  isWriting: boolean;
  /** Apply one patch to one or many events. One action, one flush. */
  patchEvents: (ids: string[], patch: SequencePatch) => void;
  /** Join an event to the node it produced, in both directions. */
  linkNode: (eventId: string, nodeId: string | null) => void;
}

/** Every node of the build, placed and trayed, flattened once. */
export function flattenNodes(tree: NodeTree[], tray: BuildNode[]): BuildNode[] {
  const out: BuildNode[] = [];
  const walk = (nodes: NodeTree[]) => {
    for (const node of nodes) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(tree);
  return [...out, ...tray];
}

/** A node row as it stands in the composed record, addressed by id. */
function findRecordNode(record: BuildRecord | null | undefined, id: string): BuildNode | null {
  if (!record) return null;
  return flattenNodes(record.tree, record.tray).find((node) => node.id === id) ?? null;
}

/** Rewrite one node wherever it sits in the record — placed, nested or trayed. */
function patchRecordNode(
  record: BuildRecord,
  id: string,
  patch: Partial<BuildNode>
): BuildRecord {
  const walk = (nodes: NodeTree[]): NodeTree[] =>
    nodes.map((node) =>
      node.id === id
        ? { ...node, ...patch, children: walk(node.children) }
        : { ...node, children: walk(node.children) }
    );
  return {
    ...record,
    tree: walk(record.tree),
    tray: record.tray.map((node) => (node.id === id ? { ...node, ...patch } : node)),
  };
}

interface UseSequenceArgs {
  buildId: string | undefined;
  /** False until the creator has opened the Sequence tab. The compose route is
   *  already the heaviest page in the application; a creator who never leaves
   *  Anatomy should not pay for a query they never look at. */
  active: boolean;
}

export function useSequence({ buildId, active }: UseSequenceArgs): Sequence {
  const queryClient = useQueryClient();
  const queryKey = sequenceQueryKey(buildId);
  const recordKey = composeBuildQueryKey(buildId);

  const query = useQuery<BuildEvent[]>({
    queryKey,
    // The one read in the application that asks for hidden events. See above.
    queryFn: () => getEvents(buildId as string, { includeHidden: true }),
    enabled: Boolean(buildId) && active,
    // This panel is the only writer on these rows while it is open, so a
    // refetch can only arrive stale and fight the optimistic overlay.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const [isWriting, setIsWriting] = useState(false);

  /** Patches accumulated since the last flush, merged per event id. */
  const pendingRef = useRef(new Map<string, SequencePatch>());
  /** What the sequence looked like before the pending batch started, so a
   *  failed flush can put the creator's view back where it was. */
  const baselineRef = useRef<BuildEvent[] | null>(null);
  const timerRef = useRef<number | null>(null);
  /** Writes run one at a time. Two overlapping flushes over the same rows
   *  would race, and the loser would quietly win. */
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const failed = useCallback(
    (what: string, cause: unknown, snapshot: BuildEvent[] | null) => {
      if (snapshot) queryClient.setQueryData<BuildEvent[]>(queryKey, snapshot);
      toast.error(what, {
        description: cause instanceof Error ? cause.message : String(cause),
      });
      // The snapshot restores what the creator saw; the refetch restores what
      // the server actually holds, in case an earlier write had already landed.
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: recordKey });
    },
    [queryClient, queryKey, recordKey]
  );

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    if (pending.size === 0) return;
    pendingRef.current = new Map();
    const snapshot = baselineRef.current;
    baselineRef.current = null;

    // The rows as they stand after the optimistic update, so an upsert carries
    // the NOT NULL columns PostgREST demands alongside the changed ones.
    const rows = new Map(
      (queryClient.getQueryData<BuildEvent[]>(queryKey) ?? []).map((event) => [event.id, event])
    );

    const writes = [...pending.entries()].map(([id, patch]) => {
      const keys = Object.keys(patch);
      // Visibility on its own is the common case by far, and it has a
      // purpose-built accessor that touches one column. Use it.
      if (keys.length === 1 && keys[0] === "visibility") {
        return setEventVisibility(id, patch.visibility as EventVisibility);
      }
      const row = rows.get(id);
      if (!row) return Promise.resolve();
      return upsertEvent({ ...row, ...patch });
    });

    setIsWriting(true);
    chainRef.current = chainRef.current
      .then(() => Promise.all(writes))
      .then(
        () => {
          if (mountedRef.current && pendingRef.current.size === 0) setIsWriting(false);
        },
        (cause: unknown) => {
          if (mountedRef.current) setIsWriting(false);
          failed("Could not save the sequence", cause, snapshot);
        }
      );
  }, [failed, queryClient, queryKey]);

  const flushRef = useRef(flush);
  flushRef.current = flush;

  const patchEvents = useCallback(
    (ids: string[], patch: SequencePatch) => {
      if (ids.length === 0) return;
      const current = queryClient.getQueryData<BuildEvent[]>(queryKey);
      if (!current) return;

      // One baseline per batch: the first patch after a flush records what to
      // roll back to, and everything that lands before the timer fires shares it.
      if (baselineRef.current === null) baselineRef.current = current;

      const target = new Set(ids);
      queryClient.setQueryData<BuildEvent[]>(
        queryKey,
        current.map((event) => (target.has(event.id) ? { ...event, ...patch } : event))
      );

      for (const id of ids) {
        pendingRef.current.set(id, { ...pendingRef.current.get(id), ...patch });
      }

      setIsWriting(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        flushRef.current();
      }, SEQUENCE_DEBOUNCE_MS);
    },
    [queryClient, queryKey]
  );

  /**
   * The join between the two dimensions, written from both ends.
   *
   * build_events.produced_node_id and build_nodes.event_id are one relationship
   * stored twice, and a replay that reads either one has to find the same
   * answer. So a link is four possible writes, not one: the new pair, plus
   * whatever each end was pointing at before. Leaving the old side dangling is
   * how a node ends up claiming an event that has since moved on.
   *
   * Not debounced. A link is a deliberate, discrete act — a creator does not
   * click through three nodes to settle on one the way they click through three
   * visibility states.
   */
  const linkNode = useCallback(
    (eventId: string, nodeId: string | null) => {
      const events = queryClient.getQueryData<BuildEvent[]>(queryKey);
      const record = queryClient.getQueryData<BuildRecord | null>(recordKey);
      if (!events) return;

      const event = events.find((candidate) => candidate.id === eventId);
      if (!event || event.produced_node_id === nodeId) return;

      const previousNodeId = event.produced_node_id;
      // The node being linked may already belong to another event. That event
      // loses the claim, because a node has one producing event.
      const displaced = nodeId
        ? events.find((other) => other.id !== eventId && other.produced_node_id === nodeId)
        : undefined;

      const targetNode = nodeId ? findRecordNode(record, nodeId) : null;
      const previousNode = previousNodeId ? findRecordNode(record, previousNodeId) : null;

      const eventsSnapshot = events;
      const recordSnapshot = record;

      queryClient.setQueryData<BuildEvent[]>(
        queryKey,
        events.map((candidate) => {
          if (candidate.id === eventId) return { ...candidate, produced_node_id: nodeId };
          if (displaced && candidate.id === displaced.id) {
            return { ...candidate, produced_node_id: null };
          }
          return candidate;
        })
      );

      if (record) {
        let next = record;
        if (previousNode && previousNode.id !== nodeId) {
          next = patchRecordNode(next, previousNode.id, { event_id: null });
        }
        if (targetNode) next = patchRecordNode(next, targetNode.id, { event_id: eventId });
        queryClient.setQueryData<BuildRecord | null>(recordKey, next);
      }

      setIsWriting(true);
      chainRef.current = chainRef.current
        .then(async () => {
          await upsertEvent({ ...event, produced_node_id: nodeId });
          if (displaced) await upsertEvent({ ...displaced, produced_node_id: null });
          if (targetNode) await upsertNode({ ...targetNode, event_id: eventId });
          if (previousNode && previousNode.id !== nodeId) {
            await upsertNode({ ...previousNode, event_id: null });
          }
        })
        .then(
          () => {
            if (mountedRef.current && pendingRef.current.size === 0) setIsWriting(false);
          },
          (cause: unknown) => {
            if (mountedRef.current) setIsWriting(false);
            if (recordSnapshot) {
              queryClient.setQueryData<BuildRecord | null>(recordKey, recordSnapshot);
            }
            failed("Could not link the event to that node", cause, eventsSnapshot);
          }
        );
    },
    [failed, queryClient, queryKey, recordKey]
  );

  const events = query.data ?? NO_EVENTS;

  return useMemo<Sequence>(
    () => ({
      events,
      isLoading: query.isLoading,
      loadError: (query.error as Error | null) ?? null,
      isWriting,
      patchEvents,
      linkNode,
    }),
    [events, isWriting, linkNode, patchEvents, query.error, query.isLoading]
  );
}
