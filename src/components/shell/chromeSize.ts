/* The shell's fixed bars, measured once, so a menu or a scroll that must stay clear of them reads these instead of typing
   the numbers again. Synth draft: the desktop header is 88 tall and sits on the page shade with no line and no fill; the
   phone header is 48. The phone's dock is its 44 tiles inside 6 of padding above and below, plus the safe-area inset,
   which CSS adds where it is used. */

/** The desktop site header's height. */
export const HEADER_HEIGHT = 88;

/** The phone header's height. */
export const PHONE_HEADER_HEIGHT = 48;

/** The header's height on the viewport the caller is on. */
export const headerHeight = (phone: boolean): number => (phone ? PHONE_HEADER_HEIGHT : HEADER_HEIGHT);

/** The page container's width: it centres at this width and the extra window width is the page shade. */
export const FRAME_MAX_WIDTH = 1280;

/** The gutter between panels, and the margin between the panels and the window edge. */
export const PANEL_GUTTER = 8;

/** A panel's inner padding. */
export const PANEL_PAD = 16;

/** The band at the top of a single-column panel that the breadcrumb sits in (desktop). */
export const CRUMB_BAND = 24;

/** A panel's radius. */
export const PANEL_RADIUS = 12;

/** A dock tile's height (the touch floor). */
export const DOCK_TILE_HEIGHT = 44;
/** The dock's padding above and below its tiles. */
export const DOCK_PAD = 6;
/** The phone dock's height without the safe-area inset: 6 + 44 + 6. It has no edge: it is a shade. */
export const DOCK_HEIGHT = DOCK_PAD * 2 + DOCK_TILE_HEIGHT;
