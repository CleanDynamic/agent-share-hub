// shade: the one fixed dark shade the picture controls sit on (CA-07).
//
// THE ONE EXCEPTION TO "EVERY COLOUR THROUGH A TOKEN". The Edit pill, the × on a picture, the badges and the full
// screen viewer's controls sit on top of a maker's picture, which can be any colour, in either theme; a theme's token
// would be light on Noon and vanish on a light picture. So they sit on this shade with white ink, the same in both
// themes, as X draws them. lookRules.test.ts allows these values here and nowhere else.

/** The fill under every control drawn on a picture. */
export const PICTURE_SHADE = "rgba(15,15,16,0.72)";
/** The ink on PICTURE_SHADE, and the play mark's ring. */
export const PICTURE_INK = "#FFFFFF";
/** Behind the full screen viewer. */
export const VIEWER_SCRIM = "rgba(0,0,0,0.92)";
/** The track of an upload's bar along the bottom of a tile. */
export const PROGRESS_TRACK = "rgba(255,255,255,0.18)";
/** Crop's thirds, drawn over the picture. */
export const THIRDS_LINE = "rgba(255,255,255,0.35)";
