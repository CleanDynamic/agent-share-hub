// MS-03: the order the map can never break, and the two-way rules. PURE.
//
// No layout, drag or file may put a later tile before an earlier one. The build gives the facts (`orderFacts`): within a
// session each tile comes no earlier than the one before it; across sessions a tile comes no earlier than what it uses. The
// geometry gives the reading order (`bandsOf`): bands top to bottom, left to right within a band, worked out per tile from
// its own slot. `orderRefusal` holds the one against the other. Everything later asks this module.

import { groupKey, groupOfStep, type SessionGroup, type Step } from "./graph";
import { geometryOf, fitsOf, type MapGeometry, type Measure, type Rect } from "./mapGeometry";
import {
  boxOfTile,
  boxes,
  insertNode,
  moveTile,
  nodeById,
  pathTo,
  splitBox,
  swapNodes,
  type MapBox,
  type MapEnd,
  type MapLayout,
  type MapNode,
  type MapSide,
  type MapSplit,
  type TileOptions,
  type TreeResult,
} from "./mapLayout";
import { tileLinksOf, tileName, type MapPieceLike, type TileVerb } from "./sessionMap";

/** Every sentence the order and two-way rules can say. */
export const MAP_ORDER_COPY = {
  /** A link between two tiles: "Check 6 tests Code 5, so it can't come before it." */
  link: (after: string, verb: string, before: string) => `${after} ${verb} ${before}, so it can't come before it.`,
  /** Two tiles of one session: "Check 6 comes after Code 5 in Session 2." */
  session: (after: string, before: string, session: string) => `${after} comes after ${before} in ${session}.`,
  /** A Result and the tile it came from. */
  result: (before: string) => `The result comes from ${before}, so it can't come before it.`,
  sessionName: (number: number) => `Session ${number}`,
  inSequence: "These happen one after the other.",
  sameThing: "Choose two different tiles or boxes.",
  tileNotPlaced: "That tile isn't on the map.",
  boxNotPlaced: "That box isn't on the map.",
  mixedEnds: "A two-way arrow joins two tiles or two boxes.",
  emptyBox: "A two-way arrow joins boxes that hold tiles.",
  cantLevel: "They can't be level without breaking the order.",
  notLevel: "These two aren't level any more.",
};

const EPSILON = 0.01;

/* ── Part 1: what must come before what ── */

export type OrderWhy = "session" | TileVerb | "makes";

/** `after` must come no earlier than `before`. Top-level tiles (and Results) only. */
export interface OrderFact { before: string; after: string; why: OrderWhy; sentence: string }

export interface OrderFacts {
  facts: OrderFact[];
  /** Each top-level tile's session key. A Result has none. */
  sessionOf: ReadonlyMap<string, string>;
  /** Each top-level tile's place in the build, from 0; Results after every step. */
  buildOrder: ReadonlyMap<string, number>;
  /** "Prompt 4", from `tileName`. */
  nameOf: ReadonlyMap<string, string>;
  /** "Session 2". */
  sessionName: ReadonlyMap<string, string>;
  /** True when a chain of facts leads from `a` to `b`: `b` can never come before `a`. */
  mustPrecede(a: string, b: string): boolean;
  /** Different sessions, and no chain either way: they may be level, in either order. */
  canBeSimultaneous(a: string, b: string): boolean;
}

/** What a Result needs here: its id and the number of the step it came from. */
export type OrderResult = { id: string; from: string | null };

/**
 * The facts a map is checked against, for top-level tiles only (a child's links count as its top-level tile's). Results are
 * not steps, so `tileLinksOf` never sees them: pass them to add "a result comes no earlier than the tile it came from".
 */
export function orderFacts(steps: readonly Step[], groups: readonly SessionGroup[], files: readonly MapPieceLike[] = [], results: readonly OrderResult[] = []): OrderFacts {
  const topOf = new Map<string, string>();
  const note = (step: Step, top: string) => {
    topOf.set(step.id, top);
    step.children.forEach((child) => note(child, top));
    (step.sentWith ?? []).forEach((sent) => note(sent, top));
  };
  steps.forEach((step) => note(step, step.id));

  const sessionOf = new Map<string, string>();
  const sessionName = new Map<string, string>();
  const nameOf = new Map<string, string>();
  const buildOrder = new Map<string, number>();
  const bySession = new Map<string, string[]>();
  steps.forEach((step, at) => {
    nameOf.set(step.id, tileName(step));
    buildOrder.set(step.id, at);
    const group = groupOfStep(groups, step);
    const key = group ? groupKey(group) : (step.session ?? undefined);
    if (!key) return;
    sessionOf.set(step.id, key);
    if (group) sessionName.set(key, MAP_ORDER_COPY.sessionName(group.number));
    bySession.set(key, [...(bySession.get(key) ?? []), step.id]);
  });

  const facts: OrderFact[] = [];
  const seen = new Set<string>();
  const add = (fact: OrderFact) => {
    const id = `${fact.before}>${fact.after}`;
    if (fact.before === fact.after || seen.has(id)) return;
    seen.add(id);
    facts.push(fact);
  };

  // Links between top-level tiles. Within a session the session fact holds the pair; a link the same way lends it its words.
  const links = tileLinksOf(steps, files);
  const linkWords = new Map<string, { verb: TileVerb }>();
  const across: OrderFact[] = [];
  for (const link of links) {
    const before = topOf.get(link.from);
    const after = topOf.get(link.to);
    if (!before || !after || before === after) continue;
    const name = (id: string) => nameOf.get(id) as string;
    if (sessionOf.get(before) && sessionOf.get(before) === sessionOf.get(after)) {
      if (!linkWords.has(`${before}>${after}`)) linkWords.set(`${before}>${after}`, { verb: link.verb });
      continue;
    }
    across.push({ before, after, why: link.verb, sentence: MAP_ORDER_COPY.link(name(after), link.verb, name(before)) });
  }

  for (const [key, tiles] of bySession) {
    for (let at = 1; at < tiles.length; at += 1) {
      const before = tiles[at - 1];
      const after = tiles[at];
      const words = linkWords.get(`${before}>${after}`);
      const after_ = nameOf.get(after) as string;
      const before_ = nameOf.get(before) as string;
      add(
        words
          ? { before, after, why: words.verb, sentence: MAP_ORDER_COPY.link(after_, words.verb, before_) }
          : { before, after, why: "session", sentence: MAP_ORDER_COPY.session(after_, before_, sessionName.get(key) ?? key) },
      );
    }
  }
  across.forEach(add);

  results.forEach((result, at) => {
    buildOrder.set(result.id, steps.length + at);
    const from = steps.find((step) => step.number === result.from);
    if (from) add({ before: from.id, after: result.id, why: "makes", sentence: MAP_ORDER_COPY.result(nameOf.get(from.id) as string) });
  });

  // Reachability, worked out once: a few thousand facts at most for 50 tiles.
  const next = new Map<string, string[]>();
  facts.forEach((fact) => next.set(fact.before, [...(next.get(fact.before) ?? []), fact.after]));
  const reach = new Map<string, Set<string>>();
  const reachOf = (from: string): Set<string> => {
    const found = reach.get(from);
    if (found) return found;
    const out = new Set<string>();
    const stack = [...(next.get(from) ?? [])];
    while (stack.length) {
      const id = stack.pop() as string;
      if (out.has(id)) continue;
      out.add(id);
      stack.push(...(next.get(id) ?? []));
    }
    reach.set(from, out);
    return out;
  };
  const mustPrecede = (a: string, b: string) => a !== b && reachOf(a).has(b);
  const canBeSimultaneous = (a: string, b: string) => {
    if (a === b) return false;
    const sa = sessionOf.get(a);
    if (sa !== undefined && sa === sessionOf.get(b)) return false;
    return !mustPrecede(a, b) && !mustPrecede(b, a);
  };
  return { facts, sessionOf, buildOrder, nameOf, sessionName, mustPrecede, canBeSimultaneous };
}

/** Two boxes can be simultaneous when every pair of their tiles can. */
export function boxesCanBeSimultaneous(facts: OrderFacts, a: Pick<MapBox, "tiles">, b: Pick<MapBox, "tiles">): boolean {
  return a.tiles.every((one) => b.tiles.every((other) => facts.canBeSimultaneous(one, other)));
}

/* ── Part 2: bands from geometry ── */

export interface Bands {
  /** Each band's tiles in reading order, bands top to bottom. */
  bands: string[][];
  /** Every tile in reading order. */
  order: string[];
  /** A tile's band, from 0; -1 for a tile with no slot. */
  bandOf(tile: string): number;
  /** A tile's place in reading order; -1 for a tile with no slot. */
  indexOf(tile: string): number;
}

/** Two spans share a band when they overlap by more than half the shorter one (README Decision 8). */
export function shareBand(a: Pick<Rect, "y" | "height">, b: Pick<Rect, "y" | "height">): boolean {
  const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlap > Math.min(a.height, b.height) / 2 + EPSILON;
}

/**
 * Bands from rectangles, swept top to bottom: a rectangle joins the band above when it shares a band with every rectangle
 * in it, otherwise it starts the next. Sorted first, so the result never depends on the input's order.
 */
function bandsFrom(items: readonly { id: string; rect: Rect }[]): Bands {
  const sorted = [...items].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const groups: { id: string; rect: Rect }[][] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.every((member) => shareBand(member.rect, item.rect))) last.push(item);
    else groups.push([item]);
  }
  const bands = groups.map((group) =>
    [...group].sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((item) => item.id),
  );
  const order = bands.flat();
  const band = new Map<string, number>();
  bands.forEach((ids, at) => ids.forEach((id) => band.set(id, at)));
  const index = new Map(order.map((id, at) => [id, at]));
  return { bands, order, bandOf: (tile) => band.get(tile) ?? -1, indexOf: (tile) => index.get(tile) ?? -1 };
}

const bandCache = new WeakMap<MapGeometry, Bands>();

/** The tiles' bands, from each tile's own slot. */
export function bandsOf(geometry: MapGeometry): Bands {
  const cached = bandCache.get(geometry);
  if (cached) return cached;
  const made = bandsFrom(Object.entries(geometry.tiles).map(([id, rect]) => ({ id, rect })));
  bandCache.set(geometry, made);
  return made;
}

/** Every tile with a slot, in reading order: bands top to bottom, left to right within a band. */
export const readingOrder = (geometry: MapGeometry): string[] => bandsOf(geometry).order;

/** A tile's band, from 0; -1 when it has no slot. */
export const bandOf = (geometry: MapGeometry, tile: string): number => bandsOf(geometry).bandOf(tile);

/**
 * The bands the order check reads: every placed tile, a tile with no slot (in a collapsed box or frame) standing at the
 * rectangle of what is drawn in its place, so collapsing never hides a broken order.
 */
function placedBands(layout: MapLayout, geometry: MapGeometry): Bands {
  const items: { id: string; rect: Rect }[] = Object.entries(geometry.tiles).map(([id, rect]) => ({ id, rect }));
  const walk = (node: MapNode, drawn: Rect | undefined) => {
    const here = geometry.nodes[node.id] ?? drawn;
    if (node.kind === "box") {
      if (here) for (const tile of node.tiles) if (!geometry.tiles[tile]) items.push({ id: tile, rect: here });
      return;
    }
    (node.kind === "split" ? node.children : [node.child]).forEach((kid) => walk(kid, here));
  };
  walk(layout.root, undefined);
  return items.length === Object.keys(geometry.tiles).length ? bandsOf(geometry) : bandsFrom(items);
}

/**
 * The order the drawn leaves stack in on a phone: reading order. A box comes at the reading place of its first tile; a leaf
 * with no tile slots (a text box, a collapsed box or frame) comes before the first box that starts below it.
 */
export function phoneOrder(layout: MapLayout, geometry: MapGeometry): string[] {
  const { indexOf } = bandsOf(geometry);
  const firstOf = new Map<string, number>();
  for (const [tile, slot] of Object.entries(geometry.tiles)) {
    const at = indexOf(tile);
    if (at >= 0 && at < (firstOf.get(slot.box) ?? Number.POSITIVE_INFINITY)) firstOf.set(slot.box, at);
  }
  const tiled = geometry.leaves.filter((id) => firstOf.has(id)).sort((a, b) => (firstOf.get(a) as number) - (firstOf.get(b) as number));
  const rectOf = (id: string) => geometry.nodes[id];
  const loose = geometry.leaves.filter((id) => !firstOf.has(id)).sort((a, b) => rectOf(a).y - rectOf(b).y || rectOf(a).x - rectOf(b).x);
  const out = [...tiled];
  for (const id of loose) {
    const rect = rectOf(id);
    const at = out.findIndex((other) => !firstOf.has(other) ? false : rectOf(other).y > rect.y + EPSILON || (Math.abs(rectOf(other).y - rect.y) < EPSILON && rectOf(other).x > rect.x));
    out.splice(at < 0 ? out.length : at, 0, id);
  }
  return out;
}

/* ── Part 3: the check ── */

/** The facts the layout breaks, earliest in reading order first. */
export function orderProblems(layout: MapLayout, geometry: MapGeometry, facts: OrderFacts): OrderFact[] {
  const bands = placedBands(layout, geometry);
  const xOf = new Map<string, number>();
  for (const [tile, slot] of Object.entries(geometry.tiles)) xOf.set(tile, slot.x);
  const placed = new Set(bands.order);
  const rectX = (tile: string) => xOf.get(tile) ?? Number.NaN;
  const broken = facts.facts.filter((fact) => {
    if (!placed.has(fact.before) || !placed.has(fact.after)) return false;
    const after = bands.bandOf(fact.after);
    const before = bands.bandOf(fact.before);
    if (after !== before) return after < before;
    const session = facts.sessionOf.get(fact.after);
    return session !== undefined && session === facts.sessionOf.get(fact.before) && rectX(fact.after) < rectX(fact.before) - EPSILON;
  });
  const first = (fact: OrderFact) => Math.min(bands.indexOf(fact.after), bands.indexOf(fact.before));
  const last = (fact: OrderFact) => Math.max(bands.indexOf(fact.after), bands.indexOf(fact.before));
  return broken.sort((a, b) => first(a) - first(b) || last(a) - last(b));
}

/**
 * Why the layout reads a later tile before an earlier one, or null. Refused when `after` is in an earlier band than
 * `before`, or in the same band and to its left within one session. Tiles of different sessions in one band are fine
 * either way round: level means "at the same time, or either order", and a use between them still shows as its line.
 */
export function orderRefusal(layout: MapLayout, geometry: MapGeometry, facts: OrderFacts): string | null {
  return orderProblems(layout, geometry, facts)[0]?.sentence ?? null;
}

/* ── Part 4: allowed drops ── */

export interface Drop {
  target: string;
  kind: "insert" | "swap" | "into";
  side?: MapSide;
  allowed: boolean;
  reason?: string;
  result?: MapLayout;
}

const SIDES: readonly MapSide[] = ["left", "right", "top", "bottom"];

/** The options MS-01's tile operations take, from the facts. */
export function tileOptionsOf(facts: OrderFacts): TileOptions {
  return {
    fits: fitsOf,
    buildOrder: (tile) => facts.buildOrder.get(tile) ?? Number.MAX_SAFE_INTEGER,
    sessionOf: (tile) => facts.sessionOf.get(tile),
    tileName: (tile) => facts.nameOf.get(tile) ?? tile,
    sessionName: (key) => facts.sessionName.get(key) ?? key,
  };
}

/**
 * Every place the moving box or tile could be dropped, each with its result or the reason it is refused, so the editor can
 * show the unavailable places while the drag runs. A box: every box edge (`insertNode`) and every other box (`swapNodes`). A
 * tile: every box of its session (`moveTile`) and every box edge (the tile split into a box of its own, put there).
 */
export function allowedDrops(layout: MapLayout, measure: Measure, facts: OrderFacts, moving: { box: string } | { tile: string }): Drop[] {
  const options = tileOptionsOf(facts);
  const judge = (target: string, kind: Drop["kind"], side: MapSide | undefined, result: TreeResult): Drop => {
    const where = side ? { side } : {};
    if (!result.ok) return { target, kind, ...where, allowed: false, reason: result.reason };
    const reason = orderRefusal(result.layout, geometryOf(result.layout, measure), facts);
    return reason ? { target, kind, ...where, allowed: false, reason } : { target, kind, ...where, allowed: true, result: result.layout };
  };
  const all = boxes(layout);
  const out: Drop[] = [];
  if ("box" in moving) {
    for (const target of all) {
      if (target.id === moving.box) continue;
      for (const side of SIDES) out.push(judge(target.id, "insert", side, insertNode(layout, moving.box, target.id, side, options)));
      out.push(judge(target.id, "swap", undefined, swapNodes(layout, moving.box, target.id, options)));
    }
    return out;
  }
  const from = boxOfTile(layout, moving.tile);
  if (!from) return out;
  const session = facts.sessionOf.get(moving.tile);
  for (const target of all) {
    if (target.id === from.id) continue;
    if (!target.tiles.every((tile) => facts.sessionOf.get(tile) === session)) continue;
    out.push(judge(target.id, "into", undefined, moveTile(layout, moving.tile, target.id, options)));
  }
  if (from.tiles.length > 1) {
    let made = 0;
    const newId = () => `m-drop-${moving.tile}-${(made += 1)}`;
    const alone = splitBox(layout, from.id, "down", 0.5, [moving.tile], { ...options, newId });
    const own = alone.ok ? boxOfTile(alone.layout, moving.tile) : null;
    for (const target of all) {
      for (const side of SIDES) {
        const result: TreeResult = !alone.ok ? alone : own ? insertNode(alone.layout, own.id, target.id, side, { ...options, newId }) : { ok: false, reason: MAP_ORDER_COPY.tileNotPlaced };
        out.push(judge(target.id, "insert", side, result));
      }
    }
  }
  return out;
}

/**
 * Inside one box, the places `tileId` could move to (an index in `box.tiles`) and whether the build's order allows each:
 * MS-10's reorder.
 */
export function allowedTileSlots(box: Pick<MapBox, "tiles">, tileId: string, facts: OrderFacts): { index: number; allowed: boolean; reason?: string }[] {
  const from = box.tiles.indexOf(tileId);
  if (from < 0) return [];
  const rest = box.tiles.filter((tile) => tile !== tileId);
  return box.tiles.map((_, index) => {
    const order = [...rest.slice(0, index), tileId, ...rest.slice(index)];
    // Every pair now read the wrong way round; a fact that joins the pair directly gives the sentence.
    const wrong: OrderFact[] = [];
    for (let a = 0; a < order.length; a += 1) {
      for (let b = a + 1; b < order.length; b += 1) {
        if (!facts.mustPrecede(order[b], order[a])) continue;
        const fact = facts.facts.find((one) => one.before === order[b] && one.after === order[a]);
        wrong.push(fact ?? { before: order[b], after: order[a], why: "session", sentence: MAP_ORDER_COPY.inSequence });
      }
    }
    if (!wrong.length) return { index, allowed: true };
    return { index, allowed: false, reason: (wrong.find((fact) => fact.sentence !== MAP_ORDER_COPY.inSequence) ?? wrong[0]).sentence };
  });
}

/* ── Part 5: two-way rules ── */

const endId = (end: MapEnd) => ("tile" in end ? end.tile : end.box);

/**
 * Why a two-way arrow can't join `a` and `b`, or null. Only things that can be simultaneous: from different sessions, with no
 * chain of links between them either way. Both ends must be on the map, and both tiles or both boxes.
 */
export function twoWayRefusal(layout: MapLayout, geometry: MapGeometry, facts: OrderFacts, a: MapEnd, b: MapEnd): string | null {
  if (endId(a) === endId(b)) return MAP_ORDER_COPY.sameThing;
  for (const end of [a, b]) {
    if ("tile" in end && !boxOfTile(layout, end.tile)) return MAP_ORDER_COPY.tileNotPlaced;
    if ("box" in end && nodeById(layout, end.box)?.kind !== "box") return MAP_ORDER_COPY.boxNotPlaced;
  }
  if ("tile" in a !== "tile" in b) return MAP_ORDER_COPY.mixedEnds;
  if ("tile" in a && "tile" in b) return facts.canBeSimultaneous(a.tile, b.tile) ? null : MAP_ORDER_COPY.inSequence;
  const boxA = nodeById(layout, endId(a)) as MapBox;
  const boxB = nodeById(layout, endId(b)) as MapBox;
  if (!boxA.tiles.length || !boxB.tiles.length) return MAP_ORDER_COPY.emptyBox;
  return boxesCanBeSimultaneous(facts, boxA, boxB) ? null : MAP_ORDER_COPY.inSequence;
}

/** Two tiles are level when their slots share a band; two boxes when their rectangles do, by the same overlap rule. */
export function isLevel(geometry: MapGeometry, a: MapEnd, b: MapEnd): boolean {
  if ("tile" in a && "tile" in b) {
    const bands = bandsOf(geometry);
    const band = bands.bandOf(a.tile);
    return band >= 0 && band === bands.bandOf(b.tile);
  }
  if ("box" in a && "box" in b) {
    const ra = geometry.nodes[a.box];
    const rb = geometry.nodes[b.box];
    return Boolean(ra && rb) && shareBand(ra, rb);
  }
  return false;
}

/** The rectangle an end stands at: a tile's slot, or a box's rectangle. */
const rectOfEnd = (geometry: MapGeometry, end: MapEnd): Rect | undefined => ("tile" in end ? geometry.tiles[end.tile] : geometry.nodes[end.box]);
const boxIdOfEnd = (layout: MapLayout, end: MapEnd): string | undefined => ("tile" in end ? boxOfTile(layout, end.tile)?.id : end.box);

/**
 * The smallest change that makes `a` and `b` level, when they aren't: first, extra height above the higher one in its
 * `down` parent (on the child before it), so it comes down level with the lower one; then the higher one's box moved into
 * the other's row, beside it. The first result that is level and keeps the order, or a refusal.
 */
export function slideToLevel(layout: MapLayout, measure: Measure, facts: OrderFacts, a: MapEnd, b: MapEnd): { ok: true; layout: MapLayout } | { ok: false; reason: string } {
  const geometry = geometryOf(layout, measure);
  const why = twoWayRefusal(layout, geometry, facts, a, b);
  if (why) return { ok: false, reason: why };
  if (isLevel(geometry, a, b)) return { ok: true, layout };
  const passes = (next: MapLayout) => {
    const seen = geometryOf(next, measure);
    return isLevel(seen, a, b) && !orderRefusal(next, seen, facts);
  };
  const ra = rectOfEnd(geometry, a);
  const rb = rectOfEnd(geometry, b);
  if (!ra || !rb) return { ok: false, reason: MAP_ORDER_COPY.cantLevel };
  const [high, low] = ra.y <= rb.y ? [a, b] : [b, a];
  const highBox = boxIdOfEnd(layout, high) as string;
  const lowBox = boxIdOfEnd(layout, low) as string;

  // 1. Extra height above the higher one: the nearest `down` split above it where it isn't the first child.
  const path = pathTo(layout, highBox);
  for (let at = path.length - 2; at >= 0; at -= 1) {
    const node = path[at];
    if (node.kind !== "split" || node.dir !== "down") continue;
    const index = node.children.indexOf(path[at + 1]);
    if (index === 0) continue;
    let next = layout;
    // The rhythm and the stretching of rows can leave a few px over; three rounds close any gap.
    for (let round = 0; round < 3; round += 1) {
      const seen = geometryOf(next, measure);
      const hr = rectOfEnd(seen, high) as Rect;
      const lr = rectOfEnd(seen, low) as Rect;
      const gap = lr.y - hr.y;
      if (isLevel(seen, a, b) || gap <= 0) break;
      const split = nodeById(next, node.id) as MapSplit;
      const sizes = split.sizes.map((size, i) => (i === index - 1 ? size + gap : size));
      next = { ...next, root: replaceSizes(next.root, node.id, sizes) };
    }
    if (passes(next)) return { ok: true, layout: next };
    break;
  }

  // 2. The higher one's box moved into the lower one's row, beside it on the side it stands; then the other way round.
  const tries: [string, string, MapSide][] = [
    [highBox, lowBox, (rectOfEnd(geometry, high) as Rect).x <= (rectOfEnd(geometry, low) as Rect).x ? "left" : "right"],
    [lowBox, highBox, (rectOfEnd(geometry, low) as Rect).x <= (rectOfEnd(geometry, high) as Rect).x ? "left" : "right"],
  ];
  for (const [moving, target, side] of tries) {
    if (moving === target) continue;
    const moved = insertNode(layout, moving, target, side, { fits: fitsOf });
    if (moved.ok && passes(moved.layout)) return { ok: true, layout: moved.layout };
  }
  return { ok: false, reason: MAP_ORDER_COPY.cantLevel };
}

/** The tree with one split's sizes replaced. */
function replaceSizes(root: MapNode, id: string, sizes: number[]): MapNode {
  if (root.id === id && root.kind === "split") return { ...root, sizes };
  if (root.kind === "split") return { ...root, children: root.children.map((kid) => replaceSizes(kid, id, sizes)) };
  if (root.kind === "region") return { ...root, child: replaceSizes(root.child, id, sizes) };
  return root;
}

/** Every stored two-way arrow that is no longer allowed, or no longer level, with why. MS-11 and MS-14 use it. */
export function twoWayProblems(layout: MapLayout, geometry: MapGeometry, facts: OrderFacts): { index: number; a: MapEnd; b: MapEnd; reason: string }[] {
  const out: { index: number; a: MapEnd; b: MapEnd; reason: string }[] = [];
  layout.twoWay.forEach(({ a, b }, index) => {
    const reason = twoWayRefusal(layout, geometry, facts, a, b) ?? (isLevel(geometry, a, b) ? null : MAP_ORDER_COPY.notLevel);
    if (reason) out.push({ index, a, b, reason });
  });
  return out;
}
