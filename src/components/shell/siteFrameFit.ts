/* UI-P16 — how a page view sizes itself against the reference board.

   The desktop boards are 1066px tall under the browser strip. Since the UI-P55
   density pass that is 52 header + its 1px edge + 6 + 33 breadcrumb + 820, and
   the footer (88 and its 1px edge) pinned to the board's bottom; the pass
   shrank the chrome and kept the board, so the grid now stands 65 above the
   footer where it stood 44 (before: 64 + 1 + 8 + 40 + 820 + 44 + 89). The 820
   is the page's grid. In `board` fit (the dev compare page) the grid is exactly
   that tall, so panels that fill in the reference get the reference's height.
   In `content` fit (every live route, and the default) the same panels take it
   as a minimum and grow with their content, so a feed or a wall that pages is
   never clipped. */

import type { CSSProperties } from "react";

export type PageFit = "board" | "content";

/** The page grid's height on every desktop board. */
export const BOARD_GRID_HEIGHT = 820;

/** A desktop board under the browser strip, top edge to bottom edge. */
export const BOARD_FRAME_HEIGHT = 1066;

/**
 * The column's bottom padding in `board` fit: what is left of the board under
 * the grid once the frame's own boxes are placed (UI-P55) — 1066 less the
 * header's 53, the column's 6, the breadcrumb's 33, the grid's 820 and the
 * footer's 88 — so the footer ends where the board's does. (The board's footer
 * is 89 with its edge and the app's 88 with it, so this is 66 where the board
 * leaves 65.) A live page (`content` fit) leaves the table's 33 instead.
 */
export const BOARD_FOOTER_GAP = BOARD_FRAME_HEIGHT - 53 - 6 - 33 - BOARD_GRID_HEIGHT - 88;

/** `height` in `board` fit, `min-height` in `content` fit. Spread onto the page's grid (or any panel that fills). */
export function boardHeight(fit: PageFit = "content", height: number = BOARD_GRID_HEIGHT): CSSProperties {
  return fit === "board" ? { height } : { minHeight: height };
}
