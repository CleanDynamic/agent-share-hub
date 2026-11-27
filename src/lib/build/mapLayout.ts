// MS-00: the map sandbox's stored shape, `builds.making.map_layout`. PURE.
//
// A split tree that stores tile ids and session or part keys, never pixel positions: the canvas works out every pixel.
// The types are the MS series README's Decision 3, exactly. `mapLayoutOf` reads the column defensively, the way
// `storedWorkstreamsOf` does; `mapLayoutRefusal` says why a layout can't be saved, so the editor can say no first.
//
// A key the reader doesn't know is ignored when reading and never removed: the reader copies it through onto the object it
// read, so a layout read, changed and written again keeps it.

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

/**
 * Canvas widths in px (README Decision 7). MS-02 moves this to `mapGeometry.ts`, beside `MAP_GRID`; until then it lives here
 * because the reader clamps to it.
 */
export const MAP_WIDTH = { min: 640, narrow: 720, standard: 960, wide: 1200, max: 1600 } as const;

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
