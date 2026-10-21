/* CA-10: the shell's fixed bars, measured once, so a menu or a scroll that must stay clear of them reads these
   instead of typing the numbers again. The header is 48 on every viewport (SiteFrame's header slot, SiteHeader,
   MobileHeader); the phone's dock is its 44 tiles inside 6 of padding above and below and a 1px top edge, plus the
   safe-area inset, which CSS adds where it is used. */

/** The site header's height, desktop and phone. */
export const HEADER_HEIGHT = 48;

/** A dock tile's height (the touch floor). */
export const DOCK_TILE_HEIGHT = 44;
/** The dock's padding above and below its tiles. */
export const DOCK_PAD = 6;
/** The phone dock's height without the safe-area inset: 6 + 44 + 6 and its 1px edge. */
export const DOCK_HEIGHT = DOCK_PAD * 2 + DOCK_TILE_HEIGHT + 1;
