/* CA-20 P8: the build page's keys. Mounted on the build page only; a phone has none. The keys a field, the post editor, a menu or
   a window uses are theirs: nothing here acts while one has the focus, and the browser's own keys are left alone (Cmd or Ctrl S
   and Cmd or Ctrl D are the two taken, because the page answers them). */

import { useEffect, useRef } from "react";

import { shortcutOf, SHORTCUT_COPY } from "@/lib/build/shortcuts";

import { settle, tileElement } from "./largeBuild";
import type { BuildActions } from "./useBuildActions";
import type { BuildHistoryApi } from "./useBuildHistory";
import { overlayOpen, takesKeys, type BuildSelection } from "./useBuildSelection";

export interface BuildShortcutsInput {
  phone: boolean;
  history: BuildHistoryApi;
  actions: BuildActions;
  selection: BuildSelection;
  /** The tile the page has selected, if any. */
  selectedId: string | null;
  /** Every top-level tile in the order it is drawn. */
  tiles: readonly string[];
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  openHelp: () => void;
  /** CA-27 P1: `/` opens Find in build. Absent: the key does nothing. */
  openFind?: () => void;
}

export function useBuildShortcuts(input: BuildShortcutsInput): void {
  const latest = useRef(input);
  latest.current = input;
  useEffect(() => {
    if (input.phone) return;
    const onKey = (event: KeyboardEvent) => {
      const now = latest.current;
      if (event.defaultPrevented || takesKeys(event.target) || overlayOpen()) return;
      const which = shortcutOf(event);
      if (!which) return;
      // The arrows and the rest of the movement keys belong to the page only when nothing else has focus: a button keeps its own.
      const target = event.target instanceof HTMLElement ? event.target : null;
      const free = !target || target === document.body || Boolean(target.closest("[data-node-id]"));
      const chosen = [...now.selection.tiles];
      const subject = chosen.length > 0 ? chosen : now.selectedId ? [now.selectedId] : [];
      const go = (id: string | undefined) => {
        if (!id) return;
        now.onSelect(id);
        /* A tile far from the view in a large build is not drawn until it is selected: its box is scrolled to now, its card once it is there. */
        const reveal = () => tileElement(id)?.scrollIntoView?.({ block: "nearest" });
        reveal();
        window.requestAnimationFrame(reveal);
        settle(
          () => {
            const box = tileElement(id)?.getBoundingClientRect();
            return !box || box.height === 0 || (box.top >= 0 && box.bottom <= window.innerHeight) || box.height > window.innerHeight;
          },
          reveal,
        );
      };
      const at = now.selectedId ? now.tiles.indexOf(now.selectedId) : -1;
      switch (which) {
        case "help":
          now.openHelp();
          break;
        case "find":
          if (!now.openFind) return;
          now.openFind();
          break;
        case "undo":
          if (now.history.canUndo) void now.history.undo();
          break;
        case "redo":
          if (now.history.canRedo) void now.history.redo();
          break;
        case "save":
          now.history.notify(SHORTCUT_COPY.saved);
          break;
        case "selectAll":
          return; // the selection's own handler answers it
        case "duplicate":
          if (subject.length > 0) now.actions.duplicate(subject);
          break;
        case "group":
          if (chosen.length >= 2) now.actions.group(chosen);
          break;
        case "ungroup":
          if (subject.some((id) => now.actions.grouped(id))) now.actions.ungroup(subject.filter((id) => now.actions.grouped(id)));
          break;
        case "remove":
          if (!free || subject.length === 0) return;
          if (now.selection.size > 0) now.actions.removeSelection(now.selection.items);
          else now.actions.removeTiles(subject);
          break;
        case "up":
        case "down":
        case "first":
        case "last":
          if (!free || now.tiles.length === 0) return;
          go(which === "first" ? now.tiles[0] : which === "last" ? now.tiles.at(-1) : now.tiles[Math.min(Math.max(at + (which === "down" ? 1 : -1), 0), now.tiles.length - 1)]);
          break;
        case "moveUp":
        case "moveDown":
          if (!now.selectedId || !free) return;
          now.onMove(now.selectedId, which === "moveUp" ? -1 : 1);
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [input.phone]);
}
