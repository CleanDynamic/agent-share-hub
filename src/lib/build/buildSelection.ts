// buildSelection: choosing several tiles and sessions at once (CA-20 P3). PURE.
//
// WHAT CAN BE CHOSEN. A tile (any, at any depth) or a session. They are chosen as the screen draws them: Cmd or Ctrl click adds
// one or takes it off, Shift click adds everything from the one chosen last to the one clicked, in the order the build is drawn.
// The `order` is that order: each session's head, then its top-level tiles.
//
// WHAT THE SELECTION SAYS. A selection of two or more opens the selection bar; what it can do depends on what it holds (tiles
// can move to a session, sessions to a part; anything in a group can leave it).

export type ChosenKind = "tile" | "session";

export interface Chosen {
  kind: ChosenKind;
  id: string;
}

export const chosenKey = (pick: Chosen): string => `${pick.kind}:${pick.id}`;
export const sameChosen = (a: Chosen, b: Chosen): boolean => a.kind === b.kind && a.id === b.id;

/** The picks in the order the build is drawn: a session, then its tiles. */
export interface Drawn {
  /** A session key, and its top-level tiles' ids in order. Tiles with no session of their own come first under `null`. */
  sessions: readonly { key: string | null; tiles: readonly string[] }[];
}

/** Every pick of the build, in the order drawn. */
export function orderOf(drawn: Drawn): Chosen[] {
  return drawn.sessions.flatMap((session) => [...(session.key ? [{ kind: "session" as const, id: session.key }] : []), ...session.tiles.map((id) => ({ kind: "tile" as const, id }))]);
}

/** Cmd or Ctrl click: the pick joins the selection, or leaves it when it was there. */
export function toggled(selection: readonly Chosen[], pick: Chosen): Chosen[] {
  return selection.some((entry) => sameChosen(entry, pick)) ? selection.filter((entry) => !sameChosen(entry, pick)) : [...selection, pick];
}

/** Shift click: everything from `anchor` to `to`, both included, joins the selection. With no anchor it is `to` alone. */
export function extended(selection: readonly Chosen[], order: readonly Chosen[], anchor: Chosen | null, to: Chosen): Chosen[] {
  const at = order.findIndex((entry) => sameChosen(entry, to));
  const from = anchor ? order.findIndex((entry) => sameChosen(entry, anchor)) : -1;
  if (at < 0) return [...selection];
  if (from < 0) return selection.some((entry) => sameChosen(entry, to)) ? [...selection] : [...selection, to];
  const [low, high] = from < at ? [from, at] : [at, from];
  const range = order.slice(low, high + 1);
  return [...selection, ...range.filter((entry) => !selection.some((chosen) => sameChosen(chosen, entry)))];
}

/** Every tile of the build: Cmd or Ctrl A. */
export const allTiles = (order: readonly Chosen[]): Chosen[] => order.filter((entry) => entry.kind === "tile");

/** Every tile of one session: "Select all in this session". */
export function tilesOfSession(drawn: Drawn, key: string): Chosen[] {
  return (drawn.sessions.find((session) => session.key === key)?.tiles ?? []).map((id) => ({ kind: "tile" as const, id }));
}

/** The selection in drawn order, so the bar and every action read it the way the build does. */
export function inOrder(selection: readonly Chosen[], order: readonly Chosen[]): Chosen[] {
  const rank = new Map(order.map((entry, at) => [chosenKey(entry), at]));
  return [...selection].sort((a, b) => (rank.get(chosenKey(a)) ?? Infinity) - (rank.get(chosenKey(b)) ?? Infinity));
}

/** What the selection holds. */
export function kindsIn(selection: readonly Chosen[]): { tiles: string[]; sessions: string[] } {
  return { tiles: selection.filter((entry) => entry.kind === "tile").map((entry) => entry.id), sessions: selection.filter((entry) => entry.kind === "session").map((entry) => entry.id) };
}

/** The bar opens with two or more chosen. */
export const barShown = (selection: readonly Chosen[]): boolean => selection.length >= 2;

export const SELECTION_COPY = {
  count: (n: number) => `${n} selected`,
  moveTo: "Move to…",
  duplicate: "Duplicate",
  group: "Group",
  ungroup: "Ungroup",
  remove: "Remove",
  clear: "Clear selection",
  sessions: "Sessions",
  parts: "Parts",
  noPlace: "No other place to move them to",
} as const;
