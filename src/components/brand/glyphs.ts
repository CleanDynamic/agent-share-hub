// The refined glyph table (UI-P82): each glyph's name and its SVG path data on a 16 by 16 grid.
//
// The paths are the refined boards' own and are held to the UI-P82 table character for character. Sixteen are the row
// "Glyphs · 16 px · square caps" on foundations.html; `chevd`, `more`, `up`, `globe` and `mail` are drawn inside the
// page boards that use them; `chevl`, `expand` and `grid` are drawn on no board, so the table is their only source.
// `Glyph.tsx` paints them, at stroke 1.3 with square caps (2 for `more`).
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
} as const;

export type GlyphName = keyof typeof GLYPHS;

/** Every glyph name, in the table's order. */
export const GLYPH_NAMES = Object.keys(GLYPHS) as GlyphName[];
