/* UI-P16 — how a page view sizes itself against the reference board.

   The desktop boards are 1066px tall under the browser strip: 64 header + 8 +
   40 breadcrumb + 820 + 46 + 88 footer. The 820 is the page's grid. In `board`
   fit (the dev compare page) the grid is exactly that tall, so panels that fill
   in the reference get the reference's height. In `content` fit (every live
   route, and the default) the same panels take it as a minimum and grow with
   their content, so a feed or a wall that pages is never clipped. */

import type { CSSProperties } from "react";

export type PageFit = "board" | "content";

/** The page grid's height on every desktop board. */
export const BOARD_GRID_HEIGHT = 820;

/** `height` in `board` fit, `min-height` in `content` fit. Spread onto the page's grid (or any panel that fills). */
export function boardHeight(fit: PageFit = "content", height: number = BOARD_GRID_HEIGHT): CSSProperties {
  return fit === "board" ? { height } : { minHeight: height };
}
