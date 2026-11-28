/* MS-07 — the shaping tools' sums: Split, Merge, Shared edge, Span, Even out and Match. PURE.

   Each one turns the editor's state into MS-01's operation and gives back its `TreeResult`, so the editor can preview it,
   check the order on it (`editor.check`) and apply it (`editor.apply`). Pixels come from the geometry the canvas drew;
   every size the tree stores is still a proportion or an extra height. `MapEditor` draws the buttons, lines and readouts. */

import { columnLinesOf, fitsOf, geometryOf, MAP_GRID, minBoxWidth, neighboursAt, snapX, snapY, type MapGeometry, type Measure, type SharedEdge } from "@/lib/build/mapGeometry";
import {
  evenOut,
  MAP_LAYOUT_COPY,
  matchSize,
  mergeBoxes,
  moveEdge,
  nodeById,
  parentOf,
  pathTo,
  spanBox,
  splitBox,
  unitOf,
  type MapLayout,
  type MapNode,
  type MapSplit,
  type TreeResult,
} from "@/lib/build/mapLayout";
import { tileOptionsOf, type OrderFacts } from "@/lib/build/mapOrder";

/** Every string the shaping tools say. */
export const MAP_SHAPING_COPY = {
  split: "Split",
  sideBySide: "Side by side",
  topAndBottom: "Top and bottom",
  needsRoom: (px: number) => `Needs ${px} px more room to split.`,
  splitting: "Drag the line to choose where to cut. Enter splits, Escape cancels.",
  splitDone: (name: string, dir: MapSplit["dir"]) => `${name} split ${dir === "across" ? "side by side" : "top and bottom"}.`,
  splitCancelled: "Split cancelled.",
  dropHere: (session: string) => `Drop tiles from ${session} here`,
  merge: "Merge",
  merged: (name: string) => `Boxes merged into ${name}.`,
  resizeKeys: "Ctrl and arrows resize.",
  resized: (name: string) => `${name} resized.`,
  widths: (a: number, b: number) => `${a} px · ${b} px`,
  height: (px: number) => `${px} px`,
  edgeMoved: (a: number, b: number) => `Edge moved: ${a} px and ${b} px.`,
  heightSet: (px: number) => `Height set to ${px} px.`,
  altFallback: "Alt moves one box's edge only where a single box faces it. Moving the shared edge.",
  cantMove: "That edge can't move further that way.",
  span: "Span",
  spanned: (name: string) => `${name} spans its row.`,
  evenOut: "Even out",
  evened: "Boxes evened out.",
  alreadyEven: "These boxes are already even.",
  nothingBeside: "Nothing sits beside this box to even out with.",
  matchWidth: "Match width",
  matchHeight: "Match height",
  matched: (axis: "width" | "height") => `Boxes matched in ${axis}.`,
  alreadyMatch: "These boxes already match.",
  inTheWay: (name: string, px: number) => `${name} is in the way: it can't be narrower than ${px} px.`,
};

const { gutter: GUTTER, rhythm: RHYTHM } = MAP_GRID;
const EPSILON = 0.5;
const no = (reason: string): TreeResult => ({ ok: false, reason });
const options = { fits: fitsOf };

/** The box a node holds through the frames that hold only it, or null when it holds more. */
function leafOf(node: MapNode): string | null {
  if (node.kind === "box") return node.id;
  if (node.kind === "region") return node.collapsed ? node.id : leafOf(node.child);
  return null;
}

/* ── Split ── */

/** How many px a box is short of splitting side by side (both halves at the minimum, and the gutter), or null. */
export function splitShort(geometry: MapGeometry, boxId: string): number | null {
  const rect = geometry.nodes[boxId];
  if (!rect) return null;
  const least = 2 * minBoxWidth(geometry.width) + GUTTER;
  return rect.width + EPSILON < least ? Math.ceil(least - rect.width) : null;
}

export interface SplitAt {
  result: TreeResult;
  /** Where the cut was asked for, clamped and snapped: x across, y down. */
  cut: number;
  guide: { x: number; from: number; to: number } | { y: number; from: number; to: number } | null;
}

/**
 * `splitBox` with the cut at `cut` px (x side by side, y top and bottom), snapped with `snapX` or `snapY`. Side by side,
 * the cut is the first half's right edge, kept where both halves stay at the minimum. Top and bottom, the first half keeps
 * the contents and takes the extra height down to the cut (`moveEdge`), never shorter than its contents.
 */
export function splitAt(layout: MapLayout, geometry: MapGeometry, measure: Measure, boxId: string, dir: MapSplit["dir"], cut: number): SplitAt {
  const rect = geometry.nodes[boxId];
  if (!rect) return { result: no(MAP_LAYOUT_COPY.noNode), cut, guide: null };
  if (dir === "across") {
    const min = minBoxWidth(geometry.width);
    const lo = rect.x + min;
    const hi = rect.x + rect.width - GUTTER - min;
    const clamped = Math.min(hi, Math.max(lo, cut));
    const snapped = snapX(geometry, clamped, [boxId]);
    const x = snapped.x >= lo - EPSILON && snapped.x <= hi + EPSILON ? snapped.x : clamped;
    // In a split that already runs across, the new half joins it and the room loses one more gutter, in this box's share.
    const parent = parentOf(layout, boxId);
    const share = parent?.parent.kind === "split" && parent.parent.dir === "across" ? parent.parent.sizes[parent.index] : 1;
    const at = Math.min(0.99, Math.max(0.01, (x - rect.x) / (rect.width - share * GUTTER)));
    return { result: splitBox(layout, boxId, "across", at, [], options), cut: x, guide: x === snapped.x ? snapped.guide : null };
  }
  const clamped = Math.min(rect.y + rect.height, Math.max(rect.y, cut));
  const snapped = snapY(geometry, clamped, [boxId]);
  const split = splitBox(layout, boxId, "down", 0.5, [], options);
  if (!split.ok) return { result: split, cut: snapped.y, guide: snapped.guide };
  const place = unitOf(split.layout.root, boxId);
  if (!place?.parent || place.parent.dir !== "down") return { result: split, cut: snapped.y, guide: snapped.guide };
  const drawn = geometryOf(split.layout, measure).nodes[place.unit.id];
  const moved = moveEdge(split.layout, place.parent.id, place.index, snapped.y - rect.y - drawn.height, options);
  return { result: moved.ok ? { ...moved, changed: [...new Set([...split.changed, ...moved.changed])] } : split, cut: snapped.y, guide: snapped.guide };
}

/** The cut's step for the arrow keys: the next grid column's edge side by side, the 8px rhythm top and bottom. */
export function stepCut(geometry: MapGeometry, dir: MapSplit["dir"], cut: number, forward: boolean): number {
  if (dir === "down") return cut + (forward ? RHYTHM : -RHYTHM);
  return nextLine(geometry.width, cut, forward) ?? cut;
}

/** The next grid column's right edge past `x`, or null at the end. */
function nextLine(width: number, x: number, forward: boolean): number | null {
  const ends = columnLinesOf(width).filter((_, at) => at % 2 === 1);
  const found = forward ? ends.find((end) => end > x + EPSILON) : [...ends].reverse().find((end) => end < x - EPSILON);
  return found ?? null;
}

/* ── Merge ── */

/** `mergeBoxes` for two boxes; two sessions are refused first, with MS-01's sentence, since they never share a split. */
export function mergeOf(layout: MapLayout, facts: OrderFacts, a: string, b: string): TreeResult {
  const tiles = (id: string) => {
    const node = nodeById(layout, id);
    return node?.kind === "box" ? node.tiles : [];
  };
  const sessions = new Set([...tiles(a), ...tiles(b)].map((tile) => facts.sessionOf.get(tile)).filter(Boolean));
  if (sessions.size > 1) return no(MAP_LAYOUT_COPY.differentSessions);
  return mergeBoxes(layout, a, b, { ...tileOptionsOf(facts), fits: fitsOf });
}

/* ── Shared edge ── */

const sameEdge = (a: SharedEdge, b: SharedEdge) => a.axis === b.axis && a.splitId === b.splitId && a.index === b.index;

/**
 * The shared edge a gutter belongs to: the edge and every width edge in line with it with no box across the line between
 * them (frames don't stop it). Columns come from edges lining up, so dragging one moves the column's whole edge. A height
 * edge is its own.
 */
export function edgeChain(geometry: MapGeometry, edge: SharedEdge): SharedEdge[] {
  if (edge.axis === "height") return [edge];
  const line = edge.x + GUTTER / 2;
  const inLine = geometry.edges
    .filter((other): other is Extract<SharedEdge, { axis: "width" }> => other.axis === "width" && Math.abs(other.x - edge.x) < EPSILON)
    .sort((a, b) => a.top - b.top);
  /** A box crossing the line somewhere between `from` and `to`. */
  const crossed = (from: number, to: number) =>
    geometry.leaves.some((id) => {
      const rect = geometry.nodes[id];
      return rect.x < line - EPSILON && rect.x + rect.width > line + EPSILON && rect.y < to - EPSILON && rect.y + rect.height > from + EPSILON;
    });
  const at = inLine.findIndex((other) => sameEdge(other, edge));
  let first = at;
  while (first > 0 && !crossed(inLine[first - 1].bottom, inLine[first].top)) first -= 1;
  let last = at;
  while (last < inLine.length - 1 && !crossed(inLine[last].bottom, inLine[last + 1].top)) last += 1;
  return inLine.slice(first, last + 1);
}

/** The children an edge lies between (a height edge: the child above it). */
function sidesOf(layout: MapLayout, edge: SharedEdge): MapNode[] {
  const split = nodeById(layout, edge.splitId);
  if (split?.kind !== "split") return [];
  return edge.axis === "width" ? [split.children[edge.index], split.children[edge.index + 1]].filter(Boolean) : [split.children[edge.index]].filter(Boolean);
}

/**
 * Alt drags only this split's edge when a single box sits on each side of it, facing each other along its whole length
 * (`neighboursAt`): then nothing else touches it and no gap can open. Otherwise the drag is the shared edge's.
 */
export function altAllowed(layout: MapLayout, geometry: MapGeometry, edge: SharedEdge): boolean {
  if (edge.axis !== "width") return false;
  const [left, right] = sidesOf(layout, edge).map(leafOf);
  if (!left || !right) return false;
  const mine = geometry.nodes[left];
  const theirs = geometry.nodes[right];
  if (!mine || !theirs) return false;
  const facing = neighboursAt(geometry, left).filter((each) => each.side === "right");
  return facing.length === 1 && facing[0].id === right && Math.abs(facing[0].overlap - mine.height) < 1 && Math.abs(theirs.height - mine.height) < 1;
}

/** The ids a snap for these edges looks past: the boxes on either side of each, which move with them. */
export const snapIgnore = (layout: MapLayout, edges: readonly SharedEdge[]): string[] => edges.flatMap((edge) => sidesOf(layout, edge).map((node) => node.id));

/** Where an edge dragged to `to` px lands: snapped with `snapX` (width) or `snapY` (height), with its guide. */
export function snapEdge(layout: MapLayout, geometry: MapGeometry, edges: readonly SharedEdge[], to: number): { at: number; guide: SplitAt["guide"] } {
  const ignore = snapIgnore(layout, edges);
  if (edges[0].axis === "width") {
    const snapped = snapX(geometry, to, ignore);
    return { at: snapped.x, guide: snapped.guide };
  }
  const snapped = snapY(geometry, to, ignore);
  return { at: snapped.y, guide: snapped.guide };
}

/** The px an edge stands at. */
export const edgeAt = (edge: SharedEdge): number => (edge.axis === "width" ? edge.x : edge.y);

/**
 * The edges moved by `by` px with `moveEdge`: a width edge by its share of its split's room, a height edge by px of extra
 * height. Edges in line move together; when the whole move doesn't fit, they go as far as they all can.
 */
export function moveEdges(layout: MapLayout, geometry: MapGeometry, edges: readonly SharedEdge[], by: number): TreeResult {
  if (edges.length === 1 && edges[0].axis === "height") return moveEdge(layout, edges[0].splitId, edges[0].index, by, options);
  const shares = edges.map((edge) => {
    const split = nodeById(layout, edge.splitId) as MapSplit | null;
    const rect = geometry.nodes[edge.splitId];
    return split && rect ? 1 / (rect.width - (split.children.length - 1) * GUTTER) : 0;
  });
  const moved = (px: number): TreeResult => {
    let next = layout;
    const changed = new Set<string>();
    for (const [at, edge] of edges.entries()) {
      const result = moveEdge(next, edge.splitId, edge.index, px * shares[at]);
      if (!result.ok) return result;
      next = result.layout;
      result.changed.forEach((id) => changed.add(id));
    }
    return { ok: true, layout: next, changed: [...changed] };
  };
  const full = moved(by);
  if (!full.ok || !fitsOf(full.layout)) return full;
  // The furthest they can all go towards `by` and still fit.
  let lo = 0;
  let hi = 1;
  for (let round = 0; round < 24; round += 1) {
    const mid = (lo + hi) / 2;
    const tried = moved(by * mid);
    if (tried.ok && !fitsOf(tried.layout)) lo = mid;
    else hi = mid;
  }
  return lo === 0 ? no(fitsOf(full.layout) as string) : moved(by * lo);
}

export type ResizeKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/**
 * Ctrl or Cmd and an arrow on a box: Right moves its right edge right to the next grid column, Left its left edge left,
 * Down its bottom edge down 8px, Up its top edge up 8px, where it has that edge. Null where it hasn't.
 */
export function keyEdge(layout: MapLayout, geometry: MapGeometry, boxId: string, key: ResizeKey): { edge: SharedEdge; by: number } | null {
  const path = pathTo(layout, boxId);
  const across = key === "ArrowLeft" || key === "ArrowRight";
  const forward = key === "ArrowRight" || key === "ArrowDown";
  for (let at = path.length - 2; at >= 0; at -= 1) {
    const split = path[at];
    if (split.kind !== "split" || (split.dir === "across") !== across) continue;
    const index = split.children.indexOf(path[at + 1]);
    const edgeIndex = forward ? index : index - 1;
    if (edgeIndex < 0 || (across && edgeIndex >= split.children.length - 1)) continue;
    const edge = geometry.edges.find((each) => each.splitId === split.id && each.index === edgeIndex && each.axis === (across ? "width" : "height"));
    if (!edge) return null;
    if (!across) return { edge, by: forward ? RHYTHM : -RHYTHM };
    const to = nextLine(geometry.width, edgeAt(edge), forward);
    return to === null ? null : { edge, by: to - edgeAt(edge) };
  }
  return null;
}

/** Whether two layouts differ in anything a tool changes (the tree). */
export const sameTree = (a: MapLayout, b: MapLayout): boolean => JSON.stringify(a.root) === JSON.stringify(b.root);

/* ── Span, Even out, Match ── */

export const spanOf = (layout: MapLayout, boxId: string): TreeResult => spanBox(layout, boxId, options);

/**
 * Even out: two or more boxes of one split (their frames that hold only them count as them), or one box, which evens its
 * whole row: the nearest split across above it. Null when the boxes aren't in one split (Even out isn't offered).
 */
export function evenOutOf(layout: MapLayout, ids: readonly string[]): TreeResult | null {
  if (ids.length === 1) {
    const path = pathTo(layout, ids[0]);
    const row = [...path].reverse().find((node): node is MapSplit => node.kind === "split" && node.dir === "across");
    if (!row) return no(MAP_SHAPING_COPY.nothingBeside);
    return settled(evenOut(layout, row.id, undefined, options), MAP_SHAPING_COPY.alreadyEven);
  }
  const places = ids.map((id) => unitOf(layout.root, id));
  const parent = places[0]?.parent;
  if (!parent || places.some((place) => place?.parent !== parent)) return null;
  return settled(evenOut(layout, parent.id, places.map((place) => (place as NonNullable<typeof place>).index), options), MAP_SHAPING_COPY.alreadyEven);
}

/**
 * Match width or height to the first box chosen (`matchSize`). When the result would take a box under the minimum, the
 * refusal names it: the narrowest box that changed and wasn't chosen.
 */
export function matchOf(layout: MapLayout, measure: Measure, ids: readonly string[], axis: "width" | "height", nameOf: (id: string) => string): TreeResult {
  const result = matchSize(layout, ids, axis, { nameOf });
  if (!result.ok) return result;
  const why = fitsOf(result.layout);
  if (why) {
    const geometry = geometryOf(result.layout, measure);
    const others = result.changed.filter((id) => !ids.includes(id)).flatMap((id) => leavesUnder(result.layout, id));
    const narrowest = others.filter((id) => geometry.nodes[id]).sort((a, b) => geometry.nodes[a].width - geometry.nodes[b].width)[0];
    return no(narrowest ? MAP_SHAPING_COPY.inTheWay(nameOf(narrowest), Math.ceil(minBoxWidth(layout.width))) : why);
  }
  return settled(result, MAP_SHAPING_COPY.alreadyMatch);
}

/** The boxes under a node, itself included. */
function leavesUnder(layout: MapLayout, id: string): string[] {
  const walk = (node: MapNode): string[] => (node.kind === "box" ? [node.id] : node.kind === "region" ? walk(node.child) : node.children.flatMap(walk));
  const node = nodeById(layout, id);
  return node ? walk(node) : [];
}

/** A result that changes nothing is refused with `already`, so the button says so instead of saving an empty step. */
function settled(result: TreeResult, already: string): TreeResult {
  return result.ok && result.changed.length === 0 ? no(already) : result;
}
