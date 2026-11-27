/* The shell's fixed bars, measured once, so a menu or a scroll that must stay clear of them reads these instead of typing
   the numbers again. Synth draft: the desktop header is 88 tall and sits on the page shade with no line and no fill; the
   phone top bar is 52. The phone's dock is its 44 tiles inside 6 of padding above and below, plus the safe-area inset,
   which CSS adds where it is used. */

/** The desktop site header's height. */
export const HEADER_HEIGHT = 88;

/** The desktop header's height once the page has scrolled (and from the start under reduced motion). */
export const HEADER_COMPACT_HEIGHT = 56;

/** The beaver logo's width at the top of a page, and once the header has shrunk. It scales with `transform` between them. */
export const LOGO_WIDTH = 96;
export const LOGO_COMPACT_WIDTH = HEADER_COMPACT_HEIGHT;

/** The phone top bar's height (prompt 19: 52, under the top safe-area inset), and the old header's beaver width. */
export const PHONE_HEADER_HEIGHT = 44;
export const PHONE_LOGO_WIDTH = 40;

/** The footer's beaver, the sign-in dialog's, and the one above a standalone card. */
export const FOOTER_LOGO_WIDTH = 48;
export const DIALOG_LOGO_WIDTH = 104;
/** The beaver above the phone's sign-in card (mobile prompt 27 Part B). */
export const PHONE_SIGNIN_LOGO_WIDTH = 168;
export const CARD_LOGO_WIDTH = 96;

/** The editor bar (the build editor, Start a build, Rebuild): a `1fr auto 1fr` grid, 88 tall, with a 44px round back button. */
export const EDITOR_BAR_HEIGHT = 88;
export const EDITOR_BACK_SIZE = 44;

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

/* The phone version's measurements (Synth mobile pack, prompt 17). The dock's and the sheets' safe-area inset is added in CSS. */
export const PHONE_TOPBAR = 44;
export const PHONE_TAB = 44;
/** A row of pills under the bar: 32 pills with 10 above and below. */
export const PHONE_PILL_ROW = 52;
export const PHONE_PILL = 32;
export const PHONE_ROW = 56;
/** The dock without the safe-area inset (29b): 49, with its structural line on top. */
export const PHONE_DOCK = 49;
export const PHONE_FAB = 56;
/** The round create button's shadow (29d). */
export const PHONE_FAB_SHADOW = "0 6px 18px rgba(0,0,0,.45)";
/** A press held this long on the round create button opens a new build (29d). */
export const PHONE_FAB_HOLD_MS = 500;
export const PHONE_SHEET_RADIUS = 16;
export const PHONE_MARGIN = 16;

/** The one place the phone frame's page padding is written (29b): the fixed bar under the top inset above, the fixed dock and
    its inset below. Tabs and pill rows sit in the page and stick under the bar, so they are not in this top figure. */
export const PHONE_PAGE_TOP = `calc(${PHONE_TOPBAR}px + env(safe-area-inset-top))`;
export const PHONE_PAGE_BOTTOM = `calc(${PHONE_DOCK}px + env(safe-area-inset-bottom))`;
