// MS-02: the map sandbox's geometry. PURE.
//
// Turns a `MapLayout` and the tiles' measured sizes into pixel rectangles. Nothing is drawn here. Heights come from the tiles
// as drawn, so they are passed in (`Measure`) and this module stays pure: MS-05 supplies a `Measure` that reads the List's
// tile as rendered, tests supply fixed sizes.
//
// Only types come from `mapLayout.ts`, which imports `MAP_WIDTH` from here, so the two never import each other at run time.

/** The canvas grid (README Decision 7). These measures live here and nowhere else. */
export const MAP_GRID = { columns: 12, rhythm: 8, gutter: 24, padding: 20, snap: 6, minBoxColumns: 2, minBoxPx: 160 } as const;
/** Canvas widths in px (README Decision 7). */
export const MAP_WIDTH = { narrow: 720, standard: 960, wide: 1200, min: 640, max: 1600 } as const;
