/* CA-20 P2 and after: what the maker can do to the build's components, in one place: remove, and (P3 to P7) select, clear,
   duplicate, convert, group and ungroup.

   The menus, the selection bar, the title row and the keys all call these through `BuildActionsContext`, so a tile's menu,
   Delete and the selection bar do the same thing in the same words. Each change is one step of the build's history: the notice
   says it with Undo, and the title row's Undo takes it back.

   REMOVING. A tile goes at once, with whatever is nested in it and the files its tiles make. A session with no tiles goes at once;
   one with tiles asks first (the session window: Cancel, Keep the tiles, Remove all). A part goes at once, its sessions joining the
   one next to it. A file goes at once, and out of the tiles that use it. What points at a component (its group, its colour, the
   words in the post that link to it) is let go first, through the reference bridge, and comes back with it on Undo. */

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { kindsIn, type Chosen } from "@/lib/build/buildSelection";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { deleteBuildSession, listBuildSessionRows } from "@/lib/build/buildSessions";
import { REMOVE_COPY, type ClearCounts } from "@/lib/build/componentMenus";
import { FILE_TYPE, groupKey, stepTitle, type SessionGroup, type Step } from "@/lib/build/graph";
import { patchMaking, refreshMakingStats, storedWorkstreamsOf } from "@/lib/build/making";
import { REF_KIND } from "@/lib/build/postRefs";
import type { ReferenceBridge } from "@/lib/build/referenceBridge";
import { dropFile, dropNodes, goingWith } from "@/lib/build/removeNodes";
import { flatRows, tilesOfSession } from "@/lib/build/sessionEdit";
import { orderKeys } from "@/lib/build/sessionLayout";
import { refTo } from "@/lib/build/thread";

import { ClearBuildDialog } from "./ClearBuildDialog";
import { SessionRemoveWindow, type SessionRemoval } from "./removePieces";
import { buildSessionRowsKey } from "./useComposeSessions";
import type { BuildHistoryApi } from "./useBuildHistory";
import type { ComposeNodes } from "./useComposeNodes";

/** What the page hands the actions. */
export interface BuildActionsInput {
  buildId: string | undefined;
  /** `builds.making` as saved: the parts, for what clearing would take. */
  made: unknown;
  /** The page lets go of a session it was adding to, once the build is cleared. */
  onCleared?: () => void;
  nodes: ComposeNodes;
  history: BuildHistoryApi;
  bridge: ReferenceBridge;
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  /** The session edits' removal of sessions, which writes the layout. `alsoTiles` go in the same step. */
  removeSessions: (keys: readonly string[], mode: "keep" | "all", alsoTiles?: readonly string[]) => Promise<void>;
}

export interface BuildActions {
  /** A tile at any depth, with what is nested in it. */
  removeTile: (id: string) => void;
  /** Several tiles as one step. */
  removeTiles: (ids: readonly string[]) => void;
  /** A file: out of the build and out of the tiles that use it. */
  removeFile: (fileId: string) => void;
  /** A session: at once when it holds nothing, else the session window asks. */
  askRemoveSessions: (keys: readonly string[]) => void;
  /** What is chosen, as one step: tiles go at once; with sessions among them the session window asks, worded for all. */
  removeSelection: (items: readonly Chosen[]) => void;
  /** CA-20 P6: Recently removed, in the build's menu. Absent: the item is not drawn. */
  recentlyRemoved?: { count: number; open: () => void };
  /** CA-20 P4: Clear the build, from the build's menu. */
  clear: {
    /** What clearing would take; all zero when the build is empty. */
    counts: ClearCounts;
    /** Opens the window that asks. */
    ask: () => void;
  };
}

export const BuildActionsContext = createContext<BuildActions | null>(null);

/** The page's actions, or none outside the composer. */
export const useBuildActionsContext = (): BuildActions | null => useContext(BuildActionsContext);

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children), ...flatten(step.sentWith ?? [])]);

/** "Prompt 3", "Team 11", "Code order-form.tsx": a tile as the screen names it. */
export const tileName = (step: Pick<Step, "kind" | "number" | "title" | "defaultTitle">): string => `${REF_KIND[step.kind] ?? "Prompt"} ${step.number || stepTitle(step)}`;

/** The tiles inside a step, for "and its 3 agents". */
function insideOf(step: Step): { count: number; what: "agents" | "tiles" } {
  if (step.kind === "team") return { count: step.children.length, what: "agents" };
  return { count: flatten([...step.children, ...(step.sentWith ?? [])]).length, what: "tiles" };
}

export function useBuildActions({ buildId, made, onCleared, nodes, history, bridge, steps, groups, removeSessions }: BuildActionsInput): { actions: BuildActions; dialogs: ReactNode } {
  const queryClient = useQueryClient();
  const [removal, setRemoval] = useState<SessionRemoval | null>(null);
  const [clearing, setClearing] = useState(false);

  const removeTiles = useCallback(
    (ids: readonly string[]) => {
      const flat = flatten(steps);
      const picked = ids.flatMap((id) => flat.find((step) => step.id === id && !step.id.includes(":")) ?? []);
      // A tile inside another that is also going goes with it, not twice.
      const tops = picked.filter((step) => !picked.some((other) => other !== step && flatten([other]).some((inner) => inner.id === step.id && inner !== other)));
      if (tops.length === 0) return;
      const sentence = tops.length === 1 ? REMOVE_COPY.tile(tileName(tops[0]), insideOf(tops[0])) : REMOVE_COPY.several(0, tops.length);
      void history
        .track(
          sentence,
          async () => {
            const going = goingWith(nodes.current(), tops.map((step) => step.id));
            // What points at them is let go first, so the size rule has run before they are gone.
            bridge.release(going.map((id) => refTo({ kind: "node", id })));
            await nodes.run(() => dropNodes(nodes, tops.map((step) => step.id)));
          },
          { notice: true },
        )
        .catch((cause) => console.error("[Compose] tiles not removed", cause));
    },
    [steps, nodes, history, bridge],
  );

  const removeTile = useCallback((id: string) => removeTiles([id]), [removeTiles]);

  const removeFile = useCallback(
    (fileId: string) => {
      const node = flattenNodes(nodes.current()).find((entry) => entry.id === fileId);
      if (!node) return;
      const payload = (node.payload ?? {}) as { title?: unknown };
      const name = typeof payload.title === "string" && payload.title ? payload.title : (node.title ?? "that file");
      void history
        .track(
          REMOVE_COPY.file(name),
          async () => {
            const going = goingWith(nodes.current(), [fileId]);
            bridge.release(going.map((id) => refTo({ kind: "node", id })));
            await nodes.run(() => dropFile(nodes, fileId));
          },
          { notice: true },
        )
        .catch((cause) => console.error("[Compose] file not removed", cause));
    },
    [nodes, history, bridge],
  );

  const askRemoveSessions = useCallback(
    (keys: readonly string[]) => {
      const shown = orderKeys(groups);
      const removing = shown.filter((key) => keys.includes(key));
      if (removing.length === 0) return;
      const tiles = removing.reduce((sum, key) => sum + tilesOfSession(steps, groups, key).length, 0);
      // A session with nothing in it goes at once.
      if (tiles === 0) {
        void removeSessions(removing, "all");
        return;
      }
      const left = shown.filter((key) => !removing.includes(key));
      setRemoval({ keys: removing, numbers: removing.map((key) => groups.find((entry) => groupKey(entry) === key)?.number ?? 0), tiles, canKeep: left.length > 0 });
    },
    [groups, steps, removeSessions],
  );

  const removeSelection = useCallback(
    (items: readonly Chosen[]) => {
      const { tiles, sessions } = kindsIn(items);
      if (sessions.length === 0) return removeTiles(tiles);
      const shown = orderKeys(groups);
      const removing = shown.filter((key) => sessions.includes(key));
      if (removing.length === 0) return removeTiles(tiles);
      // A tile in a chosen session goes with it, and is not counted twice.
      const inside = new Set(removing.flatMap((key) => tilesOfSession(steps, groups, key)).flatMap((step) => flatten([step]).map((entry) => entry.id)));
      const extra = tiles.filter((id) => !inside.has(id));
      const count = removing.reduce((sum, key) => sum + tilesOfSession(steps, groups, key).length, 0);
      if (count === 0 && extra.length === 0) {
        void removeSessions(removing, "all");
        return;
      }
      const left = shown.filter((key) => !removing.includes(key));
      setRemoval({ keys: removing, numbers: removing.map((key) => groups.find((entry) => groupKey(entry) === key)?.number ?? 0), tiles: count, alsoTiles: extra.length, alsoIds: extra, canKeep: left.length > 0 });
    },
    [groups, steps, removeTiles, removeSessions],
  );

  /* ── Clear the build ── */

  const clearCounts = useMemo<ClearCounts>(() => {
    const tree = nodes.tree;
    return {
      parts: storedWorkstreamsOf(made).length,
      sessions: orderKeys(groups).length,
      tiles: flatten(steps).filter((step) => step.kind !== "file").length,
      files: tree.filter((node) => node.type === FILE_TYPE && node.parent_id === null).length,
    };
  }, [nodes.tree, made, groups, steps]);

  const clearBuild = useCallback(async () => {
    if (!buildId) return;
    await history
      .track(
        REMOVE_COPY.cleared,
        async () => {
          const tree = nodes.current();
          // Everything that points at something that is going is let go first: its groups, and the words that link to it.
          const refs = [
            ...flatRows(tree).map((row) => refTo({ kind: "node", id: row.id })),
            ...orderKeys(groups).map((key) => refTo({ kind: "session", id: key })),
            ...storedWorkstreamsOf(made).map((part) => refTo({ kind: "workstream", id: part.key })),
          ];
          bridge.release(refs);
          await nodes.run(async () => {
            await dropNodes(nodes, tree.map((node) => node.id));
            for (const row of await listBuildSessionRows(buildId).catch(() => [])) await deleteBuildSession(buildId, row.sessionKey).catch(() => undefined);
            await patchMaking(buildId, { sessions_meta: {}, session_order: [], workstreams: [], sessions_collapsed: [] });
          });
          await refreshMakingStats(buildId).catch(() => undefined);
          onCleared?.();
          await Promise.all([queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(buildId) }), queryClient.invalidateQueries({ queryKey: buildSessionRowsKey(buildId) }), queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] })]);
        },
        { notice: true },
      )
      .catch((cause) => console.error("[Compose] build not cleared", cause));
  }, [buildId, history, nodes, groups, made, bridge, onCleared, queryClient]);

  const actions = useMemo<BuildActions>(
    () => ({ removeTile, removeTiles, removeFile, askRemoveSessions, removeSelection, clear: { counts: clearCounts, ask: () => setClearing(true) } }),
    [removeTile, removeTiles, removeFile, askRemoveSessions, removeSelection, clearCounts],
  );

  const dialogs = (
    <>
      <ClearBuildDialog
        open={clearing}
        counts={clearCounts}
        onClose={() => setClearing(false)}
        onConfirm={() => {
          setClearing(false);
          void clearBuild();
        }}
      />
    <SessionRemoveWindow
      removal={removal}
      onClose={() => setRemoval(null)}
      onChoose={(mode) => {
        const asked = removal;
        setRemoval(null);
        if (asked) void removeSessions(asked.keys, mode, asked.alsoIds);
      }}
    />
    </>
  );

  return { actions, dialogs };
}

const flattenNodes = <T extends { children?: T[] }>(tree: readonly T[]): T[] => tree.flatMap((node) => [node, ...flattenNodes(node.children ?? [])]);
