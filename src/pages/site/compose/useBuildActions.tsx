/* CA-20 P2 and after: what the maker can do to the build's components, in one place: remove, and (P3 to P7) select, clear,
   duplicate, convert, group and ungroup.

   The menus, the selection bar, the title row and the keys all call these through `BuildActionsContext`, so a tile's menu,
   Delete and the selection bar do the same thing in the same words. Each change is one step of the build's history: the notice
   says it with Undo, and the title row's Undo takes it back.

   REMOVING. A tile goes at once, with whatever is nested in it and the files its tiles make. A session with no tiles goes at once;
   one with tiles asks first (the session window: Cancel, Keep the tiles, Remove all). A part goes at once, its sessions joining the
   one next to it. A file goes at once, and out of the tiles that use it. What points at a component (its group, its colour, the
   words in the post that link to it) is let go first, through the reference bridge, and comes back with it on Undo. */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { REMOVE_COPY } from "@/lib/build/componentMenus";
import { groupKey, stepTitle, type SessionGroup, type Step } from "@/lib/build/graph";
import { REF_KIND } from "@/lib/build/postRefs";
import type { ReferenceBridge } from "@/lib/build/referenceBridge";
import { dropFile, dropNodes, goingWith } from "@/lib/build/removeNodes";
import { tilesOfSession } from "@/lib/build/sessionEdit";
import { orderKeys } from "@/lib/build/sessionLayout";
import { refTo } from "@/lib/build/thread";

import { SessionRemoveWindow, type SessionRemoval } from "./removePieces";
import type { BuildHistoryApi } from "./useBuildHistory";
import type { ComposeNodes } from "./useComposeNodes";

/** What the page hands the actions. */
export interface BuildActionsInput {
  nodes: ComposeNodes;
  history: BuildHistoryApi;
  bridge: ReferenceBridge;
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  /** The session edits' removal of sessions, which writes the layout. */
  removeSessions: (keys: readonly string[], mode: "keep" | "all") => Promise<void>;
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

export function useBuildActions({ nodes, history, bridge, steps, groups, removeSessions }: BuildActionsInput): { actions: BuildActions; dialogs: ReactNode } {
  const [removal, setRemoval] = useState<SessionRemoval | null>(null);

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

  const actions = useMemo<BuildActions>(() => ({ removeTile, removeTiles, removeFile, askRemoveSessions }), [removeTile, removeTiles, removeFile, askRemoveSessions]);

  const dialogs = (
    <SessionRemoveWindow
      removal={removal}
      onClose={() => setRemoval(null)}
      onChoose={(mode) => {
        const asked = removal;
        setRemoval(null);
        if (asked) void removeSessions(asked.keys, mode);
      }}
    />
  );

  return { actions, dialogs };
}

const flattenNodes = <T extends { children?: T[] }>(tree: readonly T[]): T[] => tree.flatMap((node) => [node, ...flattenNodes(node.children ?? [])]);
