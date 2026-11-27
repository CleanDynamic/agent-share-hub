// MS-02: the map sandbox's geometry. PURE.
//
// Turns a `MapLayout` and the tiles' measured sizes into pixel rectangles. Nothing is drawn here. Heights come from the tiles
// as drawn, so they are passed in (`Measure`) and this module stays pure: MS-05 supplies a `Measure` that reads the List's
// tile as rendered, tests supply fixed sizes.
//
// Only types come from `mapLayout.ts`, which imports `MAP_WIDTH` from here, so the two never import each other at run time.
// `mapOrder.ts` (MS-03) builds on this module, never the other way round.

import type { Fits, MapBox, MapLayout, MapNode, MapRegion, MapSide, MapTilePart } from "./mapLayout";

/** The canvas grid (README Decision 7). These measures live here and nowhere else. */
export const MAP_GRID = { columns: 12, rhythm: 8, gutter: 24, padding: 20, snap: 6, minBoxColumns: 2, minBoxPx: 160 } as const;
/** Canvas widths in px (README Decision 7). */
export const MAP_WIDTH = { narrow: 720, standard: 960, wide: 1200, min: 640, max: 1600 } as const;

/**
 * A frame's padding: a region's child sits this far inside its frame on every side. A stand-in until `canvasRecipes.ts`
 * (MS-05) holds the frame's measures; it moves there then.
 */
export const REGION_INSET = 16;
/** Space between tiles in a box, and between the tiles and the notes column. */
export const TILE_GAP = 16;
/** How far each indent level moves a tile in. */
export const INDENT_STEP = 24;
/** A note's leader meets its tile this far below the tile's top: level with the tile's number badge (12 padding, 24 badge). */
export const LEADER_DROP = 24;

/** Every sentence geometry can say. */
export const MAP_GEOMETRY_COPY = {
  canvasTooNarrow: (px: number) => `These boxes need a canvas at least ${px} px wide.`,
  boxTooNarrow: (px: number) => `A box can't be narrower than ${px} px at this width.`,
};

/* ── what geometry needs from outside ── */

export interface TileSize { height: number; minWidth: number }
/** `head`: the title and explanation's height. `noteWidth`: the notes column's width when notes are on. */
export interface BoxChrome { head: number; noteWidth: number }
/** The tiles' and boxes' sizes as drawn. MS-05 reads them from the List's tile as rendered (README Decision 14). */
export type Measure = {
  tile(tileId: string, width: number, parts: MapTilePart[]): TileSize;
  chrome(box: MapBox | MapRegion, width: number): BoxChrome;
};

/* ── what geometry gives ── */

export interface Rect { x: number; y: number; width: number; height: number }
/** A placed tile's slot: its rectangle, its box, and its indent level (for the bracket). */
export interface TileSlot extends Rect { box: string; level: 0 | 1 | 2 | 3 }
/** A note in its box's notes column, top-aligned with its tile. `leader`: where the leader line meets the tile (MS-10). */
export interface NoteSlot { tile: string; box: string; side: "left" | "right"; x: number; y: number; width: number; leader: { x: number; y: number } }
/** The space between two children of a split, where lines run (MS-04). `vertical` runs top to bottom between boxes side by side. */
export interface Gutter { dir: "vertical" | "horizontal"; splitId: string; index: number; x: number; y: number; width: number; height: number }
/**
 * A draggable edge (MS-07). `width`: the boundary between child `index` and `index + 1` of an `across` split, at the right
 * edge of child `index`. `height`: the bottom of child `index` of a `down` split, which sets its extra height.
 */
export type SharedEdge =
  | { axis: "width"; splitId: string; index: number; x: number; top: number; bottom: number }
  | { axis: "height"; splitId: string; index: number; y: number; left: number; right: number };

export interface MapGeometry {
  width: number;
  height: number;
  /** Every drawn node, canvas px. Nodes inside a collapsed frame aren't drawn and have none. */
  nodes: Record<string, Rect>;
  /** Every placed tile's slot. Tiles in a collapsed box or frame have none. */
  tiles: Record<string, TileSlot>;
  /** Every note's place in its notes column. */
  notes: Record<string, NoteSlot>;
  /** Every vertical and horizontal gutter segment, for MS-04. */
  gutters: Gutter[];
  /** Every draggable shared edge, for MS-07. */
  edges: SharedEdge[];
  /** x of the 12-column grid lines: each column's left and right edge, 0 and the width included. */
  columnLines: number[];
  /** The drawn leaves, in tree order: every box, and every collapsed frame (drawn as one line). */
  leaves: string[];
  /** Boxes set to Across whose tiles would be too narrow, to the width each would need. They are drawn stacked meanwhile. */
  narrow: Record<string, number>;
}

/* ── small helpers ── */

const { gutter: GUTTER, padding: PADDING, rhythm: RHYTHM } = MAP_GRID;
const EPSILON = 0.01;
const upToRhythm = (px: number) => Math.ceil(px / RHYTHM - EPSILON) * RHYTHM;
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const partsOf = (box: MapBox, tile: string): MapTilePart[] => box.show[tile] ?? ["text"];

/** One grid column's width at a canvas width. */
const columnWidth = (width: number) => (width - (MAP_GRID.columns - 1) * GUTTER) / MAP_GRID.columns;

/** The grid lines at a canvas width: each column's left and right edge. */
export function columnLinesOf(width: number): number[] {
  const column = columnWidth(width);
  const lines: number[] = [];
  for (let at = 0; at < MAP_GRID.columns; at += 1) {
    const left = at * (column + GUTTER);
    lines.push(left, left + column);
  }
  return lines;
}

/** The narrowest a box may be at a canvas width: `minBoxColumns` grid columns, and never under `minBoxPx`. */
export function minBoxWidth(width: number): number {
  return Math.max(MAP_GRID.minBoxPx, MAP_GRID.minBoxColumns * columnWidth(width) + (MAP_GRID.minBoxColumns - 1) * GUTTER);
}

/** The narrowest a node may be: its boxes at their minimum, with the gutters and frames between them. */
function minWidthOf(node: MapNode, boxMin: number): number {
  if (node.kind === "box" || node.collapsed) return boxMin;
  if (node.kind === "region") return minWidthOf(node.child, boxMin) + 2 * REGION_INSET;
  const kids = node.children.map((kid) => minWidthOf(kid, boxMin));
  return node.dir === "across" ? sum(kids) + (kids.length - 1) * GUTTER : Math.max(...kids);
}

/**
 * Widths for children wanting `raw`, each at least its `min`, sharing `room`: a child under its minimum is raised to it and
 * the others give up the space in proportion. `squeezed`: some child had to be raised.
 */
function giveRoom(raw: readonly number[], mins: readonly number[], room: number): { widths: number[]; squeezed: boolean } {
  const least = sum(mins);
  if (least > room + EPSILON) return { widths: mins.map((min) => (min * room) / least), squeezed: true };
  const fixed = new Set<number>();
  let widths = [...raw];
  for (;;) {
    const short = widths.findIndex((width, at) => !fixed.has(at) && width < mins[at] - EPSILON);
    if (short < 0) break;
    widths.forEach((width, at) => {
      if (!fixed.has(at) && width < mins[at] - EPSILON) fixed.add(at);
    });
    const left = room - sum([...fixed].map((at) => mins[at]));
    const freeWant = sum(raw.filter((_, at) => !fixed.has(at)));
    const freeCount = raw.length - fixed.size;
    widths = raw.map((want, at) => (fixed.has(at) ? mins[at] : freeWant > 0 ? (want * left) / freeWant : left / freeCount));
  }
  return { widths, squeezed: fixed.size > 0 };
}

/* ── widths ── */

interface Span { x: number; width: number }

/** Every node's left edge and width at a canvas width, and why the stored proportions don't fit, if they don't. */
function widthsOf(layout: Pick<MapLayout, "root">, width: number): { spans: Map<string, Span>; problem: string | null } {
  const spans = new Map<string, Span>();
  const boxMin = minBoxWidth(width);
  const ends = columnLinesOf(width).filter((_, at) => at % 2 === 1);
  const rootMin = minWidthOf(layout.root, boxMin);
  let problem: string | null = rootMin > width + EPSILON ? MAP_GEOMETRY_COPY.canvasTooNarrow(Math.ceil(rootMin)) : null;
  const place = (node: MapNode, x: number, w: number) => {
    spans.set(node.id, { x, width: w });
    if (node.kind === "box" || node.collapsed) return;
    if (node.kind === "region") return place(node.child, x + REGION_INSET, w - 2 * REGION_INSET);
    if (node.dir === "down") return node.children.forEach((kid) => place(kid, x, w));
    const count = node.children.length;
    const room = w - (count - 1) * GUTTER;
    const mins = node.children.map((kid) => minWidthOf(kid, boxMin));
    const given = giveRoom(node.sizes.map((size) => size * room), mins, room);
    if (given.squeezed) problem ??= MAP_GEOMETRY_COPY.boxTooNarrow(Math.ceil(boxMin));
    // Each boundary lands on a grid column's right edge when within `snap` of one, so columns line up across branches, and
    // on a whole pixel otherwise. A snap that would take a child under its minimum is skipped.
    const rights: number[] = [];
    let left = x;
    given.widths.forEach((childWidth, at) => {
      const right = left + childWidth;
      if (at === count - 1) {
        rights.push(x + w);
        return;
      }
      const end = ends.reduce((best, line) => (Math.abs(line - right) < Math.abs(best - right) ? line : best), Number.POSITIVE_INFINITY);
      const nextRight = right + GUTTER + given.widths[at + 1];
      const fitsAt = (edge: number) => edge - left >= Math.min(childWidth, mins[at]) - EPSILON && nextRight - edge - GUTTER >= Math.min(given.widths[at + 1], mins[at + 1]) - EPSILON;
      const snapped = Math.abs(end - right) <= MAP_GRID.snap && fitsAt(end) ? end : Math.round(right);
      rights.push(snapped);
      left = snapped + GUTTER;
    });
    let start = x;
    node.children.forEach((kid, at) => {
      place(kid, start, rights[at] - start);
      start = rights[at] + GUTTER;
    });
  };
  place(layout.root, 0, width);
  return { spans, problem };
}

/**
 * Why a layout can't be drawn at `width`, or null: the canvas is narrower than its boxes' minimums, or the stored proportions
 * would make a box narrower than the minimum (its neighbours then give up the space when drawing).
 */
export function fitsWidth(layout: Pick<MapLayout, "root">, width: number): string | null {
  return widthsOf(layout, width).problem;
}

/** `fitsWidth` at the layout's own width: the `fits` check MS-01's operations take. */
export const fitsOf: Fits = (layout) => fitsWidth(layout, layout.width);

/* ── inside a box ── */

export type SlotsResult =
  | {
      ok: true;
      /** The tiles' height, from the top of the first to the bottom of the lowest. 0 with no tiles. */
      height: number;
      /** Slots relative to the box's top-left corner. */
      slots: Record<string, TileSlot>;
      notes: Record<string, NoteSlot>;
    }
  | { ok: false; needs: number };

/**
 * A box's tiles laid out in a box `width` wide: Stack, Across or Grid, with the notes column beside them when `notesSide` is
 * set. Coordinates are relative to the box's top-left corner. Across is refused when a tile would be narrower than its
 * `minWidth`, with the box width it would need, so MS-10 can offer to widen.
 */
export function slotsOf(box: MapBox, width: number, measure: Measure, layout: MapBox["layout"] = box.layout): SlotsResult {
  const slots: Record<string, TileSlot> = {};
  const notes: Record<string, NoteSlot> = {};
  if (box.collapsed || box.tiles.length === 0) return { ok: true, height: 0, slots, notes };
  const chrome = measure.chrome(box, width);
  const inner = width - 2 * PADDING;
  const noteRoom = box.notesSide ? chrome.noteWidth + TILE_GAP : 0;
  const tilesWidth = inner - noteRoom;
  const left = PADDING + (box.notesSide === "left" ? noteRoom : 0);
  const top = PADDING + chrome.head;
  const put = (tile: string, x: number, y: number, w: number, h: number, level: TileSlot["level"]) => {
    slots[tile] = { x, y, width: w, height: h, box: box.id, level };
  };
  let height = 0;
  if (layout === "stack") {
    let y = top;
    for (const tile of box.tiles) {
      const level = box.indent[tile] ?? 0;
      const w = tilesWidth - level * INDENT_STEP;
      const size = measure.tile(tile, w, partsOf(box, tile));
      put(tile, left + level * INDENT_STEP, y, w, size.height, level);
      y += size.height + TILE_GAP;
    }
    height = y - TILE_GAP - top;
  } else if (layout === "across") {
    const count = box.tiles.length;
    const w = (tilesWidth - (count - 1) * TILE_GAP) / count;
    const sizes = box.tiles.map((tile) => measure.tile(tile, w, partsOf(box, tile)));
    const widest = Math.max(...sizes.map((size) => size.minWidth));
    if (w < widest - EPSILON) return { ok: false, needs: Math.ceil(count * widest + (count - 1) * TILE_GAP + noteRoom + 2 * PADDING) };
    box.tiles.forEach((tile, at) => put(tile, left + at * (w + TILE_GAP), top, w, sizes[at].height, 0));
    height = Math.max(...sizes.map((size) => size.height));
  } else {
    const columns = box.gridColumns ?? 2;
    const w = (tilesWidth - (columns - 1) * TILE_GAP) / columns;
    let y = top;
    for (let first = 0; first < box.tiles.length; first += columns) {
      const row = box.tiles.slice(first, first + columns);
      const sizes = row.map((tile) => measure.tile(tile, w, partsOf(box, tile)));
      row.forEach((tile, at) => put(tile, left + at * (w + TILE_GAP), y, w, sizes[at].height, 0));
      y += Math.max(...sizes.map((size) => size.height)) + TILE_GAP;
    }
    height = y - TILE_GAP - top;
  }
  if (box.notesSide) {
    const side = box.notesSide;
    const x = side === "left" ? PADDING : PADDING + tilesWidth + TILE_GAP;
    for (const tile of box.tiles) {
      if (!box.notes[tile]) continue;
      const slot = slots[tile];
      notes[tile] = { tile, box: box.id, side, x, y: slot.y, width: chrome.noteWidth, leader: { x: side === "left" ? slot.x : slot.x + slot.width, y: slot.y + LEADER_DROP } };
    }
  }
  return { ok: true, height, slots, notes };
}

/* ── the whole canvas ── */

/**
 * The layout in pixels. Widths come from the proportions (snapped to the grid, never under the minimum); heights grow from
 * the contents: a box is as tall as its tiles, a row as tall as its tallest box (every box in it stretched to match), a
 * column the sum of its rows. Every height is rounded up to the 8px rhythm.
 */
export function geometryOf(layout: MapLayout, measure: Measure): MapGeometry {
  const { spans } = widthsOf(layout, layout.width);
  const inside = new Map<string, Extract<SlotsResult, { ok: true }>>();
  const narrow: Record<string, number> = {};
  const heads = new Map<string, number>();
  const headOf = (node: MapBox | MapRegion) => {
    if (!heads.has(node.id)) heads.set(node.id, measure.chrome(node, (spans.get(node.id) as Span).width).head);
    return heads.get(node.id) as number;
  };
  const contentsOf = (box: MapBox) => {
    if (!inside.has(box.id)) {
      const width = (spans.get(box.id) as Span).width;
      let laid = slotsOf(box, width, measure);
      if (!laid.ok) {
        narrow[box.id] = laid.needs;
        laid = slotsOf(box, width, measure, "stack");
      }
      inside.set(box.id, laid as Extract<SlotsResult, { ok: true }>);
    }
    return inside.get(box.id) as Extract<SlotsResult, { ok: true }>;
  };

  /* Natural heights, bottom up. `extra`: the minimum height a `down` parent adds beyond the contents. */
  const natural = new Map<string, number>();
  const measureNode = (node: MapNode, extra: number): number => {
    let height: number;
    if (node.kind === "box") {
      height = node.collapsed ? headOf(node) : 2 * PADDING + headOf(node) + contentsOf(node).height + extra;
    } else if (node.kind === "region") {
      height = node.collapsed ? headOf(node) : measureNode(node.child, 0) + 2 * REGION_INSET + headOf(node) + extra;
    } else if (node.dir === "across") {
      height = Math.max(...node.children.map((kid) => measureNode(kid, 0))) + extra;
    } else {
      height = sum(node.children.map((kid, at) => measureNode(kid, node.sizes[at] ?? 0))) + (node.children.length - 1) * GUTTER + extra;
    }
    const rounded = upToRhythm(height);
    natural.set(node.id, rounded);
    return rounded;
  };
  const height = measureNode(layout.root, 0);

  /* Places, top down: a row's children are stretched to its height; a column's spare height goes to its last child. */
  const geometry: MapGeometry = { width: layout.width, height, nodes: {}, tiles: {}, notes: {}, gutters: [], edges: [], columnLines: columnLinesOf(layout.width), leaves: [], narrow };
  const place = (node: MapNode, y: number, h: number) => {
    const { x, width } = spans.get(node.id) as Span;
    geometry.nodes[node.id] = { x, y, width, height: h };
    if (node.kind === "box" || node.collapsed) geometry.leaves.push(node.id);
    if (node.kind === "box") {
      if (node.collapsed) return;
      const laid = contentsOf(node);
      for (const [tile, slot] of Object.entries(laid.slots)) geometry.tiles[tile] = { ...slot, x: slot.x + x, y: slot.y + y };
      for (const [tile, note] of Object.entries(laid.notes)) {
        geometry.notes[tile] = { ...note, x: note.x + x, y: note.y + y, leader: { x: note.leader.x + x, y: note.leader.y + y } };
      }
      return;
    }
    if (node.kind === "region") {
      if (node.collapsed) return;
      const top = REGION_INSET + headOf(node);
      return place(node.child, y + top, h - top - REGION_INSET);
    }
    const kids = node.children;
    if (node.dir === "across") {
      kids.forEach((kid, at) => {
        place(kid, y, h);
        if (at === kids.length - 1) return;
        const right = geometry.nodes[kid.id].x + geometry.nodes[kid.id].width;
        geometry.gutters.push({ dir: "vertical", splitId: node.id, index: at, x: right, y, width: GUTTER, height: h });
        geometry.edges.push({ axis: "width", splitId: node.id, index: at, x: right, top: y, bottom: y + h });
      });
      return;
    }
    const heights = kids.map((kid) => natural.get(kid.id) as number);
    heights[heights.length - 1] += h - (sum(heights) + (kids.length - 1) * GUTTER);
    let top = y;
    kids.forEach((kid, at) => {
      place(kid, top, heights[at]);
      top += heights[at];
      geometry.edges.push({ axis: "height", splitId: node.id, index: at, y: top, left: x, right: x + width });
      if (at < kids.length - 1) geometry.gutters.push({ dir: "horizontal", splitId: node.id, index: at, x, y: top, width, height: GUTTER });
      top += GUTTER;
    });
  };
  place(layout.root, 0, height);
  return geometry;
}

/* ── neighbours across branches ── */

export interface Neighbour { id: string; side: MapSide; overlap: number }

/**
 * The drawn leaves facing `id` across a gutter or a frame, in any branch: nothing else between them, and their edges overlap
 * along `overlap` px (a full or partial edge). MS-07 uses it for Match and Alt-drag.
 */
export function neighboursAt(geometry: MapGeometry, id: string): Neighbour[] {
  const me = geometry.nodes[id];
  if (!me) return [];
  const others = geometry.leaves.filter((other) => other !== id).map((other) => ({ id: other, rect: geometry.nodes[other] }));
  const overlapOf = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
  const blocked = (gap: Rect, skip: string) =>
    others.some(({ id: other, rect }) => other !== skip && overlapOf(rect.x, rect.x + rect.width, gap.x, gap.x + gap.width) > EPSILON && overlapOf(rect.y, rect.y + rect.height, gap.y, gap.y + gap.height) > EPSILON);
  const out: Neighbour[] = [];
  for (const { id: other, rect } of others) {
    const sideways = overlapOf(me.y, me.y + me.height, rect.y, rect.y + rect.height);
    const upright = overlapOf(me.x, me.x + me.width, rect.x, rect.x + rect.width);
    let side: MapSide | null = null;
    let gap: Rect | null = null;
    if (sideways > EPSILON && rect.x >= me.x + me.width - EPSILON) {
      side = "right";
      gap = { x: me.x + me.width, y: Math.max(me.y, rect.y), width: rect.x - me.x - me.width, height: sideways };
    } else if (sideways > EPSILON && rect.x + rect.width <= me.x + EPSILON) {
      side = "left";
      gap = { x: rect.x + rect.width, y: Math.max(me.y, rect.y), width: me.x - rect.x - rect.width, height: sideways };
    } else if (upright > EPSILON && rect.y >= me.y + me.height - EPSILON) {
      side = "bottom";
      gap = { x: Math.max(me.x, rect.x), y: me.y + me.height, width: upright, height: rect.y - me.y - me.height };
    } else if (upright > EPSILON && rect.y + rect.height <= me.y + EPSILON) {
      side = "top";
      gap = { x: Math.max(me.x, rect.x), y: rect.y + rect.height, width: upright, height: me.y - rect.y - rect.height };
    }
    if (side && gap && !blocked(gap, other)) out.push({ id: other, side, overlap: side === "left" || side === "right" ? sideways : upright });
  }
  return out;
}

/* ── snapping ── */

export interface SnapX { x: number; guide: { x: number; from: number; to: number } | null }
export interface SnapY { y: number; guide: { y: number; from: number; to: number } | null }

/** The leaves a snap looks at: every drawn leaf, less those named in `ignore` and those inside an ignored node. */
function snapLeaves(geometry: MapGeometry, ignore: readonly string[]): Rect[] {
  const skip = ignore.map((id) => geometry.nodes[id]).filter(Boolean);
  const within = (rect: Rect, outer: Rect) => rect.x >= outer.x - EPSILON && rect.y >= outer.y - EPSILON && rect.x + rect.width <= outer.x + outer.width + EPSILON && rect.y + rect.height <= outer.y + outer.height + EPSILON;
  return geometry.leaves.filter((id) => !ignore.includes(id)).map((id) => geometry.nodes[id]).filter((rect) => !skip.some((outer) => within(rect, outer)));
}

/** The nearest grid line or leaf edge within `snap` px of `x`, with the guide to draw; or `x` itself and no guide. */
export function snapX(geometry: MapGeometry, x: number, ignore: readonly string[] = []): SnapX {
  const leaves = snapLeaves(geometry, ignore);
  const candidates = [...geometry.columnLines, ...leaves.flatMap((rect) => [rect.x, rect.x + rect.width])];
  const best = candidates.reduce((near, line) => (Math.abs(line - x) < Math.abs(near - x) ? line : near), Number.POSITIVE_INFINITY);
  if (Math.abs(best - x) > MAP_GRID.snap) return { x, guide: null };
  const on = leaves.filter((rect) => Math.abs(rect.x - best) < EPSILON || Math.abs(rect.x + rect.width - best) < EPSILON);
  const guide = on.length
    ? { x: best, from: Math.min(...on.map((rect) => rect.y)), to: Math.max(...on.map((rect) => rect.y + rect.height)) }
    : { x: best, from: 0, to: geometry.height };
  return { x: best, guide };
}

/** The nearest leaf edge within `snap` px of `y`, with its guide; otherwise the nearest step of the 8px rhythm, with none. */
export function snapY(geometry: MapGeometry, y: number, ignore: readonly string[] = []): SnapY {
  const leaves = snapLeaves(geometry, ignore);
  const best = leaves.flatMap((rect) => [rect.y, rect.y + rect.height]).reduce((near, edge) => (Math.abs(edge - y) < Math.abs(near - y) ? edge : near), Number.POSITIVE_INFINITY);
  if (Math.abs(best - y) <= MAP_GRID.snap) {
    const on = leaves.filter((rect) => Math.abs(rect.y - best) < EPSILON || Math.abs(rect.y + rect.height - best) < EPSILON);
    return { y: best, guide: { y: best, from: Math.min(...on.map((rect) => rect.x)), to: Math.max(...on.map((rect) => rect.x + rect.width)) } };
  }
  return { y: Math.round(y / RHYTHM) * RHYTHM, guide: null };
}

/* ── width changes ── */

export type MapWidthPreset = "narrow" | "standard" | "wide";

/** The widths the canvas's right edge snaps to. */
export function widthPresets(): { key: MapWidthPreset; width: number }[] {
  return (["narrow", "standard", "wide"] as const).map((key) => ({ key, width: MAP_WIDTH[key] }));
}

/**
 * A free width snapped: to narrow, standard or wide within 24px, otherwise to the nearest grid step (12px, one per column, so
 * the columns stay whole pixels wide), clamped to min and max.
 */
export function snapWidth(px: number): number {
  if (!Number.isFinite(px)) return MAP_WIDTH.standard;
  const preset = widthPresets().find(({ width }) => Math.abs(width - px) <= GUTTER);
  const snapped = preset ? preset.width : Math.round(px / MAP_GRID.columns) * MAP_GRID.columns;
  return Math.min(MAP_WIDTH.max, Math.max(MAP_WIDTH.min, snapped));
}

// `phoneOrder` lives in `mapOrder.ts` (MS-03): it reads tile bands, and this module never imports that one.
