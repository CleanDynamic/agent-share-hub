// CA-21 P1: where a tile, a session or a part goes when it moves. PURE. The one place that says so.
//
// Move up and Move down in the menus, Option or Alt with the arrow keys, keyboard dragging and the live order of a drag all
// ask `moveBy` or the `place*` functions below, so a tile never moves one way from a menu and another way from the mouse.
//
// THE MODEL is the build as an order: parts hold sessions, sessions hold top-level tiles, and a tile that holds tiles
// (a team's agents, the tiles sent with a message) has siblings. Nothing here knows about rows or positions: `writeOf`
// says what changed in the words the writers take (`reassign` and `atEnd` for `applyLayout`, `moveSessionToWorkstream`,
// `droppedKey`, `moveWorkstream`), and the page writes it.

export interface MovePart {
  /** The part's key. Empty while the build draws no parts. */
  key: string;
  /** Its sessions' keys, in order. */
  sessions: string[];
}

export interface MoveModel {
  /** The parts in order. A build that draws no parts has one, with an empty key, holding every session. */
  parts: MovePart[];
  /** Whether the build draws parts (two or more). */
  hasParts: boolean;
  /** A session's top-level tiles, in order. Every session in `parts` has an entry. */
  tiles: Record<string, string[]>;
  /** Tiles that sit inside another tile, by that tile's id: its siblings in order. */
  nested: Record<string, string[]>;
  /** Tiles that stand in no session (a draft with no heads): they swap with each other only. */
  loose: string[];
  /** Sessions that cannot be written to (an old build's unsaved run); tiles do not cross into them. */
  fixed?: readonly string[];
}

/** Where a thing stands, for the status line and the rail. `index` is from 0. */
export interface Spot {
  part: string | null;
  session: string | null;
  parent: string | null;
  index: number;
  count: number;
}

export type MoveKind = "tile" | "nested" | "loose" | "session" | "part";

export interface Move {
  kind: MoveKind;
  id: string;
  from: Spot;
  to: Spot;
  /** Whether it left the session (a tile), the part (a session) it was in. */
  crossed: boolean;
}

export interface MoveResult {
  move: Move;
  model: MoveModel;
}

export const emptyModel = (): MoveModel => ({ parts: [{ key: "", sessions: [] }], hasParts: false, tiles: {}, nested: {}, loose: [] });

/** The sessions in the one order. */
export const flatOrder = (model: MoveModel): string[] => model.parts.flatMap((part) => part.sessions);

const without = <T,>(list: readonly T[], item: T): T[] => list.filter((entry) => entry !== item);

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** `list` with `item` put at `index` (clamped), taken from wherever it was. */
function inserted<T>(list: readonly T[], item: T, index: number): T[] {
  const rest = without(list, item);
  rest.splice(clamp(index, 0, rest.length), 0, item);
  return rest;
}

export type Found =
  | { kind: "tile"; session: string; index: number }
  | { kind: "nested"; parent: string; index: number }
  | { kind: "loose"; index: number }
  | { kind: "session"; part: string; index: number }
  | { kind: "part"; index: number };

/** What `id` is in the model and where it stands. Null when it is nothing in it. */
export function locate(model: MoveModel, id: string): Found | null {
  for (const [session, list] of Object.entries(model.tiles)) {
    const index = list.indexOf(id);
    if (index >= 0) return { kind: "tile", session, index };
  }
  for (const [parent, list] of Object.entries(model.nested)) {
    const index = list.indexOf(id);
    if (index >= 0) return { kind: "nested", parent, index };
  }
  const loose = model.loose.indexOf(id);
  if (loose >= 0) return { kind: "loose", index: loose };
  for (const part of model.parts) {
    const index = part.sessions.indexOf(id);
    if (index >= 0) return { kind: "session", part: part.key, index };
  }
  const index = model.parts.findIndex((part) => part.key === id);
  if (index >= 0 && model.hasParts) return { kind: "part", index };
  return null;
}

/** The spot of `id` in `model`. */
export function spotOf(model: MoveModel, id: string): Spot | null {
  const found = locate(model, id);
  if (!found) return null;
  if (found.kind === "tile") return { part: partOfSession(model, found.session), session: found.session, parent: null, index: found.index, count: model.tiles[found.session].length };
  if (found.kind === "nested") return { part: null, session: null, parent: found.parent, index: found.index, count: model.nested[found.parent].length };
  if (found.kind === "loose") return { part: null, session: null, parent: null, index: found.index, count: model.loose.length };
  if (found.kind === "session") return { part: found.part || null, session: id, parent: null, index: found.index, count: model.parts.find((part) => part.key === found.part)?.sessions.length ?? 0 };
  return { part: id, session: null, parent: null, index: found.index, count: model.parts.length };
}

export function partOfSession(model: MoveModel, session: string): string | null {
  const part = model.parts.find((entry) => entry.sessions.includes(session));
  return part && part.key ? part.key : null;
}

/* ── placing: the model after a thing is put somewhere ── */

/** A top-level tile put in `session` at `index`. */
export function placeTile(model: MoveModel, id: string, session: string, index: number): MoveModel {
  if (!model.tiles[session] && !model.parts.some((part) => part.sessions.includes(session))) return model;
  const tiles: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(model.tiles)) tiles[key] = key === session ? list : without(list, id);
  tiles[session] = inserted(model.tiles[session] ?? [], id, index);
  return { ...model, tiles };
}

/** A tile put at `index` among its siblings. */
export function placeNested(model: MoveModel, id: string, index: number): MoveModel {
  const found = locate(model, id);
  if (!found || found.kind !== "nested") return model;
  return { ...model, nested: { ...model.nested, [found.parent]: inserted(model.nested[found.parent], id, index) } };
}

/** A session put in `part` at `index` among its sessions. */
export function placeSession(model: MoveModel, key: string, part: string, index: number): MoveModel {
  if (!model.parts.some((entry) => entry.key === part)) return model;
  const parts = model.parts.map((entry) => ({ ...entry, sessions: entry.key === part ? inserted(entry.sessions, key, index) : without(entry.sessions, key) }));
  return { ...model, parts };
}

/** A part put at `index` among the parts. */
export function placePart(model: MoveModel, key: string, index: number): MoveModel {
  const at = model.parts.findIndex((part) => part.key === key);
  if (at < 0 || !model.hasParts) return model;
  const parts = [...model.parts];
  const [part] = parts.splice(at, 1);
  parts.splice(clamp(index, 0, parts.length), 0, part);
  return { ...model, parts };
}

/** Whether two models draw the same. */
export function sameModel(a: MoveModel, b: MoveModel): boolean {
  return JSON.stringify([a.parts, a.tiles, a.nested, a.loose]) === JSON.stringify([b.parts, b.tiles, b.nested, b.loose]);
}

/* ── moving by one place ── */

const writable = (model: MoveModel, session: string): boolean => !model.fixed?.includes(session);

/**
 * `id` moved one place up (-1) or down (1), or null at the very first or last place in the build.
 *
 * A tile passes the tile next to it, whatever either is. At the edge of its session it goes to the end of the session above or
 * the start of the session below, across parts. A session passes its neighbour in its part and, at the edge, goes into the next
 * part. A part passes its neighbour. A tile inside another moves among its siblings only.
 */
export function moveBy(model: MoveModel, id: string, by: -1 | 1): MoveResult | null {
  const found = locate(model, id);
  const from = spotOf(model, id);
  if (!found || !from) return null;

  if (found.kind === "nested") {
    const to = found.index + by;
    if (to < 0 || to >= model.nested[found.parent].length) return null;
    const next = placeNested(model, id, to);
    return { move: { kind: "nested", id, from, to: spotOf(next, id) as Spot, crossed: false }, model: next };
  }

  if (found.kind === "loose") {
    const to = found.index + by;
    if (to < 0 || to >= model.loose.length) return null;
    const next = { ...model, loose: inserted(model.loose, id, to) };
    return { move: { kind: "loose", id, from, to: spotOf(next, id) as Spot, crossed: false }, model: next };
  }

  if (found.kind === "tile") {
    const list = model.tiles[found.session];
    const to = found.index + by;
    if (to >= 0 && to < list.length) {
      const next = placeTile(model, id, found.session, to);
      return { move: { kind: "tile", id, from, to: spotOf(next, id) as Spot, crossed: false }, model: next };
    }
    // The edge of its session: the end of the one above, the start of the one below, across parts.
    const sessions = flatOrder(model);
    const target = sessions[sessions.indexOf(found.session) + by];
    if (!target || !writable(model, target)) return null;
    const next = placeTile(model, id, target, by === -1 ? Number.MAX_SAFE_INTEGER : 0);
    return { move: { kind: "tile", id, from, to: spotOf(next, id) as Spot, crossed: true }, model: next };
  }

  if (found.kind === "session") {
    const part = model.parts.find((entry) => entry.key === found.part) as MovePart;
    const to = found.index + by;
    if (to >= 0 && to < part.sessions.length) {
      const next = placeSession(model, id, part.key, to);
      return { move: { kind: "session", id, from, to: spotOf(next, id) as Spot, crossed: false }, model: next };
    }
    // The edge of its part: the end of the part above, the start of the part below. Never past the ends of the build.
    if (!model.hasParts) return null;
    const at = model.parts.indexOf(part) + by;
    const other = model.parts[at];
    if (!other) return null;
    const next = placeSession(model, id, other.key, by === -1 ? Number.MAX_SAFE_INTEGER : 0);
    return { move: { kind: "session", id, from, to: spotOf(next, id) as Spot, crossed: true }, model: next };
  }

  const to = found.index + by;
  if (to < 0 || to >= model.parts.length) return null;
  const next = placePart(model, id, to);
  return { move: { kind: "part", id, from, to: spotOf(next, id) as Spot, crossed: false }, model: next };
}

/** Whether `id` can move by `by`: the menus grey out the item when not. */
export const canMove = (model: MoveModel, id: string, by: -1 | 1): boolean => moveBy(model, id, by) !== null;

/* ── what to write ── */

/** What a move changes, in the words the writers take. Empty fields are not written. */
export interface Write {
  kind: MoveKind;
  id: string;
  /** A tile: the session it is in afterwards, when it changed. */
  reassign?: { id: string; session: string };
  /** A tile: the target session's tiles in their new order, handed to `applyLayout` as `atEnd`. */
  atEnd?: string[];
  /** A tile: the session whose tiles are put in order. */
  session?: string;
  /** A nested tile: its parent and its index among its siblings. */
  parent?: string;
  index?: number;
  /** A session: the one order afterwards. */
  order?: string[];
  /** A session that changed part: the part, and the session it goes before (none: the end). */
  toPart?: string;
  before?: string;
  /** A part: the part it takes the place of. */
  over?: string;
  /** A part moved by one place. */
  by?: -1 | 1;
}

/** What to write to turn `before` into `after` for the thing `id` that moved. Null when nothing moved. */
export function writeOf(before: MoveModel, after: MoveModel, id: string): Write | null {
  if (sameModel(before, after)) return null;
  const was = locate(before, id);
  const now = locate(after, id);
  if (!was || !now || was.kind !== now.kind) return null;
  if (now.kind === "tile") {
    const changed = was.kind === "tile" && was.session !== now.session;
    return { kind: "tile", id, session: now.session, atEnd: after.tiles[now.session], ...(changed ? { reassign: { id, session: now.session } } : null) };
  }
  if (now.kind === "nested") return { kind: "nested", id, parent: now.parent, index: now.index };
  if (now.kind === "loose") return { kind: "loose", id, index: now.index };
  if (now.kind === "session") {
    const crossed = was.kind === "session" && was.part !== now.part;
    if (!crossed) return { kind: "session", id, order: flatOrder(after) };
    const mine = after.parts.find((part) => part.key === now.part)?.sessions ?? [];
    return { kind: "session", id, order: flatOrder(after), toPart: now.part, before: mine[now.index + 1] };
  }
  const over = before.parts[now.index]?.key;
  return { kind: "part", id, over, by: now.index > (was as { index: number }).index ? 1 : -1 };
}

/* ── what the status line says ── */

export interface MoveNames {
  tile: (id: string) => string;
  session: (key: string) => string;
  part: (key: string) => string;
}

const place = (spot: Spot) => `${spot.index + 1} of ${spot.count}`;

/** "Moved Prompt 3 to Session 1." The place a thing stands in, as the rail numbers it: "Session 2 · 2 of 3". */
export function whereIs(spot: Spot, kind: MoveKind, names: MoveNames): string {
  if (kind === "tile") return `${spot.session ? names.session(spot.session) : "the build"} · ${place(spot)}`;
  if (kind === "session") return `${spot.part ? names.part(spot.part) : "the build"} · ${place(spot)}`;
  if (kind === "part") return `Build · ${place(spot)}`;
  return place(spot);
}

export function movedLine(move: Move, names: MoveNames): string {
  const { id, to } = move;
  if (move.kind === "tile") {
    const who = names.tile(id);
    return move.crossed || move.from.session !== to.session ? `Moved ${who} to ${to.session ? names.session(to.session) : "the build"}.` : `Moved ${who} to ${place(to)} in ${to.session ? names.session(to.session) : "the build"}.`;
  }
  if (move.kind === "session") {
    const who = names.session(id);
    return move.crossed && to.part ? `Moved ${who} to ${names.part(to.part)}.` : `Moved ${who} to ${place(to)}.`;
  }
  if (move.kind === "part") return `Moved ${names.part(id)} to ${place(to)}.`;
  return `Moved ${names.tile(id)} to ${place(to)}.`;
}

/** The sentence a step of the history is named by: "Moved Prompt 3 up", "Moved Session 2 down". */
export const movedStep = (name: string, by: -1 | 1): string => `Moved ${name} ${by === -1 ? "up" : "down"}`;

/* ── the model of a list ── */

/** What the model reads of a step. */
export interface ModelStep {
  id: string;
  number: string;
  children?: readonly ModelStep[];
  sentWith?: readonly ModelStep[];
}

/** What the model reads of a session's head. */
export interface ModelHead {
  key: string;
}

/**
 * The model of the List as it is drawn. A session's head starts its run and every step after it, of any kind, belongs to it until
 * the next head; steps before any head stand on their own (`loose`). Sessions with no tile are in their part with none.
 * `parts` are the build's parts when it draws two or more; with none, one part holds every session.
 */
export function moveModelOf(input: {
  steps: readonly ModelStep[];
  /** The head that starts at a step, by the step's number. */
  heads: ReadonlyMap<string, ModelHead>;
  /** Sessions with no tile, with the number they are drawn at. */
  empties?: readonly (ModelHead & { number: number })[];
  /** Every session's number, to put an empty one where its number says. */
  numberOf?: ReadonlyMap<string, number>;
  parts?: readonly { key: string; sessions: readonly string[] }[] | null;
}): MoveModel {
  const order: string[] = [];
  const tiles: Record<string, string[]> = {};
  const nested: Record<string, string[]> = {};
  const loose: string[] = [];
  const fixed: string[] = [];
  let current: string | null = null;
  const note = (step: ModelStep) => {
    const inside = step.sentWith?.length ? step.sentWith : step.children;
    if (inside && inside.length > 0) nested[step.id] = inside.map((child) => child.id);
    for (const child of [...(step.sentWith ?? []), ...(step.children ?? [])]) note(child);
  };
  for (const step of input.steps) {
    const head = input.heads.get(step.number);
    if (head) {
      current = head.key;
      order.push(head.key);
      tiles[head.key] = [];
      if (head.key.startsWith("typed-legacy-")) fixed.push(head.key);
    }
    if (current) tiles[current].push(step.id);
    else loose.push(step.id);
    note(step);
  }
  for (const empty of [...(input.empties ?? [])].sort((a, b) => a.number - b.number)) {
    if (empty.key in tiles) continue;
    tiles[empty.key] = [];
    order.push(empty.key);
  }
  const shown = new Set(order);
  const parts: MovePart[] =
    input.parts && input.parts.length >= 2
      ? input.parts.map((part) => ({ key: part.key, sessions: part.sessions.filter((key) => shown.has(key)) }))
      : [{ key: "", sessions: order }];
  return { parts, hasParts: parts.length >= 2 && Boolean(parts[0].key), tiles, nested, loose, ...(fixed.length > 0 ? { fixed } : null) };
}
