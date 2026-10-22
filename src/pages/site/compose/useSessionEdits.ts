/* CA-14 P2 to P7 — the writes behind a session's head and a tile's "Move to session…": title, order, remove, merge, split.

   Every change is planned first (`sessionEdit.ts`, `sessionLayout.ts`, pure) and then written in this order: the tiles'
   `payload.session` in one batch, the sessions' entries (`making.sessions_meta`), the order (`build_sessions` and
   `making.session_order`), then the tiles' places, so each session's tiles sit together in the order the sessions are
   numbered. A change a maker may want back (move to a session, remove, merge, split) keeps what it replaced and offers Undo in
   a toast for ten seconds; Undo writes that back.

   An import is never touched: a tile is read for its session from `payload.session` first, so giving a tile another session
   edits this draft's tile and nothing in the library. */

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { deleteBuildSession, listBuildSessionRows } from "@/lib/build/buildSessions";
import { buildSteps, groupKey, topSteps, type SessionGroup, type Step } from "@/lib/build/graph";
import { isLegacySession, newSessionKey, patchMaking, refreshMakingStats, sessionsMetaOf, setSessionMeta, todayDay, type SessionMeta } from "@/lib/build/making";
import { reorderNodes } from "@/lib/build/nodes";
import { droppedKey, movedKey, orderKeys, setSessionOrder, stackBySessionMoves } from "@/lib/build/sessionLayout";
import { dayOfNode, flatRows, insertedAfter, mergedTitle, mergeTitleNote, planLayout, reassigned, removeTopNodes, splitPlan, tilesOfSession, withoutKey, writeNodeRows } from "@/lib/build/sessionEdit";
import type { BuildNode, NodeTree } from "@/lib/build/types";
import { toolFor } from "@/lib/tools/registry";

import { sayFailed } from "./draftStart";
import { rowOf, type ComposeNodes } from "./useComposeNodes";
import { buildSessionRowsKey } from "./useComposeSessions";
import { NO_APP } from "./sourcesModel";

/** How long Undo stays in the toast. */
export const UNDO_MS = 10_000;

interface Snapshot {
  meta: Record<string, SessionMeta>;
  order: string[];
  /** The top-level tiles as they were: payload and place. */
  rows: BuildNode[];
  /** Whole subtrees that were removed, to put back. */
  removed?: NodeTree[];
}

export interface SessionEditsInput {
  buildId: string | undefined;
  made: unknown;
  nodes: ComposeNodes;
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  /** An old build's run of typed prompts, saved as a session first. Resolves its new key. */
  claim: (key: string) => Promise<string | null>;
  /** What a screen reader hears. */
  say: (line: string) => void;
  /** The session being added to, so it is not left pointing at one that is gone. */
  onGone: (key: string) => void;
}

const findTop = (tree: readonly NodeTree[], id: string): NodeTree | undefined => tree.find((node) => node.id === id);

export function useSessionEdits(input: SessionEditsInput) {
  const queryClient = useQueryClient();
  const latest = useRef(input);
  latest.current = input;

  const editableKeys = useCallback(() => orderKeys(latest.current.groups).filter((key) => !isLegacySession(key)), []);

  const refresh = useCallback(
    async (id: string) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: buildSessionRowsKey(id) }),
        queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
      ]);
    },
    [queryClient],
  );

  const snapshot = useCallback((removed?: NodeTree[]): Snapshot => {
    const { made, nodes } = latest.current;
    return {
      meta: sessionsMetaOf(made),
      order: editableKeys(),
      rows: topSteps(nodes.current()).map((node) => rowOf(node)),
      removed,
    };
  }, [editableKeys]);

  /** Write a plan: payloads, entries, order, then places. */
  const applyLayout = useCallback(
    async (change: { order: string[]; reassign?: ReadonlyMap<string, string>; atEnd?: string[]; meta?: Record<string, SessionMeta | null>; dropKeys?: string[] }) => {
      const { buildId, made, nodes } = latest.current;
      if (!buildId) throw new Error("That draft is not saved yet.");
      await nodes.run(async () => {
      const entries = { ...sessionsMetaOf(made) };
      for (const [key, value] of Object.entries(change.meta ?? {})) {
        if (value) entries[key] = value;
        else delete entries[key];
      }
      const current = nodes.current();
      const base = reassigned(current, change.reassign ?? new Map());
      const plan = planLayout(base, { ...((made as object) ?? {}), sessions_meta: entries }, entries, change.order, change.atEnd);

      if (change.reassign && change.reassign.size > 0) {
        const rows = [...change.reassign.keys()].flatMap((id) => {
          const node = findTop(current, id);
          return node ? [{ ...rowOf(node), payload: { ...((node.payload ?? {}) as Record<string, unknown>), session: change.reassign?.get(id) } as BuildNode["payload"] }] : [];
        });
        for (const row of await writeNodeRows(rows)) nodes.record(row.id, row);
      }
      for (const [key, value] of Object.entries(change.meta ?? {})) await setSessionMeta(buildId, key, value);
      await setSessionOrder(buildId, change.order);
      for (const key of change.dropKeys ?? []) await deleteBuildSession(buildId, key).catch(() => undefined);
      if (plan.moves.length > 0) {
        await reorderNodes(buildId, plan.moves);
        for (const move of plan.moves) {
          const node = findTop(nodes.current(), move.id);
          if (node) nodes.record(node.id, { ...rowOf(node), position: move.position });
        }
      }
      });
      await refresh(buildId);
    },
    [refresh],
  );

  /** Put a snapshot back: removed tiles, payloads, places, entries and order. */
  const restore = useCallback(
    async (snap: Snapshot) => {
      const { buildId, nodes } = latest.current;
      if (!buildId) return;
      await nodes.run(async () => {
      if (snap.removed?.length) {
        const rows = flatRows(snap.removed);
        for (const row of await writeNodeRows(rows)) nodes.record(row.id, row);
      }
      const current = nodes.current();
      const changed = snap.rows.flatMap((row) => {
        const now = findTop(current, row.id);
        return now && JSON.stringify(now.payload) !== JSON.stringify(row.payload) ? [{ ...row, position: now.position }] : [];
      });
      for (const row of await writeNodeRows(changed)) nodes.record(row.id, row);
      const moves = snap.rows.flatMap((row) => {
        const now = findTop(nodes.current(), row.id);
        return now && now.position !== row.position ? [{ id: row.id, parent_id: null, position: row.position as number }] : [];
      });
      if (moves.length > 0) {
        await reorderNodes(buildId, moves);
        for (const move of moves) {
          const node = findTop(nodes.current(), move.id);
          if (node) nodes.record(node.id, { ...rowOf(node), position: move.position });
        }
      }
      await patchMaking(buildId, { sessions_meta: snap.meta, session_order: snap.order });
      for (const row of await listBuildSessionRows(buildId)) if (!snap.order.includes(row.sessionKey)) await deleteBuildSession(buildId, row.sessionKey).catch(() => undefined);
      await setSessionOrder(buildId, snap.order);
      });
      await refreshMakingStats(buildId).catch(() => undefined);
      await refresh(buildId);
    },
    [refresh],
  );

  const withUndo = useCallback(
    (message: string, snap: Snapshot) => {
      toast(message, {
        duration: UNDO_MS,
        action: {
          label: "Undo",
          onClick: () => {
            void restore(snap).catch((cause) => {
              console.error("[Sessions] undo failed", cause);
              sayFailed(cause, "Couldn't undo that. Try again.");
            });
          },
        },
      });
    },
    [restore],
  );

  /** An old build's run of typed prompts is saved as a session made here first; the key it has after. */
  const stable = useCallback(async (key: string): Promise<string | null> => (isLegacySession(key) ? latest.current.claim(key) : key), []);

  const guard = useCallback(
    async (line: string, task: () => Promise<void>) => {
      try {
        await task();
      } catch (cause) {
        console.error("[Sessions]", line, cause);
        sayFailed(cause, line);
      }
    },
    [],
  );

  /** A session's title: trimmed, 1 to 80 characters, or none. */
  const onTitle = useCallback(
    (key: string, title: string) =>
      void guard("Couldn't save that title. Try again.", async () => {
        const real = await stable(key);
        const { buildId, made, groups } = latest.current;
        if (!real || !buildId) return;
        const group = groups.find((entry) => groupKey(entry) === key);
        const before: SessionMeta = sessionsMetaOf(made)[real] ?? { tool: group?.tool ? (toolFor(group.tool)?.id ?? group.tool) : null, date: isLegacySession(key) ? todayDay() : group?.startedAt && /^\d{4}-\d{2}-\d{2}$/.test(group.startedAt) ? group.startedAt : "" };
        const { title: _old, ...rest } = before;
        // In the node queue, behind any write already going: two saves in a row each read `making` as the one before left it.
        await latest.current.nodes.run(() => setSessionMeta(buildId, real, title.trim() ? { ...rest, title: title.trim() } : rest));
        await refresh(buildId);
      }),
    [guard, refresh, stable],
  );

  const sayMoved = useCallback((from: number, to: number) => latest.current.say(`Session ${from} moved to ${to}.`), []);

  const move = useCallback(
    (key: string, next: string[], from: number, to: number) =>
      guard("Couldn't move that session. Try again.", async () => {
        await applyLayout({ order: next });
        sayMoved(from, to);
      }),
    [applyLayout, guard, sayMoved],
  );

  /** Move Up and Move Down, Alt with Up or Down on the head. */
  const onMove = useCallback(
    (key: string, by: -1 | 1) => {
      const keys = editableKeys();
      const next = movedKey(keys, key, by);
      if (next.join() === keys.join()) return;
      const shown = orderKeys(latest.current.groups);
      const from = shown.indexOf(key) + 1;
      void move(key, next, from, from + by);
    },
    [editableKeys, move],
  );

  /** A session's head dropped on another's. */
  const onDrop = useCallback(
    (key: string, over: string) => {
      const keys = editableKeys();
      const next = droppedKey(keys, key, over);
      if (next.join() === keys.join()) return;
      const shown = orderKeys(latest.current.groups);
      const offset = shown.length - keys.length;
      void move(key, next, shown.indexOf(key) + 1, next.indexOf(key) + 1 + offset);
    },
    [editableKeys, move],
  );

  /** Remove a session and its tiles, undoable. */
  const onRemove = useCallback(
    (key: string) =>
      void guard("Couldn't remove that session. Try again.", async () => {
        const { buildId, made, nodes, steps, groups } = latest.current;
        if (!buildId) return;
        const number = groups.find((entry) => groupKey(entry) === key)?.number ?? 0;
        const mine = tilesOfSession(steps, groups, key);
        const subtrees = mine.flatMap((step) => {
          const node = findTop(nodes.current(), step.id);
          return node ? [node] : [];
        });
        const snap = snapshot(subtrees);
        const order = withoutKey(editableKeys(), key);
        await nodes.run(async () => {
          await removeTopNodes(mine.map((step) => step.id));
          for (const step of mine) nodes.record(step.id, null);
        });
        await setSessionMeta(buildId, key, null);
        await deleteBuildSession(buildId, key).catch(() => undefined);
        const collapsed = ((made as { sessions_collapsed?: unknown } | null)?.sessions_collapsed as string[] | undefined) ?? [];
        await patchMaking(buildId, { session_order: order, sessions_collapsed: collapsed.filter((entry) => entry !== key) });
        await refreshMakingStats(buildId).catch(() => undefined);
        latest.current.onGone(key);
        await refresh(buildId);
        withUndo(`Removed Session ${number}.`, snap);
      }),
    [editableKeys, guard, refresh, snapshot, withUndo],
  );

  /** "Merge with the session above": this session's tiles go to the end of the one above, and this one is gone. */
  const onMergeUp = useCallback(
    (key: string) =>
      void guard("Couldn't merge those sessions. Try again.", async () => {
        const { made, steps, groups } = latest.current;
        const keys = editableKeys();
        const at = keys.indexOf(key);
        if (at < 1) return;
        const upper = keys[at - 1];
        const entries = sessionsMetaOf(made);
        const mine = tilesOfSession(steps, groups, key);
        const snap = snapshot();
        const title = mergedTitle(entries[upper]?.title, entries[key]?.title);
        const upperGroup = groups.find((entry) => groupKey(entry) === upper);
        const upperMeta: SessionMeta = entries[upper] ?? { tool: upperGroup?.tool ? (toolFor(upperGroup.tool)?.id ?? upperGroup.tool) : null, date: "" };
        const meta: Record<string, SessionMeta | null> = { [key]: null };
        if (title && title !== entries[upper]?.title && (entries[upper] || !isLegacySession(upper))) meta[upper] = { ...upperMeta, title };
        const reassign = new Map(mine.map((step) => [step.id, upper]));
        await applyLayout({ order: withoutKey(keys, key), reassign, atEnd: mine.map((step) => step.id), meta, dropKeys: [key] });
        latest.current.onGone(key);
        await refreshMakingStats(latest.current.buildId as string).catch(() => undefined);
        const number = groups.find((entry) => groupKey(entry) === key)?.number ?? at + 1;
        withUndo(mergeTitleNote(entries[upper]?.title, entries[key]?.title) ?? `Merged Session ${number} into the session above.`, snap);
      }),
    [applyLayout, editableKeys, guard, snapshot, withUndo],
  );

  /** "Split session here": this tile and every tile after it start a new session right after this one. */
  const onSplitHere = useCallback(
    (stepId: string) =>
      void guard("Couldn't split that session. Try again.", async () => {
        const { made, steps, groups, nodes } = latest.current;
        const plan = splitPlan(steps, groups, stepId);
        if (!plan) return;
        const keys = editableKeys();
        if (!keys.includes(plan.from)) return;
        const group = groups.find((entry) => groupKey(entry) === plan.from);
        const entries = sessionsMetaOf(made);
        const snap = snapshot();
        const key = newSessionKey();
        const day = dayOfNode(findTop(nodes.current(), stepId), todayDay());
        const tool = group?.tool && group.tool !== NO_APP ? (toolFor(group.tool)?.id ?? group.tool) : (entries[plan.from]?.tool ?? null);
        const meta: Record<string, SessionMeta | null> = { [key]: { tool, date: day } };
        const reassign = new Map(plan.tail.map((step) => [step.id, key]));
        await applyLayout({ order: insertedAfter(keys, key, plan.from), reassign, meta });
        const tile = steps.find((step) => step.id === stepId);
        withUndo(`Split Session ${group?.number ?? ""} at tile ${tile?.number ?? ""}.`.replace("  ", " "), snap);
      }),
    [applyLayout, editableKeys, guard, snapshot, withUndo],
  );

  /** "Move to session…", or a tile dropped on a session's head: to the end of that session. */
  const onMoveTile = useCallback(
    async (id: string, key: string): Promise<boolean> => {
      let ok = false;
      await guard("Couldn't move that tile. Try again.", async () => {
        const target = await stable(key);
        if (!target) return;
        const { steps, groups } = latest.current;
        const snap = snapshot();
        const step = steps.find((entry) => entry.id === id);
        const keys = orderKeys(groups).filter((entry) => !isLegacySession(entry)).concat(target).filter((entry, at, all) => all.indexOf(entry) === at);
        await applyLayout({ order: keys, reassign: new Map([[id, target]]), atEnd: [id] });
        const number = groups.find((entry) => groupKey(entry) === key)?.number ?? "";
        withUndo(`Moved ${step ? `tile ${step.number}` : "the tile"} to Session ${number}.`, snap);
        ok = true;
      });
      return ok;
    },
    [applyLayout, guard, snapshot, stable, withUndo],
  );

  /* A tile added to a session that is not the last lands at the end of the draft; once it is written it is moved up to the
     end of its own session. Armed by the add (`arm`), done when the tree has grown. */
  const armed = useRef<number | null>(null);
  const arm = useCallback(() => {
    armed.current = topSteps(latest.current.nodes.current()).length;
  }, []);
  const topCount = topSteps(input.nodes.tree).length;
  useEffect(() => {
    if (armed.current === null || topCount <= armed.current) return;
    armed.current = null;
    const { buildId, nodes, made } = latest.current;
    if (!buildId) return;
    void nodes
      .run(async () => {
        const tree = nodes.current();
        const steps = buildSteps(tree);
        const plan = planLayout(tree, made, sessionsMetaOf(made), editableKeys());
        const moves = stackBySessionMoves(tree, steps, plan.groups);
        if (moves.length === 0) return;
        await reorderNodes(buildId, moves);
        for (const move of moves) {
          const node = findTop(nodes.current(), move.id);
          if (node) nodes.record(node.id, { ...rowOf(node), position: move.position });
        }
        await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(buildId) });
      })
      .catch((cause) => console.warn("[Sessions] a new tile was not put with its session", cause));
  }, [topCount, editableKeys, queryClient]);

  return { onTitle, onMove, onDrop, onRemove, onMergeUp, onSplitHere, onMoveTile, arm };
}
