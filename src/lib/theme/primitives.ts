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

/** Teal — Exhibition's evidence, and its fill. */
export const teal = {
  200: "#BFE3DC",
  600: "#0F6E63",
  700: "#0E635C",
} as const;

/** Pale blue — Dusk's evidence. */
export const sky = {
  400: "#86BDD3",
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

/** instruction */
export const rust = { 400: "#F0865A", 700: "#9C3E12" } as const;
/** configuration */
export const green = { 400: "#5CCB7C", 700: "#0F6B31" } as const;
/** data */
export const blue = { 400: "#6AA1FF", 700: "#1D4ED8" } as const;
/** artefact */
export const ochre = { 400: "#F5B83D", 700: "#8F4309" } as const;
/** narrative */
export const stone = { 400: "#A8A6A3", 600: "#565B63" } as const;
/** agents */
export const violet = { 400: "#A78BFA", 700: "#6D28D9" } as const;
/** breakage / gap */
export const red = { 400: "#F26D6D", 700: "#B91C1C" } as const;
/** media */
export const magenta = { 400: "#F472B6", 700: "#BE185D" } as const;
