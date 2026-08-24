// The compose workspace's record and its write path.
//
// One hook owns the loaded build for /compose/:buildId. Every read goes through
// src/lib/build/ — this file never touches the Supabase client, so the editor
// and the public page (/b2/:slug) load a build through exactly the same code.
//
// The header write is debounced: a creator typing a title produces one row
// update, not one per keystroke. Local state leads, the server row reconciles.
//
// COMPLETENESS IS COMPUTED HERE AND WRITTEN LIKE ANY OTHER COLUMN. It is not a
// database trigger, and it cannot be: the rules are shape-relative and read the
// node type registry, so they live in TypeScript where the shapes are defined.
// The effect below recomputes on every change to the record and pushes the
// result through patchBuild, which means it is debounced by the same 800ms as a
// title and lands in the same row update rather than in a second one.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { computeCompleteness, getBuild, publishPatch, updateBuild } from "@/lib/build";
import type {
  Build,
  BuildEvent,
  BuildNode,
  BuildPatch,
  BuildRecord,
  Completeness,
  NodeTree,
  NodeType,
} from "@/lib/build";

/** Quiet enough that a sentence of typing is one write, short enough that the
 *  indicator settles while the creator is still looking at the field. */
export const SAVE_DEBOUNCE_MS = 800;

/** Stable identities, so a consumer's useMemo/useEffect on an empty tree does
 *  not re-run on every render of this hook. */
const NO_TREE: NodeTree[] = [];
const NO_TRAY: BuildNode[] = [];
const NO_EVENTS: BuildEvent[] = [];
const NO_NODE_TYPES: NodeType[] = [];

export function composeBuildQueryKey(buildId: string | undefined) {
  return ["compose-build", buildId] as const;
}

export interface ComposeBuild {
  build: Build | null;
  tree: NodeTree[];
  tray: BuildNode[];
  events: BuildEvent[];
  nodeTypes: NodeType[];
  /**
   * What this shape's record is still missing, recomputed from local state.
   * null until the record has loaded. The panel that renders it does not
   * compute its own — one answer per render, and it is this one.
   */
  completeness: Completeness | null;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  /** Merge a header patch into local state now, write it through after 800ms. */
  patchBuild: (patch: BuildPatch) => void;
  /**
   * Set the build live, carrying any unsaved header edits with it.
   *
   * ONE WRITE, not two: a creator who types their outcome and clicks Publish
   * a moment later would otherwise race a debounced save against a status
   * update. Resolves with the row as it stands after the write.
   */
  publish: () => Promise<Build>;
  isPublishing: boolean;
  publishError: Error | null;
  isSaving: boolean;
  lastSavedAt: Date | null;
  // --- beyond the exposed contract, for the route's gates ---
  isLoading: boolean;
  /** False until the record has loaded AND its creator is the session user. */
  isOwner: boolean;
  loadError: Error | null;
  saveError: Error | null;
}

export function useComposeBuild(buildId: string | undefined): ComposeBuild {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<BuildRecord | null>({
    queryKey: composeBuildQueryKey(buildId),
    queryFn: () => getBuild(buildId as string),
    enabled: Boolean(buildId),
    // The editor is the only writer on this record while it is open, so a
    // refetch can only arrive stale and fight the optimistic overlay below.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  /**
   * Unsaved local edits, keyed by column, laid over the loaded row.
   *
   * An overlay rather than a copy of the record: the loaded row stays the one
   * the query holds, so reconciling a response is deleting the keys it covered
   * rather than merging two whole builds and hoping the newer one wins.
   */
  const [overlay, setOverlay] = useState<BuildPatch>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<Error | null>(null);

  /** Edits accumulated since the last write went out. */
  const pendingRef = useRef<BuildPatch>({});
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  /** The write currently open, so publish can wait for it rather than race it. */
  const settleRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);
  const buildIdRef = useRef<string | undefined>(buildId);
  buildIdRef.current = buildId;

  /** A write is only ever issued for a build the session user owns. The RLS
   *  policy says the same thing; this keeps a non-owner's editor from even
   *  asking, so a forbidden view issues no request at all. */
  const isOwner = Boolean(
    query.data?.build && user && query.data.build.creator_id === user.id
  );
  const isOwnerRef = useRef(isOwner);
  isOwnerRef.current = isOwner;

  const flushRef = useRef<() => Promise<void>>(async () => {});

  const schedule = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      settleRef.current = flushRef.current();
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const flush = useCallback(async () => {
    // A save is already open. Whatever has landed since goes out when it
    // returns, so firing a second overlapping update would only race it.
    if (inFlightRef.current) return;

    const id = buildIdRef.current;
    const patch = pendingRef.current;
    if (!id || !isOwnerRef.current || Object.keys(patch).length === 0) return;

    pendingRef.current = {};
    inFlightRef.current = true;
    setIsSaving(true);

    try {
      const row = await updateBuild(id, patch);
      if (!mountedRef.current || buildIdRef.current !== id) return;

      // The row is authoritative for the keys it just wrote. Keys typed while
      // the request was open are newer than it, so they stay in the overlay.
      queryClient.setQueryData<BuildRecord | null>(
        composeBuildQueryKey(id),
        (previous) => (previous ? { ...previous, build: row } : previous)
      );
      setOverlay((current) => {
        const next = { ...current };
        for (const key of Object.keys(patch)) {
          if (!(key in pendingRef.current)) delete next[key as keyof BuildPatch];
        }
        return next;
      });
      setSaveError(null);
      setLastSavedAt(new Date());
    } catch (cause) {
      if (!mountedRef.current || buildIdRef.current !== id) return;
      // Put the failed keys back so the next flush retries them, without
      // overwriting anything the creator has typed since.
      pendingRef.current = { ...patch, ...pendingRef.current };
      setSaveError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current && buildIdRef.current === id) {
        setIsSaving(false);
        if (Object.keys(pendingRef.current).length > 0) schedule();
      }
    }
  }, [queryClient, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const patchBuild = useCallback(
    (patch: BuildPatch) => {
      if (!buildIdRef.current || !isOwnerRef.current) return;
      if (Object.keys(patch).length === 0) return;
      setOverlay((current) => ({ ...current, ...patch }));
      pendingRef.current = { ...pendingRef.current, ...patch };
      schedule();
    },
    [schedule]
  );

  // A different build is a different record: drop the previous one's unsaved
  // edits and selection rather than laying them over the new row.
  useEffect(() => {
    setOverlay({});
    setSelectedNodeId(null);
    setLastSavedAt(null);
    setSaveError(null);
    setPublishError(null);
    pendingRef.current = {};
  }, [buildId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);

      // Leaving the workspace mid-debounce must not lose the last sentence
      // typed. Fire and forget: the component is going away, so there is
      // nothing left to reconcile the response against.
      const id = buildIdRef.current;
      const patch = pendingRef.current;
      pendingRef.current = {};
      if (id && isOwnerRef.current && Object.keys(patch).length > 0) {
        void updateBuild(id, patch).catch(() => {
          /* unmounted: nowhere to surface this */
        });
      }
    };
  }, []);

  const build = useMemo(() => {
    const loaded = query.data?.build ?? null;
    if (!loaded) return null;
    return Object.keys(overlay).length > 0
      ? ({ ...loaded, ...overlay } as Build)
      : loaded;
  }, [query.data?.build, overlay]);

  const tree = query.data?.tree ?? NO_TREE;
  const nodeTypes = query.data?.nodeTypes ?? NO_NODE_TYPES;

  /** Off the OVERLAID build, so a cost typed a moment ago already counts. */
  const completeness = useMemo(
    () => (build ? computeCompleteness(build, tree, nodeTypes) : null),
    [build, nodeTypes, tree]
  );

  // Writing it back converges: patchBuild puts the new number in the overlay,
  // which is what `build` is read through, so the next run of this effect finds
  // the column already equal to the computed value and does nothing.
  useEffect(() => {
    if (!build || !completeness) return;
    if (build.completeness === completeness.score) return;
    patchBuild({ completeness: completeness.score });
  }, [build, completeness, patchBuild]);

  /** The overlaid build, for publish — a callback cannot close over a memo. */
  const buildRef = useRef<Build | null>(null);
  buildRef.current = build;

  /**
   * Publish, folding any unsaved header edits into the same row update.
   *
   * WHY IT DOES NOT CALL publishBuild. That helper issues its own write, which
   * would race the debounced one this hook may already have open — a creator
   * typing their outcome and clicking Publish a second later is the ordinary
   * case, not a corner. Here the pending patch and the publish columns go out
   * together, after whatever write is already in flight has landed.
   */
  const publish = useCallback(async (): Promise<Build> => {
    const id = buildIdRef.current;
    const current = buildRef.current;
    if (!id || !current) throw new Error("There is no build to publish.");
    if (!isOwnerRef.current) {
      throw new Error("Only a build's creator can publish it.");
    }

    setIsPublishing(true);
    try {
      // Let an open save land first. The publish write touches the same row
      // and must not overtake it.
      if (settleRef.current) await settleRef.current.catch(() => {});

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const pending = pendingRef.current;
      pendingRef.current = {};
      const patch: BuildPatch = { ...pending, ...publishPatch(current) };

      // Already live, already dated, nothing typed since: re-opening the
      // confirmation to read the link back does not cost a write.
      if (Object.keys(patch).length === 0) return current;

      try {
        const row = await updateBuild(id, patch);
        if (mountedRef.current && buildIdRef.current === id) {
          queryClient.setQueryData<BuildRecord | null>(
            composeBuildQueryKey(id),
            (previous) => (previous ? { ...previous, build: row } : previous)
          );
          setOverlay((currentOverlay) => {
            const next = { ...currentOverlay };
            for (const key of Object.keys(patch)) {
              if (!(key in pendingRef.current)) {
                delete next[key as keyof BuildPatch];
              }
            }
            return next;
          });
          setPublishError(null);
          setLastSavedAt(new Date());
        }
        return row;
      } catch (cause) {
        // The creator's own edits go back on the queue: a failed publish must
        // not also lose the sentence they had just typed.
        pendingRef.current = { ...pending, ...pendingRef.current };
        throw cause;
      }
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      if (mountedRef.current && buildIdRef.current === id) setPublishError(error);
      throw error;
    } finally {
      if (mountedRef.current && buildIdRef.current === id) setIsPublishing(false);
    }
  }, [queryClient]);

  return {
    build,
    tree,
    tray: query.data?.tray ?? NO_TRAY,
    events: query.data?.events ?? NO_EVENTS,
    nodeTypes,
    completeness,
    selectedNodeId,
    setSelectedNodeId,
    patchBuild,
    publish,
    isPublishing,
    publishError,
    isSaving,
    lastSavedAt,
    isLoading: query.isLoading,
    isOwner,
    loadError: (query.error as Error | null) ?? null,
    saveError,
  };
}
