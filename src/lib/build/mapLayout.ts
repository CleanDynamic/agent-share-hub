// MS-00: the map sandbox's stored shape, `builds.making.map_layout`. PURE.
//
// A split tree that stores tile ids and session or part keys, never pixel positions: the canvas works out every pixel.
// The types are the MS series README's Decision 3, exactly. `mapLayoutOf` reads the column defensively, the way
// `storedWorkstreamsOf` does; `mapLayoutRefusal` says why a layout can't be saved, so the editor can say no first.
//
// A key the reader doesn't know is ignored when reading and never removed: the reader copies it through onto the object it
// read, so a layout read, changed and written again keeps it.

import { MAP_WIDTH } from "./mapGeometry";

/** builds.making.map_layout. Proportions and ids only: the canvas works out every pixel. */
export interface MapLayout {
  v: 1;
  /** Canvas width in px. Free, snapped to the 12-column grid, between MAP_WIDTH.min and MAP_WIDTH.max. */
  width: number;
  /** A background preset key ("grey", "dusk", "slate", "paper") or "#RRGGBB". */
  background: string;
  dotGrid: boolean;
  numbers: "build" | "session" | "part";
  root: MapNode;
  /** Sessions or parts drawn with an outline: their keys. */
  outlines: string[];
  twoWay: { a: MapEnd; b: MapEnd }[];
  /** Pairs of session keys whose suggested two-way arrow the maker dismissed, as "keyA|keyB" sorted. */
  twoWayDismissed: string[];
  /** Links the maker hid, by link id (`${from}>${to}:${verb}`, as `tileLinksOf` keys them). */
  hiddenLinks: string[];
  /** A link's middle segment moved to another gutter: link id to gutter index. */
  linkGutters: Record<string, number>;
}
export type MapEnd = { tile: string } | { box: string };
export type MapNode = MapSplit | MapRegion | MapBox;
export interface MapSplit {
  kind: "split"; id: string;
  /** "across": children side by side (sizes are widths). "down": children one above the other (sizes are extra height). */
  dir: "across" | "down";
  /** across: proportions that add up to 1. down: each child's minimum height in px beyond its contents, 0 for none. */
  sizes: number[];
  children: MapNode[];
}
export interface MapRegion {
  kind: "region"; id: string;
  of: { part: string } | { session: string };
  child: MapNode;
  title?: string; explanation?: string; style?: MapStyle; collapsed?: boolean;
}
export interface MapBox {
  kind: "box"; id: string;
  /** Top-level tile ids in build order. Empty only for a text box (title or explanation, no tiles). */
  tiles: string[];
  layout: "stack" | "across" | "grid"; gridColumns?: 2 | 3;
  notesSide?: "left" | "right";
  /** Tile id to indent level 1, 2 or 3. Absent: level 0. */
  indent: Record<string, 1 | 2 | 3>;
  /** Tile id to the parts shown. Absent: the default, which is the text part only. */
  show: Record<string, MapTilePart[]>;
  /** Tile id to the maker's note beside it. */
  notes: Record<string, string>;
  title?: string; explanation?: string; style?: MapStyle; collapsed?: boolean;
}
export type MapTilePart = "text" | "settings" | "files" | "code" | "picture";
export interface MapStyle { fill?: MapFill; border?: "line" | "dashed" | "none"; corners?: 4 | 8 | 12 | 16 }
export type MapFill = "none" | "grey" | "green" | "amber" | "blue" | "violet";

/** The background presets, by key. Their colours live in `canvasRecipes.ts` (MS-05). */
export const MAP_BACKGROUNDS = ["grey", "dusk", "slate", "paper"] as const;
export const MAP_FILLS: readonly MapFill[] = ["none", "grey", "green", "amber", "blue", "violet"];
export const MAP_TILE_PARTS: readonly MapTilePart[] = ["text", "settings", "files", "code", "picture"];

/** Limits a layout is refused past. The title limit matches `SESSION_TITLE_MAX` in `making.ts` (a test keeps them equal). */
export const MAP_LIMITS = {
  nodes: 2000,
  depth: 24,
  title: 80,
  explanation: 280,
  note: 200,
  /** The stored JSON, in bytes. */
  bytes: 256 * 1024,
  /** `across` sizes add up to 1 within this. */
  sum: 0.001,
} as const;

/** Every sentence the stored shape can say. */
export const MAP_LAYOUT_COPY = {
  tooManyNodes: `A map holds ${MAP_LIMITS.nodes.toLocaleString("en-GB")} boxes and frames at most.`,
  tooDeep: `Boxes and frames nest ${MAP_LIMITS.depth} deep at most.`,
  fewChildren: "A split holds at least two boxes.",
  sizes: "Boxes side by side have to fill the full width.",
  sameId: "Two parts of the map have the same id.",
  tileTwice: "A tile sits in one box only.",
  regionInRegion: "A frame can't sit inside a frame of the same kind.",
  sessionOutsidePart: "A session's frame sits inside its part's frame.",
  title: `A title is ${MAP_LIMITS.title} characters at most.`,
  explanation: `An explanation is ${MAP_LIMITS.explanation} characters at most.`,
  note: `A note is ${MAP_LIMITS.note} characters at most.`,
  tooLarge: "This map is too large to save.",
  // MS-01: the split tree's refusals.
  noNode: "That box is no longer on the map.",
  notABox: "Only a box can do that.",
  lastBox: "The last box on the canvas can't be removed.",
  splitAt: "Split somewhere inside the box.",
  sameBox: "Choose two different boxes.",
  notNeighbours: "These boxes don't share a full edge.",
  differentSessions: "These boxes hold different sessions.",
  noEdge: "There is no edge there.",
  alreadySpans: "This box already spans its row.",
  chooseTwo: "Choose two or more boxes.",
  cantMatch: (name: string, axis: "width" | "height") => `${name} can't change its ${axis} here.`,
  noRoom: (name: string) => `${name} would need more room than its row has.`,
  insideItself: "A box can't go inside itself.",
  otherSession: (tile: string, its: string, box: string) => `${tile} is in ${its}. This box holds ${box}.`,
  lastTile: "Remove the box instead.",
  notPlaced: "That tile isn't on the map.",
  alreadyPlaced: "That tile is already on the map.",
  notRectangle: "These boxes don't form a rectangle yet.",
  notARegion: "That frame is no longer on the map.",
};

/** A new node's id: `m-` and a uuid, made the way `newWorkstreamKey` makes a part's. */
export function newMapNodeId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  return `m-${uuid}`;
}

/* ── reading ── */

type Raw = Record<string, unknown>;

const asObject = (value: unknown): Raw | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null);
const isString = (value: unknown): value is string => typeof value === "string";
const HEX = /^#[0-9a-f]{6}$/i;

/** The keys of `raw` this reader doesn't know, copied through so nothing is removed. */
function unknownKeys(raw: Raw, known: readonly string[]): Raw {
  const out: Raw = {};
  for (const [key, value] of Object.entries(raw)) if (!known.includes(key)) out[key] = value;
  return out;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? [...new Set(value.filter(isString))] : []);

function styleOf(value: unknown): MapStyle | undefined {
  const raw = asObject(value);
  if (!raw) return undefined;
  const style: MapStyle = unknownKeys(raw, ["fill", "border", "corners"]) as MapStyle;
  if (MAP_FILLS.includes(raw.fill as MapFill)) style.fill = raw.fill as MapFill;
  if (raw.border === "line" || raw.border === "dashed" || raw.border === "none") style.border = raw.border;
  if (raw.corners === 4 || raw.corners === 8 || raw.corners === 12 || raw.corners === 16) style.corners = raw.corners;
  return style;
}

/** title, explanation, style and collapsed, shared by boxes and regions. */
function dressOf(raw: Raw): Pick<MapBox, "title" | "explanation" | "style" | "collapsed"> {
  const out: Pick<MapBox, "title" | "explanation" | "style" | "collapsed"> = {};
  if (isString(raw.title)) out.title = raw.title;
  if (isString(raw.explanation)) out.explanation = raw.explanation;
  const style = styleOf(raw.style);
  if (style) out.style = style;
  if (raw.collapsed === true) out.collapsed = true;
  return out;
}

const DRESS = ["title", "explanation", "style", "collapsed"] as const;
const BOX_KEYS = ["kind", "id", "tiles", "layout", "gridColumns", "notesSide", "indent", "show", "notes", ...DRESS] as const;
const REGION_KEYS = ["kind", "id", "of", "child", ...DRESS] as const;
const SPLIT_KEYS = ["kind", "id", "dir", "sizes", "children"] as const;
const LAYOUT_KEYS = ["v", "width", "background", "dotGrid", "numbers", "root", "outlines", "twoWay", "twoWayDismissed", "hiddenLinks", "linkGutters"] as const;

/** Past this the reader stops, so a hostile value can't overflow the stack. The refusal's limit is far lower. */
const READ_DEPTH = 256;

function boxOf(raw: Raw): MapBox | null {
  if (!isString(raw.id) || !Array.isArray(raw.tiles) || !raw.tiles.every(isString)) return null;
  const tiles = [...new Set(raw.tiles as string[])];
  const box = {
    ...unknownKeys(raw, BOX_KEYS),
    kind: "box",
    id: raw.id,
    tiles,
    layout: raw.layout === "across" || raw.layout === "grid" ? raw.layout : "stack",
    indent: {},
    show: {},
    notes: {},
  } as MapBox;
  if (raw.gridColumns === 2 || raw.gridColumns === 3) box.gridColumns = raw.gridColumns;
  if (raw.notesSide === "left" || raw.notesSide === "right") box.notesSide = raw.notesSide;
  for (const [tile, level] of Object.entries(asObject(raw.indent) ?? {})) if (level === 1 || level === 2 || level === 3) box.indent[tile] = level;
  for (const [tile, parts] of Object.entries(asObject(raw.show) ?? {})) {
    if (Array.isArray(parts)) box.show[tile] = [...new Set(parts.filter((part): part is MapTilePart => MAP_TILE_PARTS.includes(part as MapTilePart)))];
  }
  for (const [tile, note] of Object.entries(asObject(raw.notes) ?? {})) if (isString(note)) box.notes[tile] = note;
  return Object.assign(box, dressOf(raw));
}

function regionOf(raw: Raw, depth: number): MapNode | null {
  if (!isString(raw.id)) return null;
  const child = nodeOf(raw.child, depth + 1);
  if (!child) return null;
  const of = asObject(raw.of);
  const key = of && isString(of.part) ? { part: of.part } : of && isString(of.session) ? { session: of.session } : null;
  // A frame that names nothing it can frame stands aside: its child keeps exactly the same place.
  if (!key) return child;
  return { ...unknownKeys(raw, REGION_KEYS), kind: "region", id: raw.id, of: key, child, ...dressOf(raw) } as MapRegion;
}

const sizeOf = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0);

/** `across` sizes scaled to add up to 1; all zero shares the width equally. */
function scaled(sizes: readonly number[]): number[] {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total <= 0) return sizes.map(() => 1 / sizes.length);
  return Math.abs(total - 1) <= Number.EPSILON * sizes.length ? [...sizes] : sizes.map((size) => size / total);
}

function splitOf(raw: Raw, depth: number): MapNode | null {
  if (!isString(raw.id) || (raw.dir !== "across" && raw.dir !== "down")) return null;
  if (!Array.isArray(raw.sizes) || !Array.isArray(raw.children) || raw.sizes.length !== raw.children.length) return null;
  const dir = raw.dir;
  const given = raw.sizes as unknown[];
  const children: MapNode[] = [];
  const sizes: number[] = [];
  // The width of leading children that can't be read, waiting for the first child that can.
  let lead = 0;
  raw.children.forEach((value, at) => {
    const size = sizeOf(given[at]);
    const child = nodeOf(value, depth + 1);
    if (child) {
      children.push(child);
      sizes.push(size + lead);
      lead = 0;
    } else if (dir === "across") {
      // A child that can't be read gives its width to its sibling: the one before it, or the next one when it is first.
      if (sizes.length > 0) sizes[sizes.length - 1] += size;
      else lead += size;
    }
  });
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...unknownKeys(raw, SPLIT_KEYS), kind: "split", id: raw.id, dir, sizes: dir === "across" ? scaled(sizes) : sizes, children } as MapSplit;
}

function nodeOf(value: unknown, depth: number): MapNode | null {
  const raw = asObject(value);
  if (!raw || depth > READ_DEPTH) return null;
  if (raw.kind === "box") return boxOf(raw);
  if (raw.kind === "region") return regionOf(raw, depth);
  if (raw.kind === "split") return splitOf(raw, depth);
  return null;
}

/** A tile that appears in two boxes keeps its first place only (in tree order), with its indent, parts and note. */
function placedOnce(root: MapNode): MapNode {
  const seen = new Set<string>();
  const visit = (node: MapNode): MapNode => {
    if (node.kind === "split") return { ...node, children: node.children.map(visit) };
    if (node.kind === "region") return { ...node, child: visit(node.child) };
    const repeated = node.tiles.filter((tile) => seen.has(tile));
    node.tiles.forEach((tile) => seen.add(tile));
    if (repeated.length === 0) return node;
    const drop = <T,>(record: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([tile]) => !repeated.includes(tile)));
    return { ...node, tiles: node.tiles.filter((tile) => !repeated.includes(tile)), indent: drop(node.indent), show: drop(node.show), notes: drop(node.notes) };
  };
  return visit(root);
}

function endOf(value: unknown): MapEnd | null {
  const raw = asObject(value);
  if (raw && isString(raw.tile)) return { tile: raw.tile };
  if (raw && isString(raw.box)) return { box: raw.box };
  return null;
}

/**
 * `making.map_layout`, read defensively. Null when there is none, it isn't version 1, or its root can't be read. A node that
 * can't be read is dropped and its space goes to its sibling, so the tree is still full; sizes, the width, the background
 * and the numbers are brought back into range; a tile in two boxes keeps its first place. Unknown keys are kept as they are.
 */
export function mapLayoutOf(making: unknown): MapLayout | null {
  const raw = asObject(asObject(making)?.map_layout);
  if (!raw || raw.v !== 1) return null;
  const read = nodeOf(raw.root, 0);
  if (!read) return null;
  const width = typeof raw.width === "number" && Number.isFinite(raw.width) ? Math.min(MAP_WIDTH.max, Math.max(MAP_WIDTH.min, raw.width)) : MAP_WIDTH.standard;
  const background = isString(raw.background) && ((MAP_BACKGROUNDS as readonly string[]).includes(raw.background) || HEX.test(raw.background)) ? raw.background : "grey";
  const numbers = raw.numbers === "session" || raw.numbers === "part" ? raw.numbers : "build";
  const twoWay = Array.isArray(raw.twoWay)
    ? raw.twoWay.flatMap((value) => {
        const pair = asObject(value);
        const a = endOf(pair?.a);
        const b = endOf(pair?.b);
        return pair && a && b ? [{ ...unknownKeys(pair, ["a", "b"]), a, b }] : [];
      })
    : [];
  const linkGutters: Record<string, number> = {};
  for (const [link, gutter] of Object.entries(asObject(raw.linkGutters) ?? {})) {
    if (typeof gutter === "number" && Number.isInteger(gutter) && gutter >= 0) linkGutters[link] = gutter;
  }
  return {
    ...unknownKeys(raw, LAYOUT_KEYS),
    v: 1,
    width,
    background,
    dotGrid: raw.dotGrid === true,
    numbers,
    root: placedOnce(read),
    outlines: strings(raw.outlines),
    twoWay,
    twoWayDismissed: strings(raw.twoWayDismissed),
    hiddenLinks: strings(raw.hiddenLinks),
    linkGutters,
  } as MapLayout;
}

/* ── refusing ── */

/** Every node of the tree, parents before children, with its depth (the root is 1) and the regions above it. */
function walk(root: MapNode, visit: (node: MapNode, depth: number, regions: readonly MapRegion[]) => void): void {
  const go = (node: MapNode, depth: number, regions: readonly MapRegion[]) => {
    visit(node, depth, regions);
    if (node.kind === "split") node.children.forEach((child) => go(child, depth + 1, regions));
    else if (node.kind === "region") go(node.child, depth + 1, [...regions, node]);
  };
  go(root, 1, []);
}

const byteLength = (text: string): number => (typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text).length : text.length);

/**
 * Why a layout can't be saved, or null. Pure, so the editor can say no first. `partOf` gives a session's part key; when it
 * is given, a session's frame is refused outside its part's frame (when that part is framed) and inside another part's frame.
 */
export function mapLayoutRefusal(layout: MapLayout, partOf?: (session: string) => string | undefined): string | null {
  if (byteLength(JSON.stringify(layout)) > MAP_LIMITS.bytes) return MAP_LAYOUT_COPY.tooLarge;
  let count = 0;
  let deepest = 0;
  walk(layout.root, (_node, depth) => {
    count += 1;
    deepest = Math.max(deepest, depth);
  });
  if (count > MAP_LIMITS.nodes) return MAP_LAYOUT_COPY.tooManyNodes;
  if (deepest > MAP_LIMITS.depth) return MAP_LAYOUT_COPY.tooDeep;

  const framedParts = new Set<string>();
  walk(layout.root, (node) => {
    if (node.kind === "region" && "part" in node.of) framedParts.add(node.of.part);
  });
  const ids = new Set<string>();
  const tiles = new Set<string>();
  let why: string | null = null;
  const tooLong = (node: MapBox | MapRegion): string | null => {
    if (node.title !== undefined && node.title.length > MAP_LIMITS.title) return MAP_LAYOUT_COPY.title;
    if (node.explanation !== undefined && node.explanation.length > MAP_LIMITS.explanation) return MAP_LAYOUT_COPY.explanation;
    return null;
  };
  walk(layout.root, (node, _depth, regions) => {
    if (why) return;
    if (ids.has(node.id)) {
      why = MAP_LAYOUT_COPY.sameId;
      return;
    }
    ids.add(node.id);
    if (node.kind === "split") {
      if (node.children.length < 2) why = MAP_LAYOUT_COPY.fewChildren;
      else if (node.sizes.length !== node.children.length || node.sizes.some((size) => !Number.isFinite(size) || size < 0)) why = MAP_LAYOUT_COPY.sizes;
      else if (node.dir === "across" && Math.abs(node.sizes.reduce((sum, size) => sum + size, 0) - 1) > MAP_LIMITS.sum) why = MAP_LAYOUT_COPY.sizes;
      return;
    }
    if (node.kind === "region") {
      const kind = "part" in node.of ? "part" : "session";
      if (regions.some((above) => ("part" in above.of ? "part" : "session") === kind)) {
        why = MAP_LAYOUT_COPY.regionInRegion;
        return;
      }
      if ("session" in node.of && partOf) {
        const part = partOf(node.of.session);
        const inPart = regions.find((above): above is MapRegion & { of: { part: string } } => "part" in above.of);
        if ((part && framedParts.has(part) && inPart?.of.part !== part) || (inPart && inPart.of.part !== part)) {
          why = MAP_LAYOUT_COPY.sessionOutsidePart;
          return;
        }
      }
      why = tooLong(node);
      return;
    }
    for (const tile of node.tiles) {
      if (tiles.has(tile)) {
        why = MAP_LAYOUT_COPY.tileTwice;
        return;
      }
      tiles.add(tile);
    }
    why = tooLong(node) ?? (Object.values(node.notes).some((note) => note.length > MAP_LIMITS.note) ? MAP_LAYOUT_COPY.note : null);
  });
  return why;
}

/* ── MS-01: the split tree ──
   Every operation takes a layout and returns a new one, never changing the one it was given, or a refusal. Each keeps the
   tree full (every split's children fill it, `across` sizes add up to 1) and normal (no split of one child, no split inside a
   split of the same direction), keeps the ids of the nodes that survive, and leaves which tiles exist and their order inside
   a box alone except where it says so. What needs pixels to judge (minimum widths) is checked through `fits`, which MS-02
   supplies. Order rules are MS-03's. */

/** What an operation gives back. `changed`: the ids whose size or place changed, for undo and for announcements. */
export type TreeResult = { ok: true; layout: MapLayout; changed: string[] } | { ok: false; reason: string };

/** A check of the whole layout, for what the tree can't judge alone (minimum widths). Null: it fits. */
export type Fits = (layout: MapLayout) => string | null;

export type MapSide = "left" | "right" | "top" | "bottom";

/** What an operation that makes nodes or changes sizes can be given. */
export interface TreeOptions {
  fits?: Fits;
  /** Ids for the nodes it makes; `newMapNodeId` when not given. */
  newId?: () => string;
}

/** What an operation that moves tiles is given: where each tile stands in the build and which session it is in. */
export interface TileOptions extends TreeOptions {
  buildOrder: (tile: string) => number;
  sessionOf: (tile: string) => string | undefined;
  /** "Prompt 4", for refusals. The tile id when not given. */
  tileName?: (tile: string) => string;
  /** "Session 2", for refusals. The key when not given. */
  sessionName?: (session: string) => string;
}

/* ── walking the tree ── */

const kidsOf = (node: MapNode): MapNode[] => (node.kind === "split" ? node.children : node.kind === "region" ? [node.child] : []);

/** The nodes from the root down to `id`, both included; empty when it isn't in the tree. */
export function pathTo(layout: Pick<MapLayout, "root">, id: string): MapNode[] {
  const go = (node: MapNode): MapNode[] | null => {
    if (node.id === id) return [node];
    for (const kid of kidsOf(node)) {
      const found = go(kid);
      if (found) return [node, ...found];
    }
    return null;
  };
  return go(layout.root) ?? [];
}

export function nodeById(layout: Pick<MapLayout, "root">, id: string): MapNode | null {
  const path = pathTo(layout, id);
  return path[path.length - 1] ?? null;
}

/** The node holding `id`, and where among its children it stands (0 in a region). Null for the root or a missing id. */
export function parentOf(layout: Pick<MapLayout, "root">, id: string): { parent: MapSplit | MapRegion; index: number } | null {
  const path = pathTo(layout, id);
  if (path.length < 2) return null;
  const parent = path[path.length - 2] as MapSplit | MapRegion;
  return { parent, index: kidsOf(parent).indexOf(path[path.length - 1]) };
}

/** Every box, in tree order. */
export function boxes(layout: Pick<MapLayout, "root">): MapBox[] {
  const out: MapBox[] = [];
  const go = (node: MapNode) => (node.kind === "box" ? out.push(node) : kidsOf(node).forEach(go));
  go(layout.root);
  return out;
}

/** Every tile on the canvas, in tree order. */
export const placedTiles = (layout: Pick<MapLayout, "root">): string[] => boxes(layout).flatMap((box) => box.tiles);

export const boxOfTile = (layout: Pick<MapLayout, "root">, tile: string): MapBox | null => boxes(layout).find((box) => box.tiles.includes(tile)) ?? null;

/**
 * A node with the frames that hold only it: the highest of the regions directly above it (each region holds one child), and
 * the split that holds that, when there is one. A box in a frame fills the frame, so this is the rectangle it fills.
 */
export function unitOf(root: MapNode, id: string): { unit: MapNode; parent: MapSplit | null; index: number } | null {
  const path = pathTo({ root }, id);
  if (path.length === 0) return null;
  let at = path.length - 1;
  while (at > 0 && path[at - 1].kind === "region") at -= 1;
  if (at === 0) return { unit: path[0], parent: null, index: 0 };
  const parent = path[at - 1] as MapSplit;
  return { unit: path[at], parent, index: parent.children.indexOf(path[at]) };
}

/**
 * The siblings a node shares a full edge with, and on which side. From the tree alone, only two neighbouring children of
 * one split share a full edge (a node in a frame takes the frame's place). MS-02 adds neighbours across branches.
 */
export function neighbours(layout: Pick<MapLayout, "root">, id: string): { id: string; side: MapSide }[] {
  const found = unitOf(layout.root, id);
  if (!found?.parent) return [];
  const { parent, index } = found;
  const across = parent.dir === "across";
  const out: { id: string; side: MapSide }[] = [];
  if (index > 0) out.push({ id: parent.children[index - 1].id, side: across ? "left" : "top" });
  if (index < parent.children.length - 1) out.push({ id: parent.children[index + 1].id, side: across ? "right" : "bottom" });
  return out;
}

/** The tree with the node `id` replaced by what `change` gives. Nothing else is copied. */
function replaceNode(root: MapNode, id: string, change: (node: MapNode) => MapNode): MapNode {
  const go = (node: MapNode): MapNode => {
    if (node.id === id) return change(node);
    if (node.kind === "split") {
      const children = node.children.map(go);
      return children.every((kid, at) => kid === node.children[at]) ? node : { ...node, children };
    }
    if (node.kind === "region") {
      const child = go(node.child);
      return child === node.child ? node : { ...node, child };
    }
    return node;
  };
  return go(root);
}

/**
 * The tree with `id` (and the frames that hold only it) taken out, its space given to its neighbour in the same split: the
 * one before it, or the next one when it is first. `root` null: it was the whole canvas. Not normalised, so every other id
 * is still where it was until the operation finishes.
 */
function cutFrom(root: MapNode, id: string): { root: MapNode | null; receiver: string | null; unit: MapNode } {
  const found = unitOf(root, id) as NonNullable<ReturnType<typeof unitOf>>;
  if (!found.parent) return { root: null, receiver: null, unit: found.unit };
  const { parent, index } = found;
  const children = parent.children.filter((_, at) => at !== index);
  const to = index > 0 ? index - 1 : 0;
  const kept = parent.sizes.filter((_, at) => at !== index);
  const sizes = parent.dir === "across" ? kept.map((size, at) => (at === to ? size + parent.sizes[index] : size)) : kept;
  return { root: replaceNode(root, parent.id, () => ({ ...parent, children, sizes })), receiver: children[to].id, unit: found.unit };
}

/* ── normal form ── */

function normalNode(node: MapNode): MapNode {
  if (node.kind === "box") return node;
  if (node.kind === "region") {
    const child = normalNode(node.child);
    return child === node.child ? node : { ...node, child };
  }
  const children: MapNode[] = [];
  const sizes: number[] = [];
  node.children.forEach((kid, at) => {
    const normal = normalNode(kid);
    const size = node.sizes[at] ?? 0;
    if (normal.kind === "split" && normal.dir === node.dir) {
      // A split inside a split of the same direction joins it. Widths multiply through; extra heights are kept, and the inner
      // split's own extra height goes to its last child.
      normal.children.forEach((grandchild, inner) => {
        children.push(grandchild);
        sizes.push(node.dir === "across" ? size * normal.sizes[inner] : normal.sizes[inner] + (inner === normal.children.length - 1 ? size : 0));
      });
    } else {
      children.push(normal);
      sizes.push(size);
    }
  });
  if (children.length === 1) return children[0];
  return { ...node, children, sizes: node.dir === "across" ? scaled(sizes) : sizes };
}

/** The layout in normal form: no split of one child, no split inside a split of the same direction, widths adding up to 1. */
export function normalise(layout: MapLayout): MapLayout {
  return { ...layout, root: normalNode(layout.root) };
}

/** Normalise, check the sizes, and answer. */
function finish(layout: MapLayout, changed: readonly (string | null | undefined)[], options: TreeOptions = {}): TreeResult {
  const next = normalise(layout);
  const why = options.fits?.(next);
  if (why) return { ok: false, reason: why };
  return { ok: true, layout: next, changed: [...new Set(changed.filter((id): id is string => Boolean(id)))] };
}

const no = (reason: string): TreeResult => ({ ok: false, reason });
const freshId = (options: TreeOptions) => (options.newId ?? newMapNodeId)();
const blankBox = (id: string, tiles: string[] = []): MapBox => ({ kind: "box", id, tiles, layout: "stack", indent: {}, show: {}, notes: {} });

/** A tile's indent, parts and note in a box, to travel with it. */
function tileDress(box: MapBox, tiles: readonly string[]): Pick<MapBox, "indent" | "show" | "notes"> {
  const pick = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([tile]) => tiles.includes(tile)));
  return { indent: pick(box.indent), show: pick(box.show), notes: pick(box.notes) };
}

function withoutTiles(box: MapBox, tiles: readonly string[]): MapBox {
  const keep = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([tile]) => !tiles.includes(tile)));
  return { ...box, tiles: box.tiles.filter((tile) => !tiles.includes(tile)), indent: keep(box.indent), show: keep(box.show), notes: keep(box.notes) };
}

function withTiles(box: MapBox, tiles: readonly string[], dress: Pick<MapBox, "indent" | "show" | "notes">, buildOrder?: (tile: string) => number): MapBox {
  const all = [...box.tiles, ...tiles.filter((tile) => !box.tiles.includes(tile))];
  if (buildOrder) all.sort((a, b) => buildOrder(a) - buildOrder(b));
  return { ...box, tiles: all, indent: { ...box.indent, ...dress.indent }, show: { ...box.show, ...dress.show }, notes: { ...box.notes, ...dress.notes } };
}

/** Why `tile` can't join `box` (it holds another session), or null. A text box takes any session. */
function sessionRefusal(box: MapBox, tile: string, options: Pick<TileOptions, "sessionOf" | "tileName" | "sessionName">): string | null {
  const its = options.sessionOf(tile);
  const holds = box.tiles.map(options.sessionOf).find((key): key is string => Boolean(key));
  if (!holds || !its || its === holds) return null;
  const session = options.sessionName ?? ((key: string) => key);
  return MAP_LAYOUT_COPY.otherSession((options.tileName ?? ((id: string) => id))(tile), session(its), session(holds));
}

const dirOfSide = (side: MapSide): MapSplit["dir"] => (side === "left" || side === "right" ? "across" : "down");

/** `node` put beside `targetId` on `side`, at half the target's size: inside the target's split when it runs that way. */
function beside(root: MapNode, node: MapNode, targetId: string, side: MapSide, options: TreeOptions): MapNode {
  const dir = dirOfSide(side);
  const first = side === "left" || side === "top";
  const parent = parentOf({ root }, targetId);
  if (parent && parent.parent.kind === "split" && parent.parent.dir === dir) {
    const split = parent.parent;
    const at = parent.index;
    const half = split.sizes[at] / 2;
    const children = [...split.children];
    const sizes = [...split.sizes];
    children.splice(first ? at : at + 1, 0, node);
    if (dir === "across") {
      sizes.splice(at, 1, half);
      sizes.splice(first ? at : at + 1, 0, half);
    } else sizes.splice(first ? at : at + 1, 0, 0);
    return replaceNode(root, split.id, () => ({ ...split, children, sizes }));
  }
  return replaceNode(root, targetId, (target) => ({
    kind: "split",
    id: freshId(options),
    dir,
    sizes: dir === "across" ? [0.5, 0.5] : [0, 0],
    children: first ? [node, target] : [target, node],
  }));
}

/* ── shaping ── */

/**
 * Split a box in two, side by side (`across`) or one above the other (`down`), cut at `at` of its size. The box keeps its
 * contents, title, explanation and style; the new box is empty, or holds `newTiles` (from the box's session) taken out of
 * wherever they were. In a split of the same direction the new box joins it beside the box instead of nesting.
 */
export function splitBox(
  layout: MapLayout,
  boxId: string,
  dir: MapSplit["dir"],
  at = 0.5,
  newTiles: readonly string[] = [],
  options: TreeOptions & Partial<Pick<TileOptions, "buildOrder" | "sessionOf">> = {},
): TreeResult {
  const box = nodeById(layout, boxId);
  if (!box) return no(MAP_LAYOUT_COPY.noNode);
  if (box.kind !== "box") return no(MAP_LAYOUT_COPY.notABox);
  if (!(at > 0 && at < 1)) return no(MAP_LAYOUT_COPY.splitAt);
  const moving = [...new Set(newTiles)];
  const changed: string[] = [boxId];
  let root = layout.root;
  const dress: Pick<MapBox, "indent" | "show" | "notes"> = { indent: {}, show: {}, notes: {} };
  if (moving.length > 0) {
    if (options.sessionOf) {
      const sessions = new Set([...box.tiles, ...moving].map(options.sessionOf).filter(Boolean));
      if (sessions.size > 1) return no(MAP_LAYOUT_COPY.differentSessions);
    }
    for (const from of boxes(layout)) {
      if (!from.tiles.some((tile) => moving.includes(tile))) continue;
      if (from.tiles.every((tile) => moving.includes(tile))) return no(MAP_LAYOUT_COPY.lastTile);
      const own = tileDress(from, moving);
      Object.assign(dress.indent, own.indent);
      Object.assign(dress.show, own.show);
      Object.assign(dress.notes, own.notes);
      root = replaceNode(root, from.id, (node) => withoutTiles(node as MapBox, moving));
      changed.push(from.id);
    }
  }
  const order = options.buildOrder;
  const fresh: MapBox = { ...blankBox(freshId(options), order ? [...moving].sort((a, b) => order(a) - order(b)) : moving), ...dress };
  changed.push(fresh.id);
  const parent = parentOf({ root }, boxId);
  if (parent && parent.parent.kind === "split" && parent.parent.dir === dir) {
    const split = parent.parent;
    const size = split.sizes[parent.index];
    const children = [...split.children];
    const sizes = [...split.sizes];
    children.splice(parent.index + 1, 0, fresh);
    if (dir === "across") sizes.splice(parent.index, 1, size * at, size * (1 - at));
    else sizes.splice(parent.index + 1, 0, 0);
    root = replaceNode(root, split.id, () => ({ ...split, children, sizes }));
  } else {
    const id = freshId(options);
    changed.push(id);
    root = replaceNode(root, boxId, (node) => ({ kind: "split", id, dir, sizes: dir === "across" ? [at, 1 - at] : [0, 0], children: [node, fresh] }));
  }
  return finish({ ...layout, root }, changed, options);
}

/** Remove a box. Its space goes to its neighbour in the same split; its tiles become unplaced. The last box stays. */
export function removeBox(layout: MapLayout, boxId: string, options: TreeOptions = {}): TreeResult {
  const box = nodeById(layout, boxId);
  if (!box) return no(MAP_LAYOUT_COPY.noNode);
  if (box.kind !== "box") return no(MAP_LAYOUT_COPY.notABox);
  const cut = cutFrom(layout.root, boxId);
  if (!cut.root) return no(MAP_LAYOUT_COPY.lastBox);
  return finish({ ...layout, root: cut.root }, [cut.unit.id, boxId, cut.receiver], options);
}

/**
 * Join two neighbouring boxes of one split that hold the same session (a text box joins anything). Tiles join in build order.
 * The merged box is the first of the two: its id, title, explanation and style, or the second's where it has none.
 */
export function mergeBoxes(layout: MapLayout, aId: string, bId: string, options: Pick<TileOptions, "buildOrder" | "sessionOf"> & TreeOptions): TreeResult {
  if (aId === bId) return no(MAP_LAYOUT_COPY.sameBox);
  const a = nodeById(layout, aId);
  const b = nodeById(layout, bId);
  if (!a || !b) return no(MAP_LAYOUT_COPY.noNode);
  if (a.kind !== "box" || b.kind !== "box") return no(MAP_LAYOUT_COPY.notABox);
  const pa = parentOf(layout, aId);
  const pb = parentOf(layout, bId);
  if (!pa || !pb || pa.parent !== pb.parent || pa.parent.kind !== "split" || Math.abs(pa.index - pb.index) !== 1) return no(MAP_LAYOUT_COPY.notNeighbours);
  const sessions = new Set([...a.tiles, ...b.tiles].map(options.sessionOf).filter(Boolean));
  if (sessions.size > 1) return no(MAP_LAYOUT_COPY.differentSessions);
  const split = pa.parent;
  const [first, second] = pa.index < pb.index ? [a, b] : [b, a];
  const at = Math.min(pa.index, pb.index);
  const merged: MapBox = withTiles(first, second.tiles, second, options.buildOrder);
  if (merged.title === undefined && second.title !== undefined) merged.title = second.title;
  if (merged.explanation === undefined && second.explanation !== undefined) merged.explanation = second.explanation;
  if (merged.style === undefined && second.style !== undefined) merged.style = second.style;
  const children = [...split.children];
  children.splice(at, 2, merged);
  const sizes = [...split.sizes];
  sizes.splice(at, 2, split.sizes[at] + split.sizes[at + 1]);
  return finish({ ...layout, root: replaceNode(layout.root, split.id, () => ({ ...split, children, sizes })) }, [first.id, second.id], options);
}

/**
 * Move the edge between child `index` and `index + 1` of a split by `delta`. Across, `delta` is a share of the split's width,
 * clamped so neither side passes the minimum (`fits`). Down, it changes `sizes[index]`, the extra height, never below 0.
 */
export function moveEdge(layout: MapLayout, splitId: string, index: number, delta: number, options: TreeOptions = {}): TreeResult {
  const split = nodeById(layout, splitId);
  if (!split || split.kind !== "split") return no(MAP_LAYOUT_COPY.noNode);
  if (!Number.isInteger(index) || index < 0 || index >= split.children.length - 1 || !Number.isFinite(delta)) return no(MAP_LAYOUT_COPY.noEdge);
  const across = split.dir === "across";
  const wanted = across ? Math.min(split.sizes[index + 1], Math.max(-split.sizes[index], delta)) : Math.max(-split.sizes[index], delta);
  const moved = (by: number): MapLayout => {
    const sizes = [...split.sizes];
    sizes[index] += by;
    if (across) sizes[index + 1] -= by;
    return { ...layout, root: replaceNode(layout.root, splitId, () => ({ ...split, sizes })) };
  };
  const changed = across ? [split.children[index].id, split.children[index + 1].id] : [split.children[index].id];
  const fits = options.fits;
  if (!fits || !fits(moved(wanted))) return finish(moved(wanted), changed, options);
  // The furthest the edge can go towards `delta` and still fit.
  let lo = 0;
  let hi = 1;
  for (let round = 0; round < 32; round += 1) {
    const mid = (lo + hi) / 2;
    if (fits(moved(wanted * mid))) hi = mid;
    else lo = mid;
  }
  if (lo === 0) return no(fits(moved(wanted)) as string);
  return finish(moved(wanted * lo), changed, options);
}

/**
 * Stretch a box (or a frame) across the full width of the row it sits in: the child of the nearest `down` split or frame
 * above it (with the frames that hold only it), or the whole canvas. Inside a frame the row ends at the frame (MS-07). Its
 * old row-mates stay in a row of their own directly below it. Whether the order allows it is MS-03's.
 */
export function spanNode(layout: MapLayout, id: string, options: TreeOptions = {}): TreeResult {
  const path = pathTo(layout, id);
  if (path.length === 0) return no(MAP_LAYOUT_COPY.noNode);
  let top = path.length - 1;
  while (top > 0 && path[top - 1].kind === "region") top -= 1;
  let above = top - 1;
  while (above >= 0 && path[above].kind === "split" && (path[above] as MapSplit).dir === "across") above -= 1;
  const between = path.slice(above + 1, top);
  if (between.length === 0) return no(MAP_LAYOUT_COPY.alreadySpans);
  const node = path[top];
  const row = between[0];
  const rest = cutFrom(row, node.id).root as MapNode;
  const column = (): MapSplit => ({ kind: "split", id: freshId(options), dir: "down", sizes: [0, 0], children: [node, rest] });
  let root: MapNode;
  const holder = above >= 0 ? path[above] : null;
  if (holder?.kind === "split") {
    const at = holder.children.indexOf(row);
    const children = [...holder.children];
    const sizes = [...holder.sizes];
    children.splice(at, 1, node, rest);
    sizes.splice(at, 0, 0);
    root = replaceNode(layout.root, holder.id, () => ({ ...holder, children, sizes }));
  } else if (holder?.kind === "region") {
    root = replaceNode(layout.root, holder.id, () => ({ ...holder, child: column() }));
  } else {
    root = column();
  }
  return finish({ ...layout, root }, [id, row.id], options);
}

/** `spanNode` for a box. */
export function spanBox(layout: MapLayout, boxId: string, options: TreeOptions = {}): TreeResult {
  const box = nodeById(layout, boxId);
  if (box && box.kind !== "box") return no(MAP_LAYOUT_COPY.notABox);
  return spanNode(layout, boxId, options);
}

/** Make the chosen children of a split (all of them when none are named) the same size, sharing the space they take. */
export function evenOut(layout: MapLayout, splitId: string, indexes?: readonly number[], options: TreeOptions = {}): TreeResult {
  const split = nodeById(layout, splitId);
  if (!split || split.kind !== "split") return no(MAP_LAYOUT_COPY.noNode);
  const picks = [...new Set(indexes ?? split.children.map((_, at) => at))].filter((at) => Number.isInteger(at) && at >= 0 && at < split.children.length);
  if (picks.length < 2) return no(MAP_LAYOUT_COPY.chooseTwo);
  const each = picks.reduce((sum, at) => sum + split.sizes[at], 0) / picks.length;
  const sizes = split.sizes.map((size, at) => (picks.includes(at) ? each : size));
  const changed = picks.filter((at) => sizes[at] !== split.sizes[at]).map((at) => split.children[at].id);
  return finish({ ...layout, root: replaceNode(layout.root, splitId, () => ({ ...split, sizes })) }, changed, options);
}

/** A node's share of the canvas width: the `across` sizes above it, multiplied. */
function widthShare(root: MapNode, id: string): number {
  const path = pathTo({ root }, id);
  let share = 1;
  for (let at = 0; at < path.length - 1; at += 1) {
    const node = path[at];
    if (node.kind === "split" && node.dir === "across") share *= node.sizes[node.children.indexOf(path[at + 1])];
  }
  return share;
}

/**
 * Give each box the width (`width`: its split runs across) or extra height (`height`: its split runs down) of the first. A
 * box whose split runs the other way, or that would need more than its row, is named in the refusal. In a split, boxes
 * already matched keep their size and the rest share what is left.
 */
export function matchSize(layout: MapLayout, ids: readonly string[], axis: "width" | "height", options: TreeOptions & { nameOf?: (id: string) => string } = {}): TreeResult {
  const list = [...new Set(ids)];
  if (list.length < 2) return no(MAP_LAYOUT_COPY.chooseTwo);
  const nameOf = options.nameOf ?? ((id: string) => {
    const node = nodeById(layout, id);
    return (node && node.kind !== "split" && node.title) || "This box";
  });
  const want = axis === "width" ? "across" : "down";
  let root = layout.root;
  const placeOf = (id: string) => {
    const found = unitOf(root, id);
    return found?.parent && found.parent.dir === want ? (found as { unit: MapNode; parent: MapSplit; index: number }) : null;
  };
  for (const id of list) if (!nodeById(layout, id)) return no(MAP_LAYOUT_COPY.noNode);
  const first = placeOf(list[0]);
  if (!first) return no(MAP_LAYOUT_COPY.cantMatch(nameOf(list[0]), axis));
  const target = axis === "width" ? widthShare(root, first.unit.id) : first.parent.sizes[first.index];
  const fixed = new Set([first.unit.id]);
  const changed = new Set<string>();
  for (const id of list.slice(1)) {
    const place = placeOf(id);
    if (!place) return no(MAP_LAYOUT_COPY.cantMatch(nameOf(id), axis));
    const { parent, index, unit } = place;
    const sizes = [...parent.sizes];
    if (axis === "height") sizes[index] = target;
    else {
      const share = target / widthShare(root, parent.id);
      const kept = parent.children.reduce((sum, kid, at) => (at !== index && fixed.has(kid.id) ? sum + sizes[at] : sum), 0);
      const free = parent.children.map((kid, at) => at !== index && !fixed.has(kid.id));
      const freeTotal = sizes.reduce((sum, size, at) => (free[at] ? sum + size : sum), 0);
      const left = 1 - share - kept;
      if (left < -MAP_LIMITS.sum || (left > MAP_LIMITS.sum && !free.some(Boolean))) return no(MAP_LAYOUT_COPY.noRoom(nameOf(id)));
      const count = free.filter(Boolean).length;
      sizes[index] = share;
      sizes.forEach((size, at) => {
        if (free[at]) sizes[at] = freeTotal > 0 ? (size * Math.max(0, left)) / freeTotal : Math.max(0, left) / count;
      });
    }
    sizes.forEach((size, at) => {
      if (size !== parent.sizes[at]) changed.add(parent.children[at].id);
    });
    fixed.add(unit.id);
    root = replaceNode(root, parent.id, () => ({ ...parent, sizes }));
  }
  return finish({ ...layout, root }, [...changed], options);
}

/** Two nodes trade places and sizes; everything about each goes with it. Neither may hold the other. */
export function swapNodes(layout: MapLayout, aId: string, bId: string, options: TreeOptions = {}): TreeResult {
  if (aId === bId) return no(MAP_LAYOUT_COPY.sameBox);
  const pathA = pathTo(layout, aId);
  const pathB = pathTo(layout, bId);
  if (pathA.length === 0 || pathB.length === 0) return no(MAP_LAYOUT_COPY.noNode);
  if (pathA.some((node) => node.id === bId) || pathB.some((node) => node.id === aId)) return no(MAP_LAYOUT_COPY.insideItself);
  const a = pathA[pathA.length - 1];
  const b = pathB[pathB.length - 1];
  const swap = (node: MapNode): MapNode => {
    if (node.id === aId) return b;
    if (node.id === bId) return a;
    if (node.kind === "split") return { ...node, children: node.children.map(swap) };
    if (node.kind === "region") return { ...node, child: swap(node.child) };
    return node;
  };
  return finish({ ...layout, root: swap(layout.root) }, [aId, bId], options);
}

/** `swapNodes` for two boxes. */
export function swapBoxes(layout: MapLayout, aId: string, bId: string, options: TreeOptions = {}): TreeResult {
  const kinds = [nodeById(layout, aId)?.kind, nodeById(layout, bId)?.kind];
  if (kinds.every(Boolean) && kinds.some((kind) => kind !== "box")) return no(MAP_LAYOUT_COPY.notABox);
  return swapNodes(layout, aId, bId, options);
}

/**
 * Take a node out (its space to its neighbour, its tiles still placed) and split it in beside `targetId` on `side`, at half
 * the target's size. What a drop on an edge does (MS-08).
 */
export function insertNode(layout: MapLayout, nodeId: string, targetId: string, side: MapSide, options: TreeOptions = {}): TreeResult {
  if (nodeId === targetId) return no(MAP_LAYOUT_COPY.sameBox);
  const node = nodeById(layout, nodeId);
  const pathT = pathTo(layout, targetId);
  if (!node || pathT.length === 0) return no(MAP_LAYOUT_COPY.noNode);
  if (pathT.some((above) => above.id === nodeId)) return no(MAP_LAYOUT_COPY.insideItself);
  const cut = cutFrom(layout.root, nodeId);
  // A target that was only a frame around the node is gone with it.
  if (!cut.root || !pathTo({ root: cut.root }, targetId).length) return no(MAP_LAYOUT_COPY.insideItself);
  return finish({ ...layout, root: beside(cut.root, node, targetId, side, options) }, [nodeId, targetId, cut.receiver], options);
}

/** `insertNode` for a box. */
export function insertBox(layout: MapLayout, boxId: string, targetId: string, side: MapSide, options: TreeOptions = {}): TreeResult {
  const box = nodeById(layout, boxId);
  if (box && box.kind !== "box") return no(MAP_LAYOUT_COPY.notABox);
  return insertNode(layout, boxId, targetId, side, options);
}

/**
 * Move a placed tile into another box, landing in build order with its indent, parts and note. Refused when the box holds
 * another session, and for the last tile of its box.
 */
export function moveTile(layout: MapLayout, tileId: string, toBoxId: string, options: TileOptions): TreeResult {
  const from = boxOfTile(layout, tileId);
  if (!from) return no(MAP_LAYOUT_COPY.notPlaced);
  const to = nodeById(layout, toBoxId);
  if (!to) return no(MAP_LAYOUT_COPY.noNode);
  if (to.kind !== "box") return no(MAP_LAYOUT_COPY.notABox);
  if (to.id === from.id) return { ok: true, layout, changed: [] };
  const why = sessionRefusal(to, tileId, options);
  if (why) return no(why);
  if (from.tiles.length === 1) return no(MAP_LAYOUT_COPY.lastTile);
  let root = replaceNode(layout.root, from.id, (node) => withoutTiles(node as MapBox, [tileId]));
  root = replaceNode(root, to.id, (node) => withTiles(node as MapBox, [tileId], tileDress(from, [tileId]), options.buildOrder));
  return finish({ ...layout, root }, [from.id, to.id], options);
}

/**
 * Put an unplaced tile (from Sources) on the canvas: into a box, by `moveTile`'s rules, or with `to` null into a new box split
 * in beside `beside.id` on `beside.side`, as `insertNode` does.
 */
export function placeTile(layout: MapLayout, tileId: string, to: string | null, options: TileOptions & { beside?: { id: string; side: MapSide } }): TreeResult {
  if (boxOfTile(layout, tileId)) return no(MAP_LAYOUT_COPY.alreadyPlaced);
  if (to !== null) {
    const box = nodeById(layout, to);
    if (!box) return no(MAP_LAYOUT_COPY.noNode);
    if (box.kind !== "box") return no(MAP_LAYOUT_COPY.notABox);
    const why = sessionRefusal(box, tileId, options);
    if (why) return no(why);
    const root = replaceNode(layout.root, to, (node) => withTiles(node as MapBox, [tileId], { indent: {}, show: {}, notes: {} }, options.buildOrder));
    return finish({ ...layout, root }, [to], options);
  }
  if (!options.beside || !nodeById(layout, options.beside.id)) return no(MAP_LAYOUT_COPY.noNode);
  const fresh = blankBox(freshId(options), [tileId]);
  return finish({ ...layout, root: beside(layout.root, fresh, options.beside.id, options.beside.side, options) }, [fresh.id, options.beside.id], options);
}

/**
 * MS-06: take a tile off the canvas: out of its box, which is removed when the tile was its last (the tile becomes unplaced,
 * as `removeBox` leaves tiles). The last box on the canvas is kept, empty. Used for a tile the build no longer has (README
 * Decision 6) and by the order fix.
 */
export function unplaceTile(layout: MapLayout, tileId: string, options: TreeOptions = {}): TreeResult {
  const from = boxOfTile(layout, tileId);
  if (!from) return no(MAP_LAYOUT_COPY.notPlaced);
  if (from.tiles.length > 1) return finish({ ...layout, root: replaceNode(layout.root, from.id, (node) => withoutTiles(node as MapBox, [tileId])) }, [from.id], options);
  const removed = removeBox(layout, from.id, options);
  if (removed.ok) return removed;
  return finish({ ...layout, root: replaceNode(layout.root, from.id, (node) => withoutTiles(node as MapBox, [tileId])) }, [from.id], options);
}

/** MS-06: every box's tiles in build order, for a build whose order changed. Unchanged boxes keep their identity. */
export function sortTiles(layout: MapLayout, buildOrder: (tile: string) => number): TreeResult {
  const changed: string[] = [];
  let root = layout.root;
  for (const box of boxes(layout)) {
    const sorted = [...box.tiles].sort((a, b) => buildOrder(a) - buildOrder(b));
    if (sorted.every((tile, at) => tile === box.tiles[at])) continue;
    changed.push(box.id);
    root = replaceNode(root, box.id, (node) => ({ ...(node as MapBox), tiles: sorted }));
  }
  return changed.length ? finish({ ...layout, root }, changed) : { ok: true, layout, changed };
}

/* ── regions ── */

/** What a frame round `ids` would wrap: one node whose boxes are exactly them, or a run of one split's children. */
function frameTarget(root: MapNode, ids: ReadonlySet<string>): { node: MapNode } | { split: MapSplit; from: number; to: number } | null {
  const inside = (node: MapNode) => boxes({ root: node }).map((box) => box.id);
  let node = root;
  for (;;) {
    const next = kidsOf(node).find((kid) => [...ids].every((id) => inside(kid).includes(id)));
    if (!next) break;
    node = next;
  }
  const held = inside(node);
  if (held.length === ids.size && held.every((id) => ids.has(id))) return { node };
  if (node.kind !== "split") return null;
  const runs = node.children.map((kid) => {
    const own = inside(kid);
    const count = own.filter((id) => ids.has(id)).length;
    return count === 0 ? "out" : count === own.length ? "in" : "mixed";
  });
  const from = runs.indexOf("in");
  const to = runs.lastIndexOf("in");
  if (runs.includes("mixed") || from < 0 || runs.slice(from, to + 1).some((run) => run !== "in")) return null;
  return { split: node, from, to };
}

export type FrameResult = TreeResult | { ok: false; reason: string; proposal: MapLayout | null };

/** The smallest set of `insertNode` moves that makes `ids` one rectangle, keeping every other box in place, or null. */
function frameProposal(layout: MapLayout, ids: ReadonlySet<string>, options: TreeOptions): MapLayout | null {
  const ordered = boxes(layout).map((box) => box.id).filter((id) => ids.has(id));
  let best: MapLayout | null = null;
  let fewest = Number.POSITIVE_INFINITY;
  const consider = (candidate: MapLayout | null, moves: number) => {
    if (candidate && moves < fewest && frameTarget(candidate.root, ids)) {
      best = candidate;
      fewest = moves;
    }
  };
  // Gather the boxes beside one of them, trying each as the one that stays.
  for (const anchor of ordered) {
    let current: MapLayout | null = layout;
    let moves = 0;
    let last = anchor;
    const parent = parentOf(layout, anchor)?.parent;
    const side: MapSide = parent?.kind === "split" && parent.dir === "across" ? "right" : "bottom";
    for (const id of ordered) {
      if (!current || frameTarget(current.root, ids)) break;
      if (id === anchor) continue;
      const result = insertNode(current, id, last, side, options);
      current = result.ok ? result.layout : null;
      moves += 1;
      last = id;
    }
    consider(current, moves);
  }
  // Or move the other boxes out of the way: each one between them goes after the last of them.
  const outsiders = (() => {
    const all = boxes(layout).map((box) => box.id);
    const first = all.indexOf(ordered[0]);
    const end = all.indexOf(ordered[ordered.length - 1]);
    return all.slice(first, end + 1).filter((id) => !ids.has(id));
  })();
  let current: MapLayout | null = layout;
  let moves = 0;
  for (const id of outsiders) {
    if (!current || frameTarget(current.root, ids)) break;
    const lastBox = ordered[ordered.length - 1];
    const parent = parentOf(current, lastBox)?.parent;
    const result = insertNode(current, id, lastBox, parent?.kind === "split" && parent.dir === "across" ? "right" : "bottom", options);
    current = result.ok ? result.layout : null;
    moves += 1;
  }
  consider(current, moves);
  return best;
}

/**
 * Frame boxes in a session or part region. Only when together they are one rectangle (exactly one node, or a run of one
 * split's children); otherwise refused with `proposal`, the smallest rearrangement that makes them one, applied only when
 * the maker accepts (MS-09).
 */
export function frameRegion(layout: MapLayout, of: MapRegion["of"], boxIds: readonly string[], options: TreeOptions = {}): FrameResult {
  const ids = new Set(boxIds);
  if (ids.size === 0) return no(MAP_LAYOUT_COPY.chooseTwo);
  for (const id of ids) {
    const node = nodeById(layout, id);
    if (!node) return no(MAP_LAYOUT_COPY.noNode);
    if (node.kind !== "box") return no(MAP_LAYOUT_COPY.notABox);
  }
  const target = frameTarget(layout.root, ids);
  if (!target) return { ok: false, reason: MAP_LAYOUT_COPY.notRectangle, proposal: frameProposal(layout, ids, options) };
  const id = freshId(options);
  let root: MapNode;
  if ("node" in target) root = replaceNode(layout.root, target.node.id, (node) => ({ kind: "region", id, of: { ...of }, child: node }));
  else {
    const { split, from, to } = target;
    const run = split.children.slice(from, to + 1);
    const share = split.sizes.slice(from, to + 1);
    const total = share.reduce((sum, size) => sum + size, 0);
    const inner: MapSplit = { kind: "split", id: freshId(options), dir: split.dir, sizes: split.dir === "across" ? scaled(share) : share, children: run };
    const children = [...split.children];
    children.splice(from, run.length, { kind: "region", id, of: { ...of }, child: inner });
    const sizes = [...split.sizes];
    sizes.splice(from, run.length, split.dir === "across" ? total : 0);
    root = replaceNode(layout.root, split.id, () => ({ ...split, children, sizes }));
  }
  const next = { ...layout, root };
  const why = mapLayoutRefusal(normalise(next));
  if (why) return no(why);
  return finish(next, [id], options);
}

/** Take a frame away: its boxes stay in exactly the same places. */
export function openRegion(layout: MapLayout, regionId: string, options: TreeOptions = {}): TreeResult {
  const region = nodeById(layout, regionId);
  if (!region || region.kind !== "region") return no(MAP_LAYOUT_COPY.notARegion);
  return finish({ ...layout, root: replaceNode(layout.root, regionId, () => region.child) }, [regionId], options);
}
