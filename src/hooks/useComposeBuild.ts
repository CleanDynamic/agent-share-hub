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
// CA-10 (CA-09 F11, CA-08 F5): OPENING A DRAFT WRITES NOTHING. The score is
// worked out for display at once, and written only with the maker's next real
// edit: a header save carries it when it differs from the stored one, and a
// change to the score after opening (the maker added a part) is written then.
//
// CA-10: A SAVE THE DATABASE REFUSES STOPS. Only a failure that can succeed
// later (the network, 408, 429, 500, 502, 503, 504, 520) is tried again, three
// times, after 1 s, 4 s and 10 s. Any other answer, or the third retry failing,
// stops: the change stays in memory, `saveFailure` says what failed and its
// code ("Not saved: a value isn't allowed. Code 23514."), it is logged once,
// and `retrySave` (Try again) or the maker's next edit sends it again.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { replaceEqualDeep, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  computeCompleteness,
  getBuild,
  publishPatch,
  publishRebuild,
  updateBuild,
} from "@/lib/build";
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
import { onBuildWritten } from "@/lib/build/builds";
import { hasTitle, NO_TITLE } from "@/lib/build/publish";
import { connection, isNetworkFailure } from "@/lib/build/connection";
import { pendingWrites } from "@/lib/build/pendingWrites";
import { flatNodes, noteRecord } from "@/lib/build/staleWrites";
import { canSucceedLater, errorCode, errorLine, shortReason } from "@/lib/errors/code";
import { composeBuildQueryKey } from "./composeBuildQueryKey";
import { fetchNodeTypes } from "./useNodeType";
import { reportError } from "@/lib/errors/report";

/** Quiet enough that a sentence of typing is one write, short enough that the
 *  indicator settles while the creator is still looking at the field. */
export const SAVE_DEBOUNCE_MS = 800;

/** CA-10 / CA-23: how long to wait before each retry of a save that can succeed later: 1, 4 and 10 seconds, then stop. */
export const SAVE_RETRY_DELAYS_MS = [1_000, 4_000, 10_000] as const;

/** CA-10: a save that stopped, in the maker's words. */
export interface SaveFailure {
  /** "a value isn't allowed". */
  reason: string;
  /** "23514"; absent for a network failure. */
  code?: string;
}

/** Stable identities, so a consumer's useMemo/useEffect on an empty tree does
 *  not re-run on every render of this hook. */
const NO_TREE: NodeTree[] = [];
const NO_TRAY: BuildNode[] = [];
const NO_EVENTS: BuildEvent[] = [];
const NO_NODE_TYPES: NodeType[] = [];

export { composeBuildQueryKey };

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
   *
   * PASSING A NOTE PUBLISHES IT AS A REBUILD (NS-P39), through rebuild.ts's
   * publishRebuild rather than through the fold above. An ORDINARY draft calls
   * this with no argument and takes the path it always has — the parameter is
   * the whole of the difference, and `undefined` is not the same answer as
   * `null`: null is a rebuild whose creator wrote nothing.
   */
  publish: (rebuildNote?: string | null) => Promise<Build>;
  /**
   * CA-25: take a published build back to a draft (`status` draft, `published_at` cleared), through `updateBuild`, with any unsaved
   * header edits in the same write as `publish` does. Throws what the database answers: a refusal (row-level security, a trigger)
   * is the caller's to read, and nothing here works around it.
   */
  unpublish: () => Promise<Build>;
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
  /** CA-10: set once a save has stopped (refused, or out of retries); the change it held is still pending. */
  saveFailure: SaveFailure | null;
  /** CA-10: Try again: send what is pending now. */
  retrySave: () => void;
}

/** SV-07 P2: a build row's `updated_at`, as a number to compare. */
const stampOf = (build: { updated_at?: unknown } | null | undefined): number => Date.parse(String(build?.updated_at ?? "")) || 0;

/**
 * SV-07 P2: a refetch never takes the page back. An answer whose build row is older than the one held was read before a write
 * of this tab landed: the record held stays until a newer read confirms it. Otherwise the answer is shared as usual.
 */
export function newerRecord(held: unknown, next: unknown): unknown {
  const before = held as BuildRecord | null | undefined;
  const after = next as BuildRecord | null | undefined;
  if (before?.build && after?.build && before.build.id === after.build.id && stampOf(after.build) < stampOf(before.build)) return held;
  return replaceEqualDeep(held, next);
}

export function useComposeBuild(buildId: string | undefined): ComposeBuild {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<BuildRecord | null>({
    queryKey: composeBuildQueryKey(buildId),
    queryFn: () => getBuild(buildId as string, { nodeTypes: () => fetchNodeTypes(queryClient) }),
    enabled: Boolean(buildId),
    // The editor is the only writer on this record while it is open, so a
    // refetch can only arrive stale and fight the optimistic overlay below.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
    structuralSharing: newerRecord,
  });

  /* SV-07 P2: the row each of this tab's writes leaves is what the page holds from that moment, not from the refetch after it. */
  useEffect(() => {
    if (!buildId) return;
    return onBuildWritten((row) => {
      if (row.id !== buildId) return;
      queryClient.setQueryData<BuildRecord | null>(composeBuildQueryKey(buildId), (held) => (held && stampOf(row) > stampOf(held.build) ? { ...held, build: { ...held.build, ...row } } : held));
    });
  }, [buildId, queryClient]);

  /* CA-23 P4: what this tab last knew of the build, for the checks that stop a write from undoing another tab's change. The first
     read is learned; a later one only adds what is new. */
  useEffect(() => {
    if (buildId && query.data) noteRecord(buildId, { build: query.data.build as unknown as Record<string, unknown>, tree: flatNodes(query.data.tree) });
  }, [buildId, query.data]);

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
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
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
  /** CA-10: retries spent on the failure now open; reset by a save that lands, an edit, or Try again. */
  const attemptRef = useRef(0);
  /** CA-10: a save has stopped; nothing is sent until the maker edits or presses Try again. */
  const stoppedRef = useRef(false);
  /** CA-10: the score as worked out now, and as the stored row has it, for the next real write. */
  const completenessRef = useRef<number | null>(null);
  const storedCompletenessRef = useRef<number | null>(null);

  /** A write is only ever issued for a build the session user owns. The RLS
   *  policy says the same thing; this keeps a non-owner's editor from even
   *  asking, so a forbidden view issues no request at all. */
  const isOwner = Boolean(
    query.data?.build && user && query.data.build.creator_id === user.id
  );
  const isOwnerRef = useRef(isOwner);
  isOwnerRef.current = isOwner;

  const flushRef = useRef<() => Promise<void>>(async () => {});
  /** CA-23: the header's share of the pending count: one change while fields wait to go or a write is in the air. */
  const report = useCallback(() => {
    pendingWrites.set("header", Object.keys(pendingRef.current).length > 0 || inFlightRef.current ? 1 : 0);
  }, []);
  /** CA-10: set by a failed save that will be tried again: how long to wait first. */
  const retryInRef = useRef<number | null>(null);
  /** CA-23: the last write got no answer; nothing is sent again until the connection is back (or the maker edits). */
  const waitingOnlineRef = useRef(false);

  const schedule = useCallback((delay: number = SAVE_DEBOUNCE_MS) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      settleRef.current = flushRef.current();
    }, delay);
  }, []);

  const flush = useCallback(async () => {
    // A save is already open. Whatever has landed since goes out when it
    // returns, so firing a second overlapping update would only race it.
    if (inFlightRef.current) return;

    const id = buildIdRef.current;
    if (stoppedRef.current) return;
    if (!id || !isOwnerRef.current || Object.keys(pendingRef.current).length === 0) return;
    // A real edit carries the score with it, when it differs from the stored one.
    const score = completenessRef.current;
    const patch: BuildPatch =
      score !== null && score !== storedCompletenessRef.current && !("completeness" in pendingRef.current)
        ? { ...pendingRef.current, completeness: score }
        : pendingRef.current;

    pendingRef.current = {};
    inFlightRef.current = true;
    setIsSaving(true);
    report();

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
      attemptRef.current = 0;
      setSaveError(null);
      setSaveFailure(null);
      setLastSavedAt(new Date());
    } catch (cause) {
      if (!mountedRef.current || buildIdRef.current !== id) return;
      // Put the failed keys back, in memory, without overwriting anything the
      // creator has typed since.
      pendingRef.current = { ...patch, ...pendingRef.current };
      // CA-23: no answer at all is not an error: the connection is down, and the change goes out when it is back.
      if (isNetworkFailure(cause)) {
        connection.noteNetworkFailure();
        waitingOnlineRef.current = true;
        void connection.whenOnline().then(() => {
          waitingOnlineRef.current = false;
          if (mountedRef.current && buildIdRef.current === id && Object.keys(pendingRef.current).length > 0) schedule(0);
        });
        return;
      }
      setSaveError(cause instanceof Error ? cause : new Error(String(cause)));
      // CA-10: try again only what can succeed later, three times; otherwise stop and say so, once.
      if (canSucceedLater(cause) && attemptRef.current < SAVE_RETRY_DELAYS_MS.length) {
        retryInRef.current = SAVE_RETRY_DELAYS_MS[attemptRef.current];
        attemptRef.current += 1;
      } else {
        stoppedRef.current = true;
        setSaveFailure({ reason: shortReason(cause), code: errorCode(cause) });
        reportError(errorLine("[Compose] header save failed", cause), { source: "console", context: "useComposeBuild" });
      }
    } finally {
      inFlightRef.current = false;
      report();
      if (mountedRef.current && buildIdRef.current === id) {
        setIsSaving(false);
        const retryIn = retryInRef.current;
        retryInRef.current = null;
        if (!stoppedRef.current && !waitingOnlineRef.current && Object.keys(pendingRef.current).length > 0) schedule(retryIn ?? SAVE_DEBOUNCE_MS);
      }
    }
  }, [queryClient, schedule, report]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const patchBuild = useCallback(
    (patch: BuildPatch) => {
      if (!buildIdRef.current || !isOwnerRef.current) return;
      if (Object.keys(patch).length === 0) return;
      setOverlay((current) => ({ ...current, ...patch }));
      pendingRef.current = { ...pendingRef.current, ...patch };
      report();
      // A real edit is a fresh try, even after a save stopped: it may be the change that fixes it.
      stoppedRef.current = false;
      attemptRef.current = 0;
      schedule();
    },
    [schedule, report]
  );

  /** CA-10: Try again. Sends what is pending now, with three retries again if it can succeed later. */
  const retrySave = useCallback(() => {
    stoppedRef.current = false;
    attemptRef.current = 0;
    setSaveFailure(null);
    if (Object.keys(pendingRef.current).length > 0) schedule(0);
  }, [schedule]);

  // A different build is a different record: drop the previous one's unsaved
  // edits and selection rather than laying them over the new row.
  useEffect(() => {
    setOverlay({});
    setSelectedNodeId(null);
    setLastSavedAt(null);
    setSaveError(null);
    setSaveFailure(null);
    setPublishError(null);
    pendingRef.current = {};
    report();
    stoppedRef.current = false;
    attemptRef.current = 0;
    openedScoreRef.current = null;
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
      pendingWrites.set("header", 0);
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

  completenessRef.current = completeness?.score ?? null;
  storedCompletenessRef.current = query.data?.build?.completeness ?? null;

  /* CA-10: the score as the draft opened. Opening writes nothing; a score that changes after that, because the
     maker changed the build, is written (it converges: patchBuild puts it in the overlay `build` is read through). */
  const openedScoreRef = useRef<number | null>(null);
  useEffect(() => {
    if (!build || !completeness) return;
    if (openedScoreRef.current === null) {
      openedScoreRef.current = completeness.score;
      return;
    }
    if (completeness.score === openedScoreRef.current) return;
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
  const publish = useCallback(async (rebuildNote?: string | null): Promise<Build> => {
    const id = buildIdRef.current;
    const current = buildRef.current;
    if (!id || !current) throw new Error("There is no build to publish.");
    if (!isOwnerRef.current) {
      throw new Error("Only a build's creator can publish it.");
    }
    // SV-07 P8: a build with no title is not published, from either composer. `current` carries what the maker has typed.
    if (!hasTitle(current.title)) throw new Error(NO_TITLE);

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
      report();
      // CA-10: publishing is a real edit, so it carries the score when the stored one is out of date.
      const score = completenessRef.current;
      const scored = score !== null && score !== storedCompletenessRef.current ? { completeness: score } : {};
      const patch: BuildPatch = { ...scored, ...pending, ...publishPatch(current) };

      /**
       * A rebuild publishes through rebuild.ts, and cannot take the fold.
       *
       * publishRebuild writes the note in its own statement BEFORE the status,
       * so the record is never readable in a state where the rebuild is live
       * and its note is not — an ordering a single merged PATCH cannot express.
       * The reason the fold exists is a RACE, not a round trip, and there is no
       * race here: these statements are sequential and run under the same
       * in-flight lock a debounced save takes.
       */
      const asRebuild = rebuildNote !== undefined;

      // Already live, already dated, nothing typed since: re-opening the
      // confirmation to read the link back does not cost a write. A rebuild
      // still writes, because its note is what may have changed.
      if (!asRebuild && Object.keys(patch).length === 0) return current;

      // Hold the same lock a debounced save takes, so a timer that fires
      // mid-publish declines to overlap rather than issuing a second PATCH
      // against the row this one is already writing.
      inFlightRef.current = true;
      try {
        let row: Build;
        if (asRebuild) {
          // The creator's own header edits go out first, so the sentence they
          // typed a second ago is not lost to publishRebuild's ordering.
          if (Object.keys(pending).length > 0) await updateBuild(id, pending);
          row = await publishRebuild(
            { id, status: current.status, published_at: current.published_at, title: current.title },
            rebuildNote ?? null
          );
        } else {
          row = await updateBuild(id, patch);
        }
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
        report();
        throw cause;
      }
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      if (mountedRef.current && buildIdRef.current === id) setPublishError(error);
      throw error;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current && buildIdRef.current === id) {
        setIsPublishing(false);
        // Whatever was typed while the publish was open. flush() declined to
        // overlap it, and only the holder of the lock can reschedule — the
        // same contract flush's own finally keeps.
        if (Object.keys(pendingRef.current).length > 0) schedule();
      }
    }
  }, [queryClient, schedule, report]);

  const unpublish = useCallback(async (): Promise<Build> => {
    const id = buildIdRef.current;
    if (!id || !buildRef.current) throw new Error("There is no build to unpublish.");
    if (!isOwnerRef.current) throw new Error("Only a build's creator can unpublish it.");

    setIsPublishing(true);
    try {
      if (settleRef.current) await settleRef.current.catch(() => {});
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const pending = pendingRef.current;
      pendingRef.current = {};
      report();
      const patch: BuildPatch = { ...pending, status: "draft", published_at: null };
      inFlightRef.current = true;
      try {
        const row = await updateBuild(id, patch);
        if (mountedRef.current && buildIdRef.current === id) {
          queryClient.setQueryData<BuildRecord | null>(composeBuildQueryKey(id), (previous) => (previous ? { ...previous, build: row } : previous));
          setOverlay((currentOverlay) => {
            const next = { ...currentOverlay };
            for (const key of Object.keys(patch)) {
              if (!(key in pendingRef.current)) delete next[key as keyof BuildPatch];
            }
            return next;
          });
          setLastSavedAt(new Date());
        }
        return row;
      } catch (cause) {
        // The creator's own edits go back on the queue: a refused unpublish must not lose them.
        pendingRef.current = { ...pending, ...pendingRef.current };
        report();
        throw cause;
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current && buildIdRef.current === id) {
        setIsPublishing(false);
        if (Object.keys(pendingRef.current).length > 0) schedule();
      }
    }
  }, [queryClient, schedule, report]);

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
    unpublish,
    isPublishing,
    publishError,
    isSaving,
    lastSavedAt,
    isLoading: query.isLoading,
    isOwner,
    loadError: (query.error as Error | null) ?? null,
    saveError,
    saveFailure,
    retrySave,
  };
}
