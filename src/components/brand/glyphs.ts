// The refined glyph table (UI-P82): each glyph's name and its SVG path data on a 16 by 16 grid.
//
// The paths are the refined boards' own and are held to the UI-P82 table character for character. Sixteen are the row
// "Glyphs · 16 px · square caps" on foundations.html; `chevd`, `more`, `up`, `globe` and `mail` are drawn inside the
// page boards that use them; `chevl`, `expand` and `grid` are drawn on no board, so the table is their only source.
// `Glyph.tsx` paints them, at stroke 1.3 with square caps (2 for the dots-only `more` and `grip`).
//
// Kept apart from the component so the table can be read by a test and by the dev catalogue without making the
// component file export anything but a component.

export const GLYPHS = {
  chev: "M6.5 4 10.5 8l-4 4",
  chevd: "M4 6.5 8 10.5l4-4",
  chevl: "M9.5 4 5.5 8l4 4",
  search: "M10.25 10.25 13.5 13.5M11.25 7a4.25 4.25 0 1 1-8.5 0 4.25 4.25 0 0 1 8.5 0z",
  bell: "M4.5 11V7.5a3.5 3.5 0 0 1 7 0V11l1 1.25h-9zM6.75 14.25h2.5",
  moon: "M12.75 9.75A5.25 5.25 0 0 1 6.25 3.25a5.25 5.25 0 1 0 6.5 6.5z",
  sun: "M8 5.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5zM8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1",
  plus: "M8 3.5v9M3.5 8h9",
  x: "M4.5 4.5l7 7M11.5 4.5l-7 7",
  pencil: "M10.5 3.5l2 2L6 12H4v-2z",
  file: "M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12",
  layers: "M8 2.5 13.5 5.5 8 8.5 2.5 5.5zM2.5 8.5 8 11.5l5.5-3M2.5 11.25 8 14.25l5.5-3",
  panel: "M2.5 3h11v10h-11zM6 3v10M8.5 6.5 10 8l-1.5 1.5",
  larr: "M13 8H3.5M7 4.5 3.5 8 7 11.5",
  rarr: "M3 8h9.5M9 4.5 12.5 8 9 11.5",
  check: "M3.5 8.5 6.5 11.5 12.5 4.5",
  more: "M3.5 8h.01M8 8h.01M12.5 8h.01",
  up: "M8 13V3.5M4.5 7 8 3.5 11.5 7",
  image: "M2.5 3.5h11v9h-11zM2.5 10.5l3-3 3 3 2-2 3 3M10.5 6h.01",
  play: "M5 3.5v9l7-4.5z",
  expand: "M9.5 2.5h4v4M13.5 2.5l-5 5M6.5 13.5h-4v-4M2.5 13.5l5-5",
  grid: "M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z",
  globe:
    "M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0zM2.5 8h11M8 2.5c1.5 1.5 2.3 3.4 2.3 5.5S9.5 12 8 13.5M8 2.5C6.5 4 5.7 5.9 5.7 8s.8 4 2.3 5.5",
  mail: "M2.5 4h11v8h-11zM2.5 4.5 8 9l5.5-4.5",
  heart: "M8 13s-5-3-5-6.5A2.75 2.75 0 0 1 8 5a2.75 2.75 0 0 1 5 1.5C13 10 8 13 8 13z",
  comment: "M2.75 3.75h10.5v7H7l-3 2.5v-2.5H2.75z",
  save: "M4.5 2.75h7v10.5L8 10.75l-3.5 2.5z",
  share: "M8 2.5v8M5 5.5l3-3 3 3M3.5 9.5v4h9v-4",
  rebuild: "M12.75 3v3h-3M3.25 13v-3h3M12.4 6A4.75 4.75 0 0 0 3.6 5.25M3.6 10a4.75 4.75 0 0 0 8.8.75",
  listBullet: "M6.5 4.5h7M6.5 8h7M6.5 11.5h7M3 4.25h.5v.5H3zM3 7.75h.5v.5H3zM3 11.25h.5v.5H3z",
  listNumber: "M6.5 4.5h7M6.5 8h7M6.5 11.5h7M2.75 3.25v2.5M2.25 7h1.5l-1.5 2h1.5M2.25 10.75h1.5l-.75 1 .75 1h-1.5",
  italic: "M9.5 3.5h-3M9.5 12.5h-3M9 3.5l-2 9",
  link: "M7 9a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 9 3.5l-.75.75M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.75-.75",
  grip: "M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01",
  /** CA-06 P2: "Link to a tile or session", drawn in its neighbours' style. */
  at: "M10.25 8a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0zM10.25 5.75v3a1.5 1.5 0 0 0 3 0V8A5.25 5.25 0 1 0 11 12.3",
  /** CA-07: crop, drawn in its neighbours' style. */
  crop: "M4.5 1.5v10h10M1.5 4.5h10v10",
  /** CA-07: flag, drawn in its neighbours' style. */
  flag: "M3.5 14V2.5M3.5 3h8l-1.5 3 1.5 3h-8",
  /** CA-07: zoomIn, drawn in its neighbours' style. */
  zoomIn: "M10.25 10.25 13.5 13.5M11.25 7a4.25 4.25 0 1 1-8.5 0 4.25 4.25 0 0 1 8.5 0zM7 5v4M5 7h4",
  /** CA-07: zoomOut, drawn in its neighbours' style. */
  zoomOut: "M10.25 10.25 13.5 13.5M11.25 7a4.25 4.25 0 1 1-8.5 0 4.25 4.25 0 0 1 8.5 0zM5 7h4",
  /** CA-07: shapeWide, drawn in its neighbours' style. */
  shapeWide: "M1.5 4.5h13v7h-13z",
  /** CA-07: shapeSquare, drawn in its neighbours' style. */
  shapeSquare: "M3.5 3.5h9v9h-9z",
  /** CA-07: step, drawn in its neighbours' style. */
  step: "M2.5 2.5h11v11h-11zM7 6l1.25-1v6",
  /** CA-17: fit to screen, four corners, drawn in its neighbours' style. */
  fit: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10",
  /** CA-19: Undo and Redo, drawn in their neighbours' style. */
  undo: "M5.5 4 3 6.5 5.5 9M3 6.5h6.25a3.5 3.5 0 0 1 0 7H7",
  redo: "M10.5 4 13 6.5 10.5 9M13 6.5H6.75a3.5 3.5 0 0 0 0 7H9",
} as const;

export type GlyphName = keyof typeof GLYPHS;

/** Every glyph name, in the table's order. */
export const GLYPH_NAMES = Object.keys(GLYPHS) as GlyphName[];
