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
