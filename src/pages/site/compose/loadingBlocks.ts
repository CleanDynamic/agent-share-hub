/* CA-24 P1: the building blocks, as numbers.

   A loading placeholder is a grid of small characters in the shape of what is coming. This module is the pure part: the cell,
   the ten-frame cycle, the wave that crosses the page, and the order a block builds in on its first show. `LoadingBlocks.tsx`
   draws them; the keyframes for the cycle are `bgLoad*` in `src/index.css`, and `loadingBlocks.test.ts` holds the two to each
   other.

   THE CELL is 8 wide and 12 tall, one character in the data face at 11, centred. Four characters are drawn stacked in each
   cell and each changes opacity only, so nothing but opacity animates.

   THE CYCLE is ten frames in 1,600 ms with no easing between frames (`step-end`): · ▫ ▪ ■ ■ ▪ ▫ · · ·.

   THE WAVE. A cell's cycle starts at -(x / 8 * 22 + y / 12 * 70) mod 1600 ms, where x and y are the cell's place on the page,
   not in its own block, so one diagonal wave crosses every placeholder on the page together. A block that mounts later keeps
   the wave in step by adding the page's own clock (`pageClock`). */

export const CELL_W = 8;
export const CELL_H = 12;
export const CELL_FONT = 11;
export const CYCLE_MS = 1600;
/** The characters, lightest first, and how much of the colour each shows. */
export const GLYPHS = ["\u00B7", "\u25AB", "\u25AA", "\u25A0"] as const;
export const GLYPH_OPACITY = [0.62, 0.62, 0.8, 1] as const;
/** The glyph (an index into GLYPHS) shown in each of the ten frames. */
export const FRAME_GLYPHS: readonly number[] = [0, 1, 2, 3, 3, 2, 1, 0, 0, 0];
export const FRAMES = FRAME_GLYPHS.length;

/** The wave: 22 ms for each cell across, 70 ms for each row down. */
export const WAVE_X_MS = 22;
export const WAVE_Y_MS = 70;

/** Building, on first show only: rows rise 4 and fade in over 200 ms, bottom row first, 60 ms apart; blocks start 40 ms apart. */
export const BUILD_RISE = 4;
export const BUILD_MS = 200;
export const ROW_STEP_MS = 60;
export const BLOCK_STEP_MS = 40;

/** Arriving: the blocks fade out over 200 ms while the content fades in over 250. */
export const BLOCKS_OUT_MS = 200;
export const CONTENT_IN_MS = 250;

/** The frames (0 to 9) in which glyph `glyph` is drawn. */
export const framesOf = (glyph: number): number[] => FRAME_GLYPHS.flatMap((shown, frame) => (shown === glyph ? [frame] : []));

/** The cell's animation delay in ms (zero or negative), for a cell at page position (x, y). `now`: the page clock, in ms. */
export function waveDelay(x: number, y: number, now = 0): number {
  const wave = (x / CELL_W) * WAVE_X_MS + (y / CELL_H) * WAVE_Y_MS;
  const delay = -((((wave + now) % CYCLE_MS) + CYCLE_MS) % CYCLE_MS);
  return delay === 0 ? 0 : Math.round(delay * 100) / 100;
}

/** How many cells fill `width`. */
export const columnsOf = (width: number): number => Math.max(0, Math.floor(width / CELL_W));

/** A line is one row; a box is `rows`. */
export const rowsOf = (kind: "line" | "box", rows: number): number => (kind === "line" ? 1 : Math.max(1, Math.round(rows)));

/** When a row starts building, in ms: its block's turn (`order`, in reading order), then the bottom row first. */
export const buildDelay = (order: number, row: number, rows: number): number => order * BLOCK_STEP_MS + (rows - 1 - row) * ROW_STEP_MS;

/** The page's clock, folded into one cycle, so a block that mounts later joins the wave where it is. */
export function pageClock(): number {
  const now = typeof document !== "undefined" ? (document.timeline as { currentTime?: number | null } | undefined)?.currentTime : undefined;
  return typeof now === "number" && Number.isFinite(now) ? now % CYCLE_MS : 0;
}

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
export const TILE_ROWS = 3;
/** Tile boxes are 54 apart: three rows (36) and 18 between. */
export const TILE_PITCH = 54;
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
