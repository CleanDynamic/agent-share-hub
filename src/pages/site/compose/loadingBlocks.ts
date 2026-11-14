/* CA-24 P1: the building blocks, as numbers; Part E: drawn as a living dot field (`LoadingBlocks.tsx`, src/lib/dots/fluid.ts).

   A loading placeholder is a set of blocks in the shape of what is coming. This module is the pure part: the cell a block's
   box is measured in (8 by 12), how many cells a box holds, the first show, and the sizes of the composer's placeholder. The
   glyph cycle, the wave and the layers that drew the old character grid are gone with it. */

export const CELL_W = 8;
export const CELL_H = 12;

/** Arriving: the blocks fade out over 200 ms while the content fades in over 250. */
export const BLOCKS_OUT_MS = 200;
export const CONTENT_IN_MS = 250;

/** How many cells fill `width`. */
export const columnsOf = (width: number): number => Math.max(0, Math.floor(width / CELL_W));

/**
 * SV-05 P4: a block that fills its box both ways: as many 12-tall rows and 8-wide columns as fit, and the room left over
 * split on both sides, so the cells cover the whole box to within one cell.
 */
export function fillOf(width: number, height: number): { cols: number; rows: number; left: number; top: number } {
  const cols = columnsOf(width);
  const rows = Math.max(0, Math.floor(height / CELL_H));
  return { cols, rows, left: Math.floor((width - cols * CELL_W) / 2), top: Math.floor((height - rows * CELL_H) / 2) };
}

/** A line is one row; a box is `rows`. */
export const rowsOf = (kind: "line" | "box", rows: number): number => (kind === "line" ? 1 : Math.max(1, Math.round(rows)));

let shown = false;
/** True once: the first skeleton of the page's life builds; every later one is simply there. */
export function takeFirstShow(): boolean {
  if (shown) return false;
  shown = true;
  return true;
}
/** For tests. */
export function resetFirstShow(): void {
  shown = false;
}

/* ── the shapes of the first load ("Loading: building blocks") ── */

/** The gap under a line before the next one: lines are 12 tall and 22 apart. */
export const LINE_GAP = 10;
export const LINE_PITCH = CELL_H + LINE_GAP;
export const TITLE_WIDTHS = [180, 120] as const;
export const SOURCES_WIDTHS = [90, 110, 80, 100, 70] as const;
export const DETAILS_WIDTHS = [150, 104, 168, 126, 146, 84] as const;
export const COUNTS_WIDTH = 210;
export const POST_ROWS = 3;
export const TILES = 5;
/** SV-05 P4: a tile's height before the List has measured one (`arrival.tsx` holds its sockets at it too). A tile box fills it. */
export const TILE_HEIGHT = 108;
/** Tile boxes are 18 apart. */
export const TILE_GAP = 18;
/** The columns start this far under the title row, as `SandboxView` has them. */
export const COLUMNS_TOP = 32;
/** The title area's height: the heading, 6, the status line, and the 12 under them. The same box the real title row has. */
export const TITLE_BLOCK_HEIGHT = 49;
/** Under 760 wide the real title row wraps its tabs and actions onto lines of their own: 53 taller, 16 of which is the row gap. */
export const TITLE_WRAP_ROOM = 37;
export const TITLE_WRAP_UNDER = 760;
/** A tile sits in a run: 14 of padding and a 1px rule down its left. */
export const TILE_INSET = 15;


/** A session's prompts, loading in the Session window. */
export const SESSION_PROMPT_ROWS = 3;
/** Sources' library, loading more. */
export const LIBRARY_MORE_WIDTH = 120;
/** The map, while it is laid out. */
export const MAP_LOADING_ROWS = 12;
