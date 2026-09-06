// buildgallery.ai — colour primitives.
//
// TIER ONE OF TWO. A primitive names a *value*, not a job. Nothing in this file
// says what a colour is for, and nothing outside `semantics.ts` may import from
// it. That seam is the whole point: because no component names a hex, the theme
// flip is one attribute on <html data-theme="…"> rather than an audit of every
// usage.
//
//   primitives.ts  →  semantics.ts  →  index.css custom properties  →  tokens.ts
//   (values)          (jobs)            (per-theme blocks)             (accessor)
//
// Ramps are named by hue and stepped by lightness, low = light, high = dark, so
// a step number reads the same way across every ramp here. The steps are not a
// gradient to pick from by eye — every step below exists because a semantic
// token consumes it, and a step no token consumes is not added.
//
// NOTATION. Hex, matching the rest of this codebase, with translucent values as
// `rgba()` exactly as the buildgallery-theme skill writes them. No `oklch()`:
// a second representation added for four values would make the palette harder
// to reason about, not easier.
//
// Two rooms, two neutral ramps: `grey` is Exhibition's cool luminous gallery,
// `lavender` is Dusk's lavender stone. The accent hues are shared and change
// only their step between themes.

/* ── Neutrals ─────────────────────────────────────────────────────────────── */

/** Cool grey — Exhibition's room, and the ramp its greys come from. */
export const grey = {
  0: "#FFFFFF",
  25: "#F7F8F9",
  50: "#E4E6E8",
  100: "#D3D7DB",
  200: "#C6CBD1",
  400: "#99A2AA",
  600: "#565E66",
  700: "#4E565E",
  950: "#1B2026",
} as const;

/** Exhibition's glass, struck from `grey.0`. `0/55` reads "grey.0 at 55%". */
export const greyAlpha = {
  "0/34": "rgba(255,255,255,.34)",
  "0/55": "rgba(255,255,255,.55)",
  "0/80": "rgba(255,255,255,.80)",
  "0/95": "rgba(255,255,255,.95)",
} as const;

/** Lavender stone — Dusk's room, and the ramp its greys come from. */
export const lavender = {
  50: "#EEEAF4",
  100: "#CBC6E4",
  200: "#B3ABC6",
  500: "#5C5480",
  600: "#4B4362",
  650: "#483F68",
  700: "#372F4A",
  900: "#1F1B2B",
  950: "#141020",
} as const;

/** Dusk's glass: the surface is struck from `lavender.650`, the light from `lavender.50`. */
export const lavenderAlpha = {
  "650/26": "rgba(72,63,104,.26)",
  "650/42": "rgba(72,63,104,.42)",
  "50/14": "rgba(238,234,244,.14)",
  "50/22": "rgba(238,234,244,.22)",
} as const;

/* ── Accents ──────────────────────────────────────────────────────────────── */

/**
 * Clay — the primary action in both themes, plus the warm ink that sits on it.
 * `clay.700` on Exhibition and `clay.400` on Dusk are the same hue at two
 * values, which is the point: salmon is 2.12:1 on a light ground and may never
 * appear there.
 */
export const clay = {
  400: "#D98C6B",
  700: "#9E4B2C",
  950: "#241B1A",
} as const;

/** Amber — light, never type. One step, shared by both themes. */
export const amber = {
  500: "#D9A441",
} as const;

/** Teal — Exhibition's evidence, and its fill. `300` is the chip fill (BG-P05). */
export const teal = {
  200: "#BFE3DC",
  300: "#C2D1D2",
  600: "#0F6E63",
  700: "#0E635C",
} as const;

/** Pale blue — Dusk's evidence. `900` is the chip fill (BG-P05). */
export const sky = {
  400: "#86BDD3",
  900: "#343B4D",
} as const;

/** Dusk's evidence fill, struck from `sky.400`. */
export const skyAlpha = {
  "400/16": "rgba(134,189,211,.16)",
} as const;

/* ── Part-category hues ───────────────────────────────────────────────────── */
//
// Nine hues, one per part category. Each keeps its hue across both themes and
// changes only its value — the `700`/`600` step on Exhibition, the `400` step
// on Dusk. `teal`/`sky` above carry the evidence category as well as the
// evidence role, which is why they are not repeated here.
//
// `rust.700` (#9C3E12, the instruction category) and `clay.700` (#9E4B2C, the
// primary action) are close but deliberately distinct: one encodes a part
// category, the other encodes interactivity, and better-colors is explicit that
// one colour carries one meaning.
//
// THE `50` AND `900` STEPS ARE CHIP FILLS, AND THEY ARE MEASURED (BG-P05). Each
// is its own ramp's category hue laid over the theme's ground at a low alpha
// and then flattened: `50` is the Exhibition step over `#E4E6E8`, `900` the Dusk
// step over `#1F1B2B`. The alpha is the largest on a 0.01 ladder capped at 0.20
// at which the hue still clears 4.5:1 on the result — the hue never moves to
// make a fill legal, only the alpha does, and where a hue sits close to its
// floor on the ground (Exhibition's magenta, at 4.83:1) the alpha that survives
// is small and the fill is nearly the ground. The composite is stored rather
// than the alpha so the pairing measures the same on glass as it does on the
// ground; `src/lib/theme/category.test.ts` recomputes every one of them.

/** instruction */
export const rust = { 50: "#DBD2CE", 400: "#F0865A", 700: "#9C3E12", 900: "#493034" } as const;
/** configuration */
export const green = { 50: "#CDD8D4", 400: "#5CCB7C", 700: "#0F6B31", 900: "#2B3E3B" } as const;
/** data */
export const blue = { 50: "#CCD4E6", 400: "#6AA1FF", 700: "#1D4ED8", 900: "#2E3655" } as const;
/** artefact */
export const ochre = { 50: "#D7CEC7", 400: "#F5B83D", 700: "#8F4309", 900: "#4A3A2F" } as const;
/** narrative */
export const stone = { 50: "#D0D3D5", 400: "#A8A6A3", 600: "#565B63", 900: "#3A3743" } as const;
/** agents */
export const violet = { 50: "#D2CAE6", 400: "#A78BFA", 700: "#6D28D9", 900: "#372F50" } as const;
/** breakage / gap */
export const red = { 50: "#E1D6D8", 400: "#F26D6D", 700: "#B91C1C", 900: "#412836" } as const;
/** media */
export const magenta = { 50: "#E2DEE2", 400: "#F472B6", 700: "#BE185D", 900: "#4A2C47" } as const;
