/* CA-20 P2, P5: the build's one history, on the composer.

   `lib/build/buildHistory.ts` keeps the steps; this hook takes them. A step is made by `track(sentence, task)`: the build is
   snapshotted from what the page holds, the task runs at once, the build is read from the database when it is done, and the
   difference is the step. Undo puts back only what the
   step changed (`deltaTarget`), with the same ids, so anything written since that the step did not touch stays; redo writes it
   again. Everything CA-19 does to colours, groups and the post's links joins the same history through `join` (the history
   keeps its own steps and API; each of its steps is handed over with its own undo and redo), and a step that changes both is
   one step: the reference steps taken while its task runs are its children.

   THE NOTICE. After a removal, a merge, a split, a duplicate and a few more, the notice shows the step's sentence with Undo for six
   seconds or until the next step. It is CA-19's (`ReferenceNotice`): there is one notice on the page, whichever kind of step
   made it.

   NOT KEPT. The history lives in memory for the visit. A reload starts empty, and everything is already saved. */

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { EMPTY_BUILD_HISTORY, HISTORY_COPY, afterRedone, afterUndone, canRedoStep, canUndoStep, groupSteps, nextRedo, nextUndo, recordStep, type BuildHistory, type BuildStep } from "@/lib/build/buildHistory";
import type { BuildSessionRow } from "@/lib/build/buildSessions";
import { currentSnapshot, deltaTarget, restoreSnapshot, snapshotOf, type BuildSnapshot } from "@/lib/build/buildSnapshot";
import { REMOVED_COPY, restoreTarget, type RemovedEntry, type RemovedMeta } from "@/lib/build/removedLog";
import type { ReferenceBridge } from "@/lib/build/referenceBridge";

import { sayFailed } from "./draftStart";
import type { ComposeNodes } from "./useComposeNodes";
import { buildSessionRowsKey } from "./useComposeSessions";

export interface BuildNotice {
  sentence: string;
  /** Changes with every step, so the same sentence twice still restarts the notice. */
  n: number;
}

/** What `track` and `commit` take. */
export interface TrackOptions {
  /** A notice after the step: true for its own sentence, or the sentence to say. Absent: no notice, the title row's Undo is enough. */
  notice?: boolean | string;
  /** The step removes something: it is listed under Recently removed, with this, and can be restored out of turn. */
  removed?: RemovedMeta;
}

/** What CA-19's history is handed to join this one. */
export interface BuildJoin {
  /** A step CA-19 has taken: its sentence and its own undo and redo. */
  record: (step: BuildStep) => void;
  notify: (sentence: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface BuildHistoryApi {
  canUndo: boolean;
  canRedo: boolean;
  /** The sentence of the step Undo would take back ("Removed Prompt 3"), or null. */
  undoSentence: string | null;
  redoSentence: string | null;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  /** A step that has been taken. While a `track` is running, it is one of that step's children. */
  record: (step: BuildStep) => void;
  notice: BuildNotice | null;
  notify: (sentence: string) => void;
  dismiss: () => void;
  /** The build as it stands, once every write queued so far has landed. */
  capture: () => Promise<BuildSnapshot>;
  /**
   * Run `task` as one step named `sentence` (or by what the task resolves: "Merged Session 3 into the session above"). Resolves
   * what the task resolves; a task that fails records nothing of its own.
   */
  track: <T>(sentence: string | ((result: T) => string), task: () => Promise<T>, options?: TrackOptions) => Promise<T>;
  /** The step of changes that have already been made since `before` was captured. */
  commit: (sentence: string, before: BuildSnapshot, options?: TrackOptions) => Promise<void>;
  /** What was removed during this visit, newest first, each with what it takes to restore it. */
  removed: RemovedEntry[];
  /** Bring one removal back (a step of its own): in its old place where that still holds, else at the end of its session. */
  restoreRemoved: (id: string) => Promise<void>;
  /** What CA-19's history joins with. */
  join: BuildJoin;
  /** Tests and dev pages: the history as it stands. */
  read: () => BuildHistory;
}

export const BuildHistoryContext = createContext<BuildHistoryApi | null>(null);

/** The page's history, or none outside the composer. */
export const useBuildHistoryContext = (): BuildHistoryApi | null => useContext(BuildHistoryContext);

const EMPTY: BuildSnapshot = { nodes: [], sessions: [], making: {} };
const same = (a: BuildSnapshot, b: BuildSnapshot) => JSON.stringify([a.nodes, a.sessions, a.making]) === JSON.stringify([b.nodes, b.sessions, b.making]);

/** What the page holds of the build besides its tiles: `making` and the session rows, as last read. */
export interface HeldParts {
  making: unknown;
  sessions: readonly BuildSessionRow[];
}

export function useBuildHistory({ buildId, nodes, peek, getBridge }: { buildId: string | undefined; nodes: ComposeNodes; peek?: () => HeldParts; getBridge?: () => ReferenceBridge | undefined }): BuildHistoryApi {
  const bridgeRef = useRef(getBridge);
  bridgeRef.current = getBridge;
  /** What was removed this visit, newest first; an entry is hidden while its step is undone and gone once restored. */
  const removedList = useRef<RemovedEntry[]>([]);
  const peekRef = useRef<() => HeldParts>(() => ({ making: null, sessions: [] }));
  peekRef.current = peek ?? peekRef.current;
  const queryClient = useQueryClient();
  const history = useRef<BuildHistory>(EMPTY_BUILD_HISTORY);
  const [, redraw] = useState(0);
  const [notice, setNotice] = useState<BuildNotice | null>(null);
  const live = useRef({ buildId, nodes });
  live.current = { buildId, nodes };
  /** While a `track` runs, the steps taken in it are collected here instead of recorded. */
  const collector = useRef<BuildStep[] | null>(null);
  /** One undo, redo or `commit` at a time, in the order asked. */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const serial = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = chain.current.then(task, task);
    chain.current = next.catch(() => undefined);
    return next;
  }, []);

  const set = (next: BuildHistory) => {
    history.current = next;
    redraw((n) => n + 1);
  };

  const notify = useCallback((sentence: string) => setNotice((current) => ({ sentence, n: (current?.n ?? 0) + 1 })), []);
  const dismiss = useCallback(() => setNotice(null), []);

  const refresh = useCallback(async () => {
    const id = live.current.buildId;
    if (!id) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: buildSessionRowsKey(id) }),
      queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
    ]);
  }, [queryClient]);

  const capture = useCallback((): Promise<BuildSnapshot> => {
    const { buildId: id, nodes: queue } = live.current;
    if (!id) return Promise.resolve(EMPTY);
    return queue.run(() => currentSnapshot(id, queue));
  }, []);

  /** Put a step on the history, or with its parent step while one is being made. */
  const record = useCallback((step: BuildStep) => {
    if (collector.current) {
      collector.current.push(step);
      return;
    }
    set(recordStep(history.current, step));
  }, []);

  /** The step for the build's own rows, `making` and sessions: what changed between two snapshots, undone and redone. */
  const buildStep = useCallback(
    (before: BuildSnapshot, after: BuildSnapshot): BuildStep | null => {
      if (same(before, after)) return null;
      const write = (from: BuildSnapshot, to: BuildSnapshot) => async () => {
        const { buildId: id, nodes: queue } = live.current;
        if (!id) return;
        await restoreSnapshot(id, queue, (current) => deltaTarget(current, from, to));
        await refresh();
      };
      return { sentence: "", undo: write(after, before), redo: write(before, after) };
    },
    [refresh],
  );

  const showEntry = useCallback((id: string, visible: boolean) => {
    removedList.current = removedList.current.map((entry) => (entry.id === id ? { ...entry, visible } : entry));
    redraw((n) => n + 1);
  }, []);

  const finish = useCallback(
    (sentence: string, children: BuildStep[], options?: TrackOptions, snapshots?: { before: BuildSnapshot; after: BuildSnapshot }) => {
      if (children.length === 0) return;
      let made: BuildStep = children.length === 1 ? { ...children[0], sentence } : groupSteps(sentence, children);
      // A removal is listed; while it is undone the thing is back, so it is not listed.
      if (options?.removed && snapshots) {
        const id = `removed-${Date.now()}-${removedList.current.length}`;
        removedList.current = [{ ...options.removed, id, at: Date.now(), before: snapshots.before, after: snapshots.after, visible: true }, ...removedList.current];
        const whole = made;
        made = { ...whole, undo: async () => { await whole.undo(); showEntry(id, false); }, redo: async () => { await whole.redo(); showEntry(id, true); } };
      }
      set(recordStep(history.current, made));
      if (options?.notice) notify(typeof options.notice === "string" ? options.notice : sentence);
    },
    [notify, showEntry],
  );

  /* A step starts at once, inside the tap or the key press that made it: some of what follows needs that (a stand-in tile drawn
     and scrolled to, a keyboard raised on a phone). So the "before" is taken from what the page holds (the tiles as the node
     queue has them, `making` and the session rows as last read), not from the database; the "after" is read from the database
     once every queued write has landed. The step is the difference. Another change made while one is being made is part of it. */
  const running = useRef<Promise<unknown> | null>(null);
  const track = useCallback(
    <T,>(sentence: string | ((result: T) => string), task: () => Promise<T>, options?: TrackOptions): Promise<T> => {
      if (collector.current) {
        // Inside a step that is already being made (a window's Save runs many writes), this change is part of that step.
        return (async () => {
          const result = await task();
          if (options?.notice) notify(typeof sentence === "string" ? sentence : sentence(result));
          return result;
        })();
      }
      const { buildId: id, nodes: queue } = live.current;
      const held = peekRef.current();
      const before: BuildSnapshot = id ? snapshotOf(queue.current(), held.making, held.sessions) : EMPTY;
      const children: BuildStep[] = [];
      collector.current = children;
      let started: Promise<T>;
      try {
        started = Promise.resolve(task());
      } catch (cause) {
        started = Promise.reject(cause);
      }
      const done = started.then(
        async (result) => {
          collector.current = null;
          const after = await capture();
          const own = buildStep(before, after);
          if (own) children.push(own);
          finish(typeof sentence === "string" ? sentence : sentence(result), children, options, { before, after });
          return result;
        },
        (cause) => {
          collector.current = null;
          // What was taken before it failed (CA-19's steps) is still on their history: keep them undoable.
          finish(typeof sentence === "string" ? sentence : "", children);
          throw cause;
        },
      );
      running.current = done.catch(() => undefined);
      return done;
    },
    [capture, buildStep, finish, notify],
  );

  const commit = useCallback(
    (sentence: string, before: BuildSnapshot, options?: TrackOptions): Promise<void> =>
      serial(async () => {
        const own = buildStep(before, await capture());
        if (own) finish(sentence, [own], options);
      }),
    [serial, capture, buildStep, finish],
  );

  const undo = useCallback(
    (): Promise<void> =>
      serial(async () => {
        await running.current;
        if (!canUndoStep(history.current)) return;
        const step = history.current.done.at(-1) as BuildStep;
        try {
          await step.undo();
        } catch (cause) {
          console.error("[History] undo failed", cause);
          sayFailed(cause, HISTORY_COPY.undoFailed);
          return;
        }
        set(afterUndone(history.current));
        dismiss();
      }),
    [serial, dismiss],
  );

  const redo = useCallback(
    (): Promise<void> =>
      serial(async () => {
        await running.current;
        if (!canRedoStep(history.current)) return;
        const step = history.current.undone.at(-1) as BuildStep;
        try {
          await step.redo();
        } catch (cause) {
          console.error("[History] redo failed", cause);
          sayFailed(cause, HISTORY_COPY.redoFailed);
          return;
        }
        set(afterRedone(history.current));
        dismiss();
      }),
    [serial, dismiss],
  );

  const restoreRemoved = useCallback(
    async (id: string): Promise<void> => {
      const entry = removedList.current.find((candidate) => candidate.id === id && candidate.visible);
      const { buildId: built, nodes: queue } = live.current;
      if (!entry || !built) return;
      try {
        await track(
          REMOVED_COPY.restored(entry.name),
          async () => {
            await restoreSnapshot(built, queue, (current) => restoreTarget(current, entry));
            await refresh();
            if (entry.refs) bridgeRef.current?.()?.restore(entry.refs);
          },
          { notice: true },
        );
        // It is back: gone from the list.
        removedList.current = removedList.current.filter((candidate) => candidate.id !== id);
        redraw((n) => n + 1);
      } catch (cause) {
        console.error("[History] restore failed", cause);
        sayFailed(cause, REMOVED_COPY.cannot);
      }
    },
    [track, refresh],
  );

  const canUndo = canUndoStep(history.current);
  const canRedo = canRedoStep(history.current);
  const join = useMemo<BuildJoin>(() => ({ record, notify, undo: () => void undo(), redo: () => void redo(), canUndo, canRedo }), [record, notify, undo, redo, canUndo, canRedo]);

  return {
    canUndo,
    canRedo,
    undoSentence: nextUndo(history.current),
    redoSentence: nextRedo(history.current),
    undo,
    redo,
    record,
    notice,
    notify,
    dismiss,
    capture,
    track,
    commit,
    removed: removedList.current.filter((entry) => entry.visible),
    restoreRemoved,
    join,
    read: () => history.current,
  };
}
