// MS-04: the map's lines. PURE.
//
// Lines come only from the build's links (`tileLinksOf`), lifted to top-level tiles and merged per pair (`mapLinks`). They
// are drawn at right angles, only through gutters, and never across a box (`routeLines`): a line leaves its tile's slot,
// runs through its own box's padding to the box edge, travels the gutters, and enters the other tile the same way. Lines
// sharing a gutter run side by side. Two-way arrows are not routed here: they are always one level segment (MS-11 draws
// them from `isLevel` in `mapOrder.ts`).

import type { Step } from "./graph";
import { MAP_GRID, REGION_INSET, type MapGeometry, type Rect, type TileSlot } from "./mapGeometry";
import { boxes, type MapBox, type MapLayout, type MapNode, type MapSide } from "./mapLayout";
import { tileLinksOf, tileName, type MapPieceLike, type TileVerb } from "./sessionMap";

/** Every sentence the lines can say. */
export const MAP_LINES_COPY = {
  /** A Result and the tile it came from: "Support inbox comes from Agent 7". */
  result: (title: string, from: string) => `${title} comes from ${from}`,
  /** A line's accessible name: every link it carries. */
  name: (sentences: readonly string[]) => `${sentences.join(". ")}.`,
};

/* ── Part 1: which lines exist ── */

export type LineVerb = TileVerb | "makes";

/** One line of the map, from the tile that is used (`from`) to the tile that uses it (`to`). Top-level tiles only. */
export interface MapLine {
  /** The first link's `${from}>${to}:${verb}`, as `layout.hiddenLinks` and `layout.linkGutters` key it. */
  id: string;
  from: string;
  to: string;
  /** The ids of every link merged into this line, the first one first. */
  linkIds: string[];
  /** Every link's sentence: "Prompt 3 uses Prompt 4". */
  sentences: string[];
  /** The accessible name: the sentences as one text. */
  label: string;
  /** Every link in it is `tests`: a check and what it tests. */
  dashed: boolean;
  /** In `layout.hiddenLinks`. */
  hidden: boolean;
  /** The two tiles' slots touch in one box: a short drop line inside the box, not routed through gutters. */
  inner: boolean;
}

/** What a Result needs here: its id, its title, and the number of the step it came from (`ListResult`). */
export type LineResult = { id: string; title: string; from: string | null };

const linkId = (from: string, to: string, verb: LineVerb) => `${from}>${to}:${verb}`;

/** Two tiles of one box whose slots touch: next to each other in Stack or Across, neighbours in a Grid's row or column. */
function touching(box: MapBox, a: string, b: string): boolean {
  const i = box.tiles.indexOf(a);
  const j = box.tiles.indexOf(b);
  if (i < 0 || j < 0) return false;
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);
  if (box.layout !== "grid") return hi - lo === 1;
  const columns = box.gridColumns ?? 2;
  return (hi - lo === 1 && Math.floor(lo / columns) === Math.floor(hi / columns)) || hi - lo === columns;
}

/**
 * The lines a map can draw: the build's links with both ends lifted to their top-level tile, less links inside one tile and
 * links with an end that isn't placed, merged per pair of tiles. Results aren't steps, so pass them to add the line from the
 * tile a Result came from (as `orderFacts` does).
 */
export function mapLinks(steps: readonly Step[], files: readonly MapPieceLike[], layout: Pick<MapLayout, "root" | "hiddenLinks">, results: readonly LineResult[] = []): MapLine[] {
  const topOf = new Map<string, string>();
  const note = (step: Step, top: string) => {
    topOf.set(step.id, top);
    step.children.forEach((child) => note(child, top));
    (step.sentWith ?? []).forEach((sent) => note(sent, top));
  };
  steps.forEach((step) => note(step, step.id));
  const boxOf = new Map<string, MapBox>();
  boxes(layout).forEach((box) => box.tiles.forEach((tile) => boxOf.set(tile, box)));

  const raw: { from: string; to: string; verb: LineVerb; sentence: string }[] = [];
  for (const link of tileLinksOf(steps, files)) {
    const from = topOf.get(link.from);
    const to = topOf.get(link.to);
    if (from && to) raw.push({ from, to, verb: link.verb, sentence: link.sentence });
  }
  for (const result of results) {
    const step = steps.find((candidate) => candidate.number === result.from);
    if (step) raw.push({ from: step.id, to: result.id, verb: "makes", sentence: MAP_LINES_COPY.result(result.title, tileName(step)) });
  }

  const hidden = new Set(layout.hiddenLinks);
  const byPair = new Map<string, MapLine & { verbs: LineVerb[] }>();
  for (const link of raw) {
    if (link.from === link.to || !boxOf.has(link.from) || !boxOf.has(link.to)) continue;
    const pair = `${link.from}>${link.to}`;
    const id = linkId(link.from, link.to, link.verb);
    const found = byPair.get(pair);
    if (found) {
      found.linkIds.push(id);
      found.sentences.push(link.sentence);
      found.verbs.push(link.verb);
      continue;
    }
    const box = boxOf.get(link.from) as MapBox;
    byPair.set(pair, { id, from: link.from, to: link.to, linkIds: [id], sentences: [link.sentence], verbs: [link.verb], label: "", dashed: false, hidden: false, inner: box === boxOf.get(link.to) && touching(box, link.from, link.to) });
  }
  return [...byPair.values()].map(({ verbs, ...line }) => ({
    ...line,
    label: MAP_LINES_COPY.name(line.sentences),
    dashed: verbs.every((verb) => verb === "tests"),
    hidden: line.linkIds.some((id) => hidden.has(id)),
  }));
}

/** How many lines are hidden, for the toolbar's counter (MS-11). */
export const hiddenCount = (lines: readonly Pick<MapLine, "hidden">[]): number => lines.filter((line) => line.hidden).length;

/* ── Part 2: routing ── */

export interface Point { x: number; y: number }

/** A visible line drawn: a polyline of horizontal and vertical segments from `from`'s slot edge to `to`'s, arrowhead at the end. */
export interface MapRoute {
  id: string;
  from: string;
  to: string;
  points: Point[];
  /** The side of `from`'s slot the line leaves from. */
  fromSide: MapSide;
  /** The side of `to`'s slot the line enters, where its arrowhead points in. Dashed lines keep it too. */
  toSide: MapSide;
  dashed: boolean;
  inner: boolean;
}

/** The cost of a bend, in px of length (the prompt's 40). */
export const BEND_PENALTY = 40;
/** The space between lines running side by side in one gutter. */
export const LANE_SPACING = 6;

const EPSILON = 0.01;
const { padding: PADDING } = MAP_GRID;
const OPPOSITE: Record<MapSide, MapSide> = { left: "right", right: "left", top: "bottom", bottom: "top" };
/** Directions of travel: 0 right, 1 left, 2 down, 3 up. */
type Dir = 0 | 1 | 2 | 3;
const REVERSE: Record<Dir, Dir> = { 0: 1, 1: 0, 2: 3, 3: 2 };
/** Leaving a slot from this side, the line travels this way. */
const LEAVING: Record<MapSide, Dir> = { right: 0, left: 1, bottom: 2, top: 3 };

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
const centreX = (rect: Rect) => rect.x + rect.width / 2;
const centreY = (rect: Rect) => rect.y + rect.height / 2;

/** An axis-aligned segment runs through the inside of `rect` (touching its edge doesn't count). */
function crosses(rect: Rect, a: Point, b: Point): boolean {
  return (
    Math.max(a.x, b.x) > rect.x + EPSILON &&
    Math.min(a.x, b.x) < rect.x + rect.width - EPSILON &&
    Math.max(a.y, b.y) > rect.y + EPSILON &&
    Math.min(a.y, b.y) < rect.y + rect.height - EPSILON
  );
}

/** The point on a slot's side, at its middle. */
function edgePoint(slot: Rect, side: MapSide): Point {
  if (side === "left") return { x: slot.x, y: centreY(slot) };
  if (side === "right") return { x: slot.x + slot.width, y: centreY(slot) };
  if (side === "top") return { x: centreX(slot), y: slot.y };
  return { x: centreX(slot), y: slot.y + slot.height };
}

/** Where a point on a slot's side meets the box edge, straight out through the padding. */
function boxEdgePoint(box: Rect, at: Point, side: MapSide): Point {
  if (side === "left") return { x: box.x, y: at.y };
  if (side === "right") return { x: box.x + box.width, y: at.y };
  if (side === "top") return { x: at.x, y: box.y };
  return { x: at.x, y: box.y + box.height };
}

/**
 * Where a line meets its tile. `edge`: on the slot's side. `via`: a corner in the padding lane, for a port that runs along
 * the padding to another edge of the box. `gate`: where it reaches a gutter centre line. `out`: the way it travels there.
 */
interface Port { side: MapSide; edge: Point; via: Point[]; gate: Point; out: Dir }

interface Canvas {
  obstacles: Rect[];
  /** Vertical gutters' centre x, sorted. */
  xs: number[];
  /** Horizontal gutters' centre y, sorted. */
  ys: number[];
  slotsIn: Map<string, TileSlot[]>;
}

/**
 * A port: the slot's side, straight through the padding to the box edge, then on to the nearest gutter centre line that way
 * (`gate`). With `exit`, the line turns in the padding lane of `side` and runs along it to the `exit` edge of the box first:
 * the way out for a tile whose sides all face another tile or no gutter (a middle tile of a full-width Stack). Null when a
 * stub would cross another tile of the box or meets a box before any gutter.
 */
function portOf(canvas: Canvas, slot: TileSlot, box: Rect, side: MapSide, exit?: MapSide): Port | null {
  const edge = edgePoint(slot, side);
  const via: Point[] = [];
  let leaving = side;
  if (exit) {
    const lane = side === "right" ? box.x + box.width - PADDING / 2 : side === "left" ? box.x + PADDING / 2 : side === "bottom" ? box.y + box.height - PADDING / 2 : box.y + PADDING / 2;
    via.push(side === "left" || side === "right" ? { x: lane, y: edge.y } : { x: edge.x, y: lane });
    leaving = exit;
  }
  const turn = via[0] ?? edge;
  const out = boxEdgePoint(box, turn, leaving);
  const stubs: [Point, Point][] = via.length ? [[edge, turn], [turn, out]] : [[edge, out]];
  const others = (canvas.slotsIn.get(slot.box) ?? []).filter((other) => other !== slot);
  if (stubs.some(([a, b]) => others.some((other) => crosses(other, a, b)))) return null;
  const horizontal = leaving === "left" || leaving === "right";
  const lines = horizontal ? canvas.xs : canvas.ys;
  const from = horizontal ? out.x : out.y;
  const ahead = leaving === "right" || leaving === "bottom" ? lines.filter((at) => at > from + EPSILON) : lines.filter((at) => at < from - EPSILON).reverse();
  if (!ahead.length) return null;
  const gate = horizontal ? { x: ahead[0], y: out.y } : { x: out.x, y: ahead[0] };
  if (canvas.obstacles.some((rect) => crosses(rect, out, gate))) return null;
  return { side, edge, via, gate, out: LEAVING[leaving] };
}

/** Every port of one end, best first: straight out of each side in `sidesToward`'s order, then along a padding lane. */
function portsOf(canvas: Canvas, slot: TileSlot, box: Rect, sides: readonly MapSide[]): Port[] {
  const straight = sides.map((side) => portOf(canvas, slot, box, side));
  // A lane along the top would run past the box's title, so only the sides and the bottom have one.
  const lanes = sides
    .filter((side) => side !== "top")
    .flatMap((side) => sides.filter((exit) => exit !== side && exit !== OPPOSITE[side]).map((exit) => portOf(canvas, slot, box, side, exit)));
  return [...straight, ...lanes].filter((port): port is Port => Boolean(port));
}

/** The sides to try for one end, best first: facing the other end, then the two across (nearer first), then the back. */
function sidesToward(mine: Rect, other: Rect, myBox: Rect, otherBox: Rect): MapSide[] {
  const level = overlap(myBox.y, myBox.y + myBox.height, otherBox.y, otherBox.y + otherBox.height) > EPSILON;
  const facing: MapSide = level ? (centreX(otherBox) >= centreX(myBox) ? "right" : "left") : centreY(otherBox) >= centreY(myBox) ? "bottom" : "top";
  const across: MapSide[] = level ? (centreY(other) >= centreY(mine) ? ["bottom", "top"] : ["top", "bottom"]) : centreX(other) >= centreX(mine) ? ["right", "left"] : ["left", "right"];
  return [facing, ...across, OPPOSITE[facing]];
}

/** A small binary heap of [cost, state]. */
class Heap {
  private items: [number, number][] = [];
  get size() {
    return this.items.length;
  }
  push(item: [number, number]) {
    const items = this.items;
    items.push(item);
    let at = items.length - 1;
    while (at > 0) {
      const up = (at - 1) >> 1;
      if (items[up][0] <= item[0]) break;
      items[at] = items[up];
      at = up;
    }
    items[at] = item;
  }
  pop(): [number, number] {
    const items = this.items;
    const top = items[0];
    const last = items.pop() as [number, number];
    if (items.length) {
      let at = 0;
      for (;;) {
        const left = 2 * at + 1;
        if (left >= items.length) break;
        const right = left + 1;
        const child = right < items.length && items[right][0] < items[left][0] ? right : left;
        if (items[child][0] >= last[0]) break;
        items[at] = items[child];
        at = child;
      }
      items[at] = last;
    }
    return top;
  }
}

const uniqueSorted = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.filter((value, at) => at === 0 || value - sorted[at - 1] > EPSILON);
};

/**
 * The shortest way from one gate to the other along gutter centre lines, by length plus `BEND_PENALTY` per bend, counting
 * the turns out of and into the ports. With `forced`, the path must run along that gutter's centre for some stretch.
 * Null when there is none.
 */
function search(canvas: Canvas, start: Port, end: Port, forced: MapGeometry["gutters"][number] | null): { points: Point[]; cost: number } | null {
  const xsExtra = [start.gate.x, end.gate.x];
  const ysExtra = [start.gate.y, end.gate.y];
  if (forced?.dir === "vertical") ysExtra.push(centreY(forced));
  if (forced?.dir === "horizontal") xsExtra.push(centreX(forced));
  const xs = uniqueSorted([...canvas.xs, ...xsExtra]);
  const ys = uniqueSorted([...canvas.ys, ...ysExtra]);
  const ny = ys.length;
  const count = xs.length * ny;
  const pointOf = (node: number): Point => ({ x: xs[Math.floor(node / ny)], y: ys[node % ny] });
  const open = new Array<boolean>(count);
  for (let node = 0; node < count; node += 1) {
    const { x, y } = pointOf(node);
    open[node] = !canvas.obstacles.some((rect) => x > rect.x + EPSILON && x < rect.x + rect.width - EPSILON && y > rect.y + EPSILON && y < rect.y + rect.height - EPSILON);
  }
  // Neighbours by direction: right (+x), left, down (+y), up. -1 for none or a stretch that crosses a box.
  const next: number[][] = [new Array(count).fill(-1), new Array(count).fill(-1), new Array(count).fill(-1), new Array(count).fill(-1)];
  const link = (a: number, b: number, forward: Dir) => {
    if (!open[a] || !open[b]) return;
    const pa = pointOf(a);
    const pb = pointOf(b);
    if (canvas.obstacles.some((rect) => crosses(rect, pa, pb))) return;
    next[forward][a] = b;
    next[REVERSE[forward]][b] = a;
  };
  for (let i = 0; i < xs.length; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      const node = i * ny + j;
      if (i + 1 < xs.length) link(node, node + ny, 0);
      if (j + 1 < ny) link(node, node + 1, 2);
    }
  }
  const nodeAt = (p: Point) => {
    const i = xs.findIndex((x) => Math.abs(x - p.x) < EPSILON);
    const j = ys.findIndex((y) => Math.abs(y - p.y) < EPSILON);
    return i < 0 || j < 0 ? -1 : i * ny + j;
  };
  const from = nodeAt(start.gate);
  const to = nodeAt(end.gate);
  if (from < 0 || to < 0 || !open[from] || !open[to]) return null;
  const along = (a: number, b: number) => {
    if (!forced) return false;
    const pa = pointOf(a);
    const pb = pointOf(b);
    if (forced.dir === "vertical") return Math.abs(pa.x - centreX(forced)) < EPSILON && Math.abs(pb.x - pa.x) < EPSILON && overlap(Math.min(pa.y, pb.y), Math.max(pa.y, pb.y), forced.y, forced.y + forced.height) > EPSILON;
    return Math.abs(pa.y - centreY(forced)) < EPSILON && Math.abs(pb.y - pa.y) < EPSILON && overlap(Math.min(pa.x, pb.x), Math.max(pa.x, pb.x), forced.x, forced.x + forced.width) > EPSILON;
  };

  // States: node, the direction it was reached in, and whether the forced gutter has been run along yet.
  const stateOf = (node: number, dir: Dir, done: number) => (node * 4 + dir) * 2 + done;
  const total = count * 8;
  const best = new Array<number>(total).fill(Number.POSITIVE_INFINITY);
  const prev = new Array<number>(total).fill(-1);
  const heap = new Heap();
  const first = stateOf(from, start.out, forced ? 0 : 1);
  best[first] = 0;
  heap.push([0, first]);
  const arrive = REVERSE[end.out];
  let goal = -1;
  let goalCost = Number.POSITIVE_INFINITY;
  while (heap.size) {
    const [cost, state] = heap.pop();
    if (cost > best[state] || cost >= goalCost) continue;
    const done = state % 2;
    const dir = (Math.floor(state / 2) % 4) as Dir;
    const node = Math.floor(state / 8);
    if (node === to && done) {
      const finish = cost + (dir === arrive ? 0 : BEND_PENALTY);
      if (finish < goalCost) {
        goalCost = finish;
        goal = state;
      }
    }
    for (const turn of [0, 1, 2, 3] as Dir[]) {
      if (turn === REVERSE[dir]) continue;
      const neighbour = next[turn][node];
      if (neighbour < 0) continue;
      const pa = pointOf(node);
      const pb = pointOf(neighbour);
      const step = Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y) + (turn === dir ? 0 : BEND_PENALTY);
      const after = stateOf(neighbour, turn, done || (along(node, neighbour) ? 1 : 0));
      if (cost + step < best[after]) {
        best[after] = cost + step;
        prev[after] = state;
        heap.push([cost + step, after]);
      }
    }
  }
  if (goal < 0) return null;
  const nodes: number[] = [];
  for (let state = goal; state >= 0; state = prev[state]) nodes.unshift(Math.floor(state / 8));
  return { points: [start.edge, ...start.via, ...nodes.map(pointOf), ...[...end.via].reverse(), end.edge], cost: goalCost };
}

/** Drops repeated points and points in the middle of a straight run. */
function simplify(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - point.x) < EPSILON && Math.abs(last.y - point.y) < EPSILON) continue;
    const before = out[out.length - 2];
    if (before && last && ((Math.abs(before.x - last.x) < EPSILON && Math.abs(last.x - point.x) < EPSILON) || (Math.abs(before.y - last.y) < EPSILON && Math.abs(last.y - point.y) < EPSILON))) out.pop();
    out.push(point);
  }
  return out;
}

/** A short drop line between two touching slots: straight across the gap, at the middle of where they face each other. */
function dropLine(a: TileSlot, b: TileSlot): Pick<MapRoute, "points" | "fromSide" | "toSide"> | null {
  const sideways = overlap(a.y, a.y + a.height, b.y, b.y + b.height);
  const upright = overlap(a.x, a.x + a.width, b.x, b.x + b.width);
  if (upright > EPSILON) {
    const x = Math.max(a.x, b.x) + upright / 2;
    const down = b.y >= a.y;
    return { points: [{ x, y: down ? a.y + a.height : a.y }, { x, y: down ? b.y : b.y + b.height }], fromSide: down ? "bottom" : "top", toSide: down ? "top" : "bottom" };
  }
  if (sideways > EPSILON) {
    const y = Math.max(a.y, b.y) + sideways / 2;
    const right = b.x >= a.x;
    return { points: [{ x: right ? a.x + a.width : a.x, y }, { x: right ? b.x : b.x + b.width, y }], fromSide: right ? "right" : "left", toSide: right ? "left" : "right" };
  }
  return null;
}

/**
 * Two tiles of one box that don't touch: the line runs in the box's padding, out of one tile's side and into the other's.
 * Stack goes down the side away from the notes, Across along the bottom; the first side whose stubs cross no other tile.
 */
function paddingLine(canvas: Canvas, box: MapBox, rect: Rect, a: TileSlot, b: TileSlot): Pick<MapRoute, "points" | "fromSide" | "toSide"> | null {
  const sides: MapSide[] = box.layout === "across" ? ["bottom", "right", "left"] : box.notesSide === "right" ? ["left", "right", "bottom"] : ["right", "left", "bottom"];
  const others = (canvas.slotsIn.get(box.id) ?? []).filter((slot) => slot !== a && slot !== b);
  for (const side of sides) {
    const ea = edgePoint(a, side);
    const eb = edgePoint(b, side);
    const lane = side === "right" ? rect.x + rect.width - PADDING / 2 : side === "left" ? rect.x + PADDING / 2 : rect.y + rect.height - PADDING / 2;
    const la = side === "bottom" ? { x: ea.x, y: lane } : { x: lane, y: ea.y };
    const lb = side === "bottom" ? { x: eb.x, y: lane } : { x: lane, y: eb.y };
    const points = [ea, la, lb, eb];
    if (points.slice(1).some((point, at) => others.some((slot) => crosses(slot, points[at], point)))) continue;
    return { points, fromSide: side, toSide: side };
  }
  return null;
}

/* ── bundling ── */

interface Run {
  route: number;
  index: number;
  vertical: boolean;
  /** The run's x (vertical) or y (horizontal). */
  at: number;
  lo: number;
  hi: number;
  /** Which way the line turns at the low and high ends, across the run: -1, 1, or 0 where the line ends at a slot. */
  turnLo: number;
  turnHi: number;
}

/** How many crossings the two orders would make, from how each run turns off at its ends. */
function crossingsIfBefore(a: Run, b: Run): number {
  let count = 0;
  if (Math.abs(a.hi - b.hi) > EPSILON) {
    const shortIsA = a.hi < b.hi;
    const turn = shortIsA ? a.turnHi : b.turnHi;
    if (turn !== 0 && turn === (shortIsA ? 1 : -1)) count += 1;
  }
  if (Math.abs(a.lo - b.lo) > EPSILON) {
    const innerIsA = a.lo > b.lo;
    const turn = innerIsA ? a.turnLo : b.turnLo;
    if (turn !== 0 && turn === (innerIsA ? 1 : -1)) count += 1;
  }
  return count;
}

/**
 * Lines sharing a stretch of one gutter centre (or one padding lane) run side by side, `LANE_SPACING` apart and centred on
 * it. Their order follows where each turns off next, so they don't cross where they part.
 */
function bundle(routes: Point[][]): Point[][] {
  const runs: Run[] = [];
  routes.forEach((points, route) => {
    for (let index = 0; index + 1 < points.length; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      const vertical = Math.abs(a.x - b.x) < EPSILON;
      const along = (p: Point) => (vertical ? p.y : p.x);
      const across = (p: Point) => (vertical ? p.x : p.y);
      const turnAt = (end: Point, neighbour: Point | undefined) => (neighbour ? Math.sign(across(neighbour) - across(end)) : 0);
      const turnA = turnAt(a, points[index - 1]);
      const turnB = turnAt(b, points[index + 2]);
      const aLow = along(a) <= along(b);
      runs.push({ route, index, vertical, at: across(a), lo: Math.min(along(a), along(b)), hi: Math.max(along(a), along(b)), turnLo: aLow ? turnA : turnB, turnHi: aLow ? turnB : turnA });
    }
  });
  const offsets = routes.map((points) => new Array<number>(Math.max(0, points.length - 1)).fill(0));
  const tracks = new Map<string, Run[]>();
  runs.forEach((run) => {
    const key = `${run.vertical ? "v" : "h"}${Math.round(run.at * 100)}`;
    tracks.set(key, [...(tracks.get(key) ?? []), run]);
  });
  for (const track of tracks.values()) {
    track.sort((a, b) => a.lo - b.lo);
    const groups: Run[][] = [];
    let reach = Number.NEGATIVE_INFINITY;
    for (const run of track) {
      if (groups.length && run.lo < reach - EPSILON) {
        groups[groups.length - 1].push(run);
        reach = Math.max(reach, run.hi);
      } else {
        groups.push([run]);
        reach = run.hi;
      }
    }
    for (const group of groups) {
      if (group.length < 2) continue;
      // Insertion order by the comparison, stable on ties (the lines' own order).
      const placed: Run[] = [];
      for (const run of [...group].sort((a, b) => a.route - b.route || a.index - b.index)) {
        let at = placed.length;
        while (at > 0 && crossingsIfBefore(run, placed[at - 1]) < crossingsIfBefore(placed[at - 1], run)) at -= 1;
        placed.splice(at, 0, run);
      }
      placed.forEach((run, lane) => {
        offsets[run.route][run.index] = (lane - (placed.length - 1) / 2) * LANE_SPACING;
      });
    }
  }
  return routes.map((points, route) => {
    if (points.length < 2) return points;
    const shift = offsets[route];
    const vertical = (index: number) => Math.abs(points[index].x - points[index + 1].x) < EPSILON;
    return points.map((point, index) => {
      if (index === 0) return vertical(0) ? { x: point.x + shift[0], y: point.y } : { x: point.x, y: point.y + shift[0] };
      const last = points.length - 1;
      if (index === last) return vertical(last - 1) ? { x: point.x + shift[last - 1], y: point.y } : { x: point.x, y: point.y + shift[last - 1] };
      const before = index - 1;
      return vertical(before) ? { x: point.x + shift[before], y: point.y + shift[index] } : { x: point.x + shift[index], y: point.y + shift[before] };
    });
  });
}

/**
 * Every visible line drawn: right angles only, through gutters only, never across a box but the two end boxes' padding.
 * Inner lines are one straight drop. A line whose tile has no slot (in a collapsed box or frame), or that no gutter can
 * carry, is left out. `layout.linkGutters` forces a line's middle stretch through the named gutter (an index into
 * `geometry.gutters`) when that gutter exists and a path along it does.
 */
export function routeLines(geometry: MapGeometry, lines: readonly MapLine[], layout: Pick<MapLayout, "root" | "linkGutters">): MapRoute[] {
  const slotsIn = new Map<string, TileSlot[]>();
  Object.values(geometry.tiles).forEach((slot) => slotsIn.set(slot.box, [...(slotsIn.get(slot.box) ?? []), slot]));
  // A frame's inset is the only space between a full-width box and the frame round it, so its sides and bottom carry lines
  // like a gutter, at their middle. Its top holds the name tab and title, so it carries none.
  const frames: Rect[] = [];
  const walk = (node: MapNode) => {
    if (node.kind === "box" || node.collapsed) return;
    if (node.kind === "region") {
      const rect = geometry.nodes[node.id];
      if (rect) frames.push(rect);
      return walk(node.child);
    }
    node.children.forEach(walk);
  };
  walk(layout.root);
  const canvas: Canvas = {
    obstacles: geometry.leaves.map((id) => geometry.nodes[id]).filter(Boolean),
    xs: uniqueSorted([...geometry.gutters.filter((gutter) => gutter.dir === "vertical").map(centreX), ...frames.flatMap((rect) => [rect.x + REGION_INSET / 2, rect.x + rect.width - REGION_INSET / 2])]),
    ys: uniqueSorted([...geometry.gutters.filter((gutter) => gutter.dir === "horizontal").map(centreY), ...frames.map((rect) => rect.y + rect.height - REGION_INSET / 2)]),
    slotsIn,
  };
  const boxById = new Map(boxes(layout).map((box) => [box.id, box]));
  const drawn: { line: MapLine; route: Pick<MapRoute, "points" | "fromSide" | "toSide"> }[] = [];

  for (const line of lines) {
    if (line.hidden) continue;
    const a = geometry.tiles[line.from];
    const b = geometry.tiles[line.to];
    if (!a || !b) continue;
    const boxA = geometry.nodes[a.box];
    const boxB = geometry.nodes[b.box];
    if (!boxA || !boxB) continue;
    if (a.box === b.box) {
      const box = boxById.get(a.box);
      const route = (line.inner ? dropLine(a, b) : null) ?? (box ? paddingLine(canvas, box, boxA, a, b) : null);
      if (route) drawn.push({ line, route });
      continue;
    }
    const fromSides = portsOf(canvas, a, boxA, sidesToward(a, b, boxA, boxB));
    const toSides = portsOf(canvas, b, boxB, sidesToward(b, a, boxB, boxA));
    const pairs = fromSides.flatMap((start, i) => toSides.map((end, j) => ({ start, end, rank: i + j, i }))).sort((p, q) => p.rank - q.rank || p.i - q.i);
    const chosen = layout.linkGutters[line.id];
    const forced = chosen !== undefined ? (geometry.gutters[chosen] ?? null) : null;
    let found: { points: Point[]; start: Port; end: Port } | null = null;
    for (const pass of forced ? [forced, null] : [null]) {
      for (const { start, end } of pairs) {
        const path = search(canvas, start, end, pass);
        if (path) {
          found = { points: path.points, start, end };
          break;
        }
      }
      if (found) break;
    }
    if (found) drawn.push({ line, route: { points: simplify(found.points), fromSide: found.start.side, toSide: found.end.side } });
  }

  const bundled = bundle(drawn.map(({ line, route }) => (line.inner ? [] : route.points)));
  return drawn.map(({ line, route }, at) => ({
    id: line.id,
    from: line.from,
    to: line.to,
    points: line.inner ? route.points : bundled[at],
    fromSide: route.fromSide,
    toSide: route.toSide,
    dashed: line.dashed,
    inner: line.inner,
  }));
}
