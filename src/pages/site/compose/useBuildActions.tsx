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
import { restoreSnapshot } from "@/lib/build/buildSnapshot";
import { CONVERT_COPY, canConvert, convertRow, convertTiles, duplicateTiles, DUPLICATE_COPY, targetsOf, type ConvertTo } from "@/lib/build/duplicate";
import { DEFAULT_AGENT_MODEL } from "./AddAgentDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { ConvertWindow, type Conversion } from "./ConvertWindow";
import { REMOVED_COPY, type RemovedMeta } from "@/lib/build/removedLog";
import { FILE_TYPE, groupKey, stepTitle, type SessionGroup, type Step } from "@/lib/build/graph";
import { patchMaking, refreshMakingStats, storedWorkstreamsOf } from "@/lib/build/making";
import { REF_KIND } from "@/lib/build/postRefs";
import { BRIDGE_COPY, type ReferenceBridge } from "@/lib/build/referenceBridge";
import type { ReferenceGroup } from "@/lib/build/referenceGroups";
import { dropFile, dropNodes, goingWith } from "@/lib/build/removeNodes";
import { flatRows, tilesOfSession } from "@/lib/build/sessionEdit";
import { orderKeys } from "@/lib/build/sessionLayout";
import { refTo } from "@/lib/build/thread";

import { ClearBuildDialog } from "./ClearBuildDialog";
import { RecentlyRemovedDialog } from "./RecentlyRemovedDialog";
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
  /** CA-20 P7: Collapse all and Expand all. Absent: the item is not drawn. */
  fold?: { anyOpen: boolean; run: (closed: boolean) => void };
  /** CA-20 P7: a group was just made; the page opens CA-19's window on it. */
  onGrouped?: (group: ReferenceGroup) => void;
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
  /** CA-20 P7: copy tiles (each below its original, as one step). */
  duplicate: (ids: readonly string[]) => void;
  /** CA-20 P7: what a tile can be turned into, with the reason when it cannot. */
  convertTargets: (id: string) => { to: ConvertTo; label: string; reason?: string }[];
  /** CA-20 P7: turn a tile into another kind; asks first when something would not carry over. */
  convert: (id: string, to: ConvertTo) => void;
  /** CA-20 P7: Collapse all or Expand all, from the View menu. */
  fold?: { anyOpen: boolean; run: (closed: boolean) => void };
  /** CA-20 P7: put tiles in a group (the group's window opens), or take them out. */
  group: (ids: readonly string[]) => void;
  ungroup: (ids: readonly string[]) => void;
  /** Whether a tile is in a group. */
  grouped: (id: string) => boolean;
  /** CA-20 P8: the window that lists the keys. */
  shortcuts: { open: () => void };
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

export function useBuildActions({ buildId, made, onCleared, nodes, history, bridge, steps, groups, removeSessions, fold, onGrouped }: BuildActionsInput): { actions: BuildActions; dialogs: ReactNode } {
  const queryClient = useQueryClient();
  const [removal, setRemoval] = useState<SessionRemoval | null>(null);
  const [clearing, setClearing] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [converting, setConverting] = useState<Conversion | null>(null);

  const removeTiles = useCallback(
    (ids: readonly string[]) => {
      const flat = flatten(steps);
      const picked = ids.flatMap((id) => flat.find((step) => step.id === id && !step.id.includes(":")) ?? []);
      // A tile inside another that is also going goes with it, not twice.
      const tops = picked.filter((step) => !picked.some((other) => other !== step && flatten([other]).some((inner) => inner.id === step.id && inner !== other)));
      if (tops.length === 0) return;
      const sentence = tops.length === 1 ? REMOVE_COPY.tile(tileName(tops[0]), insideOf(tops[0])) : REMOVE_COPY.several(0, tops.length);
      const inside = tops.length === 1 ? insideOf(tops[0]) : null;
      const removed: RemovedMeta = {
        kind: "tile",
        badge: tops.length === 1 ? tops[0].number : String(tops.length),
        name: tops.length === 1 ? tileName(tops[0]) : `${tops.length} tiles`,
        ...(inside && inside.count > 0 ? { detail: `${inside.count} ${inside.what === "agents" ? (inside.count === 1 ? "agent" : "agents") : inside.count === 1 ? "tile" : "tiles"}` } : null),
      };
      void history
        .track(
          sentence,
          async () => {
            const going = goingWith(nodes.current(), tops.map((step) => step.id));
            const refs = going.map((id) => refTo({ kind: "node", id }));
            removed.refs = bridge.snapshot(refs);
            // What points at them is let go first, so the size rule has run before they are gone.
            bridge.release(refs);
            await nodes.run(() => dropNodes(nodes, tops.map((step) => step.id)));
          },
          { notice: true, removed, keys: tops.map((step) => step.id) },
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
      const removed: RemovedMeta = { kind: "file", badge: { glyph: "file" }, name };
      void history
        .track(
          REMOVE_COPY.file(name),
          async () => {
            const going = goingWith(nodes.current(), [fileId]);
            const refs = going.map((id) => refTo({ kind: "node", id }));
            removed.refs = bridge.snapshot(refs);
            bridge.release(refs);
            await nodes.run(() => dropFile(nodes, fileId));
          },
          { notice: true, removed, keys: [fileId] },
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

  /* ── Duplicate, convert, group ── */

  const duplicate = useCallback(
    (ids: readonly string[]) => {
      if (!buildId) return;
      const flat = flatten(steps);
      const picked = ids.flatMap((id) => flat.find((step) => step.id === id && !step.id.includes(":")) ?? []);
      if (picked.length === 0) return;
      const sentence = picked.length === 1 ? DUPLICATE_COPY.one(tileName(picked[0])) : DUPLICATE_COPY.several(picked.length);
      void history
        .track(sentence, () => restoreSnapshot(buildId, nodes, (current) => duplicateTiles(current, picked.map((step) => step.id), () => crypto.randomUUID()).snapshot), { notice: true, motion: "duplicate" })
        .catch((cause) => console.error("[Compose] not duplicated", cause));
    },
    [buildId, steps, nodes, history],
  );

  const rowFor = useCallback((id: string) => flattenNodes(nodes.current()).find((node) => node.id === id), [nodes]);

  const convertTargets = useCallback(
    (id: string) => {
      const row = rowFor(id);
      if (!row || !canConvert(row)) return [];
      const { children: _children, ...plain } = row as typeof row & { children?: unknown };
      return targetsOf(row).map((to) => ({ to, label: CONVERT_COPY.targets[to], reason: convertRow(plain, to, DEFAULT_AGENT_MODEL).refusal ?? undefined }));
    },
    [rowFor],
  );

  const doConvert = useCallback(
    (id: string, to: ConvertTo, name: string) => {
      if (!buildId) return;
      void history
        .track(
          CONVERT_COPY.done(name, CONVERT_COPY.targets[to]),
          () =>
            restoreSnapshot(buildId, nodes, (current) => {
              const row = current.nodes.find((entry) => entry.id === id);
              const plan = row ? convertRow(row, to, DEFAULT_AGENT_MODEL) : null;
              return plan?.row ? convertTiles(current, new Map([[id, plan.row]])) : current;
            }),
          { notice: true, motion: "convert", keys: [id] },
        )
        .catch((cause) => console.error("[Compose] not converted", cause));
    },
    [buildId, nodes, history],
  );

  const convert = useCallback(
    (id: string, to: ConvertTo) => {
      const row = rowFor(id);
      const step = flatten(steps).find((entry) => entry.id === id);
      if (!row || !step) return;
      const { children: _children, ...plain } = row as typeof row & { children?: unknown };
      const plan = convertRow(plain, to, DEFAULT_AGENT_MODEL);
      if (!plan.row) return;
      const name = tileName(step);
      if (plan.lost.length > 0) setConverting({ id, to, name, lost: plan.lost });
      else doConvert(id, to, name);
    },
    [rowFor, steps, doConvert],
  );

  const grouped = useCallback((id: string) => Boolean(bridge.groupOf(refTo({ kind: "node", id }))), [bridge]);
  const group = useCallback(
    (ids: readonly string[]) => {
      const made = bridge.makeGroup(ids.map((id) => refTo({ kind: "node", id })));
      if (made) onGrouped?.(made);
    },
    [bridge, onGrouped],
  );
  const ungroup = useCallback(
    (ids: readonly string[]) => {
      const refs = ids.map((id) => refTo({ kind: "node", id }));
      const one = refs.length === 1 ? bridge.groupOf(refs[0]) : undefined;
      const step = ids.length === 1 ? flatten(steps).find((entry) => entry.id === ids[0]) : undefined;
      bridge.ungroup(refs, one && step ? BRIDGE_COPY.ungroupedOne(tileName(step), one.name || BRIDGE_COPY.noName) : undefined);
    },
    [bridge, steps],
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
    const removed: RemovedMeta = {
      kind: "build",
      badge: { glyph: "layers" },
      name: REMOVED_COPY.whole,
      detail: [clearCounts.sessions > 0 ? `${clearCounts.sessions} ${clearCounts.sessions === 1 ? "session" : "sessions"}` : "", clearCounts.tiles > 0 ? `${clearCounts.tiles} ${clearCounts.tiles === 1 ? "tile" : "tiles"}` : "", clearCounts.files > 0 ? `${clearCounts.files} ${clearCounts.files === 1 ? "file" : "files"}` : ""].filter(Boolean).join(", "),
    };
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
          removed.refs = bridge.snapshot(refs);
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
        { notice: true, removed },
      )
      .catch((cause) => console.error("[Compose] build not cleared", cause));
  }, [buildId, history, nodes, groups, made, bridge, onCleared, queryClient, clearCounts]);

  const actions = useMemo<BuildActions>(
    () => ({
      removeTile,
      removeTiles,
      removeFile,
      askRemoveSessions,
      removeSelection,
      duplicate,
      convertTargets,
      convert,
      fold,
      group,
      ungroup,
      grouped,
      shortcuts: { open: () => setHelpOpen(true) },
      recentlyRemoved: { count: history.removed.length, open: () => setListOpen(true) },
      clear: { counts: clearCounts, ask: () => setClearing(true) },
    }),
    [removeTile, removeTiles, removeFile, askRemoveSessions, removeSelection, duplicate, convertTargets, convert, fold, group, ungroup, grouped, clearCounts, history.removed.length],
  );

  const dialogs = (
    <>
      <RecentlyRemovedDialog open={listOpen} entries={history.removed} onRestore={(id) => void history.restoreRemoved(id)} onClose={() => setListOpen(false)} />
      <ClearBuildDialog
        open={clearing}
        counts={clearCounts}
        onClose={() => setClearing(false)}
        onConfirm={() => {
          setClearing(false);
          void clearBuild();
        }}
      />
    <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    <ConvertWindow
      conversion={converting}
      onClose={() => setConverting(null)}
      onConfirm={() => {
        const asked = converting;
        setConverting(null);
        if (asked) doConvert(asked.id, asked.to, asked.name);
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
