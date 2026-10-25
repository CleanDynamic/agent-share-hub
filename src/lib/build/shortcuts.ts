// shortcuts (CA-20 P8): the keys of the build page, in one list. The window that lists them, the labels at the right of menu
// items and the tooltips of the title row all read this, so a key is named once.

export type ShortcutGroup = "Build" | "Choosing" | "Moving around" | "Components";

export interface Shortcut {
  id: ShortcutId;
  group: ShortcutGroup;
  /** What it does, in the window's words. */
  label: string;
  /** The keys on a Mac, then on everything else. */
  mac: string;
  other: string;
}

export type ShortcutId = "help" | "find" | "undo" | "redo" | "save" | "escape" | "selectAll" | "up" | "down" | "first" | "last" | "remove" | "duplicate" | "group" | "ungroup" | "moveUp" | "moveDown" | "foldAll";

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "help", group: "Build", label: "Keyboard shortcuts", mac: "?", other: "?" },
  { id: "find", group: "Build", label: "Find in build", mac: "/", other: "/" },
  { id: "undo", group: "Build", label: "Undo", mac: "⌘Z", other: "Ctrl+Z" },
  { id: "redo", group: "Build", label: "Redo", mac: "⇧⌘Z", other: "Ctrl+Y" },
  { id: "save", group: "Build", label: "Save", mac: "⌘S", other: "Ctrl+S" },
  { id: "escape", group: "Build", label: "Close a menu or window, then end a selection", mac: "Esc", other: "Esc" },
  { id: "selectAll", group: "Choosing", label: "Choose every tile", mac: "⌘A", other: "Ctrl+A" },
  { id: "up", group: "Moving around", label: "Previous tile", mac: "↑", other: "↑" },
  { id: "down", group: "Moving around", label: "Next tile", mac: "↓", other: "↓" },
  { id: "first", group: "Moving around", label: "First tile", mac: "Home", other: "Home" },
  { id: "last", group: "Moving around", label: "Last tile", mac: "End", other: "End" },
  { id: "remove", group: "Components", label: "Remove the chosen", mac: "⌫", other: "Delete" },
  { id: "duplicate", group: "Components", label: "Duplicate", mac: "⌘D", other: "Ctrl+D" },
  { id: "group", group: "Components", label: "Group", mac: "⌘G", other: "Ctrl+G" },
  { id: "ungroup", group: "Components", label: "Ungroup", mac: "⇧⌘G", other: "Ctrl+Shift+G" },
  { id: "moveUp", group: "Components", label: "Move up", mac: "⌥↑", other: "Alt+↑" },
  { id: "moveDown", group: "Components", label: "Move down", mac: "⌥↓", other: "Alt+↓" },
];

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ["Build", "Choosing", "Moving around", "Components"];

export const SHORTCUT_COPY = { title: "Keyboard shortcuts", item: "Keyboard shortcuts", done: "Done", saved: "Saved" } as const;

export const isMac = (): boolean => typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");

/** The keys of one shortcut, as this computer names them. */
export function shortcutLabel(id: ShortcutId, mac: boolean = isMac()): string {
  const found = SHORTCUTS.find((entry) => entry.id === id);
  return found ? (mac ? found.mac : found.other) : "";
}

/** Which shortcut a key press is, or null. Pure: the page decides whether it may act. */
export function shortcutOf(event: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }, mac: boolean = isMac()): ShortcutId | null {
  const mod = mac ? event.metaKey : event.ctrlKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) return "help";
  if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) return "find";
  if (mod && !event.altKey) {
    if (key === "z") return event.shiftKey ? "redo" : "undo";
    if (key === "y" && !mac && !event.shiftKey) return "redo";
    if (key === "s" && !event.shiftKey) return "save";
    if (key === "a" && !event.shiftKey) return "selectAll";
    if (key === "d" && !event.shiftKey) return "duplicate";
    if (key === "g") return event.shiftKey ? "ungroup" : "group";
    return null;
  }
  if (event.metaKey || event.ctrlKey) return null;
  if (event.altKey && !event.shiftKey) {
    if (key === "ArrowUp") return "moveUp";
    if (key === "ArrowDown") return "moveDown";
    return null;
  }
  if (event.altKey || event.shiftKey) return null;
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "Home":
      return "first";
    case "End":
      return "last";
    case "Delete":
    case "Backspace":
      return "remove";
    default:
      return null;
  }
}
