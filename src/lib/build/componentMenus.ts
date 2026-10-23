// componentMenus: the menu items every component shares, as pure lists (CA-20 P1, P2, P3, P7).
//
// A tile, a session, a part and a file each have a menu. The items the four share (Duplicate, Convert to…, Select all in this
// session, Ungroup, Remove) are described here, with the words they carry, the reason they are greyed when they are, and the
// key that does the same thing (`shortcut` is an id in shortcuts.ts). The menus draw them; they decide nothing.
//
// EVERY GREYED ITEM SAYS WHY. `REASONS` is the one list of those sentences, so "Already the first session" is the same
// wherever a session can be moved.

export type ComponentKind = "tile" | "session" | "part" | "file";

/** What the item is drawn as. */
export interface MenuItemSpec {
  key: string;
  label: string;
  /** An id in shortcuts.ts; the menu shows its keys at the right. */
  shortcut?: string;
  /** Greyed. A greyed item always has a `reason`. */
  disabled?: boolean;
  reason?: string;
  /** The danger text colour: only the words that remove. */
  danger?: boolean;
  /** Opens a submenu (drawn by the menu itself). */
  submenu?: boolean;
  /** A rule above it. */
  separatorBefore?: boolean;
}

export const REASONS = {
  firstSession: "Already the first session",
  lastSession: "Already the last session",
  firstTile: "Already the first tile",
  lastTile: "Already the last tile",
  firstPart: "Already the first part",
  lastPart: "Already the last part",
  onePart: "Only one part",
  oneSession: "Only one session",
  onePartOfSession: "Only one part",
  noSessionAbove: "No session above it in this part",
  sessionList: "Shows once the build has two or more sessions",
  preview: "Preview opens once the draft is saved",
  readAll: "Nothing more to read",
  startsAfter: "No sessions in other parts",
  selectTwo: "Select two or more to group",
  noTiles: "It has no tiles",
} as const;

/** The reason a move is greyed, or none when the move can be made. */
export function moveReason(kind: "tile" | "session" | "part", direction: -1 | 1, atEnd: boolean): string | undefined {
  if (!atEnd) return undefined;
  const reasons = { tile: [REASONS.firstTile, REASONS.lastTile], session: [REASONS.firstSession, REASONS.lastSession], part: [REASONS.firstPart, REASONS.lastPart] } as const;
  return reasons[kind][direction === -1 ? 0 : 1];
}

/** The copy the shared items use. */
export const MENU_COPY = {
  duplicate: "Duplicate",
  convert: "Convert to…",
  selectAllInSession: "Select all in this session",
  ungroup: "Ungroup",
  removeTile: "Remove tile",
  removeSession: "Remove session",
  removePart: "Remove part",
  removeFile: "Remove file",
} as const;

/** The one Remove item at the end of every menu, after a separator, in the danger text colour. */
export function removeItem(kind: ComponentKind): MenuItemSpec {
  const label = { tile: MENU_COPY.removeTile, session: MENU_COPY.removeSession, part: MENU_COPY.removePart, file: MENU_COPY.removeFile }[kind];
  return { key: `remove-${kind}`, label, shortcut: "remove", danger: true, separatorBefore: true };
}

/** Duplicate, in every tile's, session's and part's menu, after Move down. */
export function duplicateItem(): MenuItemSpec {
  return { key: "duplicate", label: MENU_COPY.duplicate, shortcut: "duplicate" };
}

/** "Select all in this session", placed after Edit session…. */
export function selectAllInSessionItem(): MenuItemSpec {
  return { key: "select-session", label: MENU_COPY.selectAllInSession };
}

/** Ungroup: only when the component is in a group, after the colour item, and only once the bridge is available. */
export function ungroupItem(inGroup: boolean, available: boolean): MenuItemSpec | null {
  return available && inGroup ? { key: "ungroup", label: MENU_COPY.ungroup, shortcut: "ungroup" } : null;
}

/* ── what is said when something is removed ── */

const noun = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const REMOVE_COPY = {
  /** The notice after a tile goes: "Removed Prompt 3", "Removed Team 11 and its 3 agents". */
  tile: (name: string, inside?: { count: number; what: "agents" | "tiles" }) =>
    inside && inside.count > 0 ? `Removed ${name} and its ${inside.what === "agents" ? noun(inside.count, "agent", "agents") : noun(inside.count, "tile", "tiles")}` : `Removed ${name}`,
  /** "Removed Session 2", "Removed Session 2 and its 3 tiles". */
  session: (number: number, tiles: number) => (tiles > 0 ? `Removed Session ${number} and its ${noun(tiles, "tile", "tiles")}` : `Removed Session ${number}`),
  /** "Removed Session 2. Its tiles moved to Session 1". */
  sessionKept: (number: number, into: number) => `Removed Session ${number}. Its tiles moved to Session ${into}`,
  /** "Removed Part B. Its sessions joined Part A". */
  part: (label: string, into: string) => `Removed ${label}. Its sessions joined ${into}`,
  partAlone: (label: string) => `Removed ${label}`,
  file: (name: string) => `Removed ${name}`,
  /** Several at once: "Removed 2 sessions and 4 tiles". */
  several: (sessions: number, tiles: number) => {
    const parts = [sessions > 0 ? noun(sessions, "session", "sessions") : "", tiles > 0 ? noun(tiles, "tile", "tiles") : ""].filter(Boolean);
    return `Removed ${parts.join(" and ")}`;
  },
  severalKept: (sessions: number, into: number) => `Removed ${noun(sessions, "session", "sessions")}. Their tiles moved to Session ${into}`,
  cleared: "Cleared the build",
} as const;

/** The session window's words. */
export const SESSION_WINDOW_COPY = {
  title: (number: number) => `Remove Session ${number}?`,
  /** For several: "Remove 2 sessions and 1 tile?". */
  titleMany: (sessions: number, tiles: number) => `Remove ${noun(sessions, "session", "sessions")}${tiles > 0 ? ` and ${noun(tiles, "tile", "tiles")}` : ""}?`,
  body: (tiles: number) => `It has ${noun(tiles, "tile", "tiles")}.`,
  /** "They have 5 tiles between them." */
  bodyMany: (tiles: number) => `They have ${noun(tiles, "tile", "tiles")} between them.`,
  cancel: "Cancel",
  keep: "Keep the tiles",
  keepNone: "No other session to move them to",
  all: "Remove all",
} as const;

/* ── the build's menu (CA-20 P4) ── */

/** What "Clear the build" would take away. */
export interface ClearCounts {
  parts: number;
  sessions: number;
  tiles: number;
  files: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 parts, 6 sessions, 18 tiles and 3 files", leaving out what is zero. */
export function clearList(counts: ClearCounts): string {
  const parts = [
    counts.parts > 0 ? plural(counts.parts, "part", "parts") : "",
    counts.sessions > 0 ? plural(counts.sessions, "session", "sessions") : "",
    counts.tiles > 0 ? plural(counts.tiles, "tile", "tiles") : "",
    counts.files > 0 ? plural(counts.files, "file", "files") : "",
  ].filter(Boolean);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export const CLEAR_COPY = {
  menu: "Clear the build…",
  title: "Clear the build?",
  body: (counts: ClearCounts) => `Removes ${clearList(counts)}, with their colours, groups and links. The title, the post's words and the Classification Card stay.`,
  cancel: "Cancel",
  confirm: "Clear the build",
  /** Greyed while there is nothing in the build. */
  nothing: "The build is empty",
  options: "Build options",
  recentlyRemoved: "Recently removed…",
  shortcuts: "Keyboard shortcuts",
} as const;
