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
// Two rooms, two neutral ramps: `grey` is Noon's cool luminous gallery,
// `lavender` is Dusk's lavender stone. `birch` is the Birch Mist ramp the design
// kit gives Noon; only its ink is struck so far, because the focus ring is the
// one token that spends it. The accent hues are shared and change only their
// step between themes.

/* ── Neutrals ─────────────────────────────────────────────────────────────── */

/** Cool grey — Noon's room, and the ramp its greys come from. */
export const grey = {
  0: "#FFFFFF",
  25: "#F7F8F9",
  400: "#99A2AA",
  600: "#565E66",
  700: "#4E565E",
  950: "#1B2026",
} as const;

/** Noon's glass, struck from `grey.0`. `0/55` reads "grey.0 at 55%". */
export const greyAlpha = {
  /** BG-P09 — the card frame, one step darker than the thread box inside it. */
  "0/42": "rgba(255,255,255,.42)",
  "0/55": "rgba(255,255,255,.55)",
  "0/95": "rgba(255,255,255,.95)",
} as const;

/** Birch Mist — the design kit's Noon neutrals. `950` is its ink. */
export const birch = {
  25: "#F8F8F6",
  40: "#EEF0EC",
  50: "#E9EBE7",
  100: "#D7DBD5",
  130: "#C5CBC7",
  140: "#C5CAC3",
  600: "#505A55",
  950: "#1A2320",
} as const;

/** Noon's brick — the action, and the far end of the arc. */
export const brick = { 700: "#8C3B36" } as const;

/** Noon's pine — evidence, and its fill. */
export const pine = { 200: "#C8E3DC", 600: "#256659" } as const;

/** The three warm and cool steps of Noon's arc. */
export const sage = { 400: "#8FA79B" } as const;
export const salmon = { 300: "#E3A594" } as const;
export const blush = { 100: "#F1D5CB" } as const;

/**
 * Aubergine — the design kit's Dusk grounds, darkest to lightest by step. The
 * room is `900`; `975` is the part viewer's well and `960` is the ink that sits
 * on a lamp-lit fill.
 */
export const aubergine = {
  975: "#0C0A12",
  960: "#15121C",
  950: "#17131F",
  940: "#1B1725",
  900: "#1F1829",
  700: "#3A3350",
  400: "#8C78C4",
  300: "#A59EBA",
} as const;

/** Lavender stone — Dusk's room, and the ramp its greys come from. */
export const lavender = {
  50: "#EEEAF4",
  100: "#CBC6E4",
  200: "#B3ABC6",
  500: "#5C5480",
  700: "#372F4A",
  900: "#1F1B2B",
  950: "#141020",
} as const;

/** Dusk's glass: the surface is struck from #483F68 (once `lavender.650`), the light from `lavender.50`. */
export const lavenderAlpha = {
  "650/42": "rgba(72,63,104,.42)",
  /**
   * BG-P09 — Dusk's thread box. The lightest step in this table by a wide
   * margin, and deliberately so: on a dark ground a box is lifted off the card
   * around it by a breath of the room's own light, where the same step struck
   * from the stone would read as a second card.
   */
  "50/06": "rgba(238,234,244,.06)",
  "50/22": "rgba(238,234,244,.22)",
} as const;

/* ── Accents ──────────────────────────────────────────────────────────────── */

/**
 * Clay — the primary action in both themes, plus the warm ink that sits on it.
 * `clay.700` on Noon and `clay.400` on Dusk are the same hue at two
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

/** Teal — Noon's evidence, and its fill. `300` is the chip fill (BG-P05). */
export const teal = {
  300: "#C2D1D2",
  700: "#0E635C",
} as const;

/** Pale blue — Dusk's evidence. `900` is the chip fill (BG-P05). */
export const sky = {
  400: "#86BDD3",
  900: "#343B4D",
} as const;

/* ── The design kit's values that are not a single hex ───────────────────────
   Translucents, gradients, shadows and `none`. They have no ramp — a gradient
   is not a step on one — so each is named by the token that consumes it, and
   `semantics.ts` is the only file that reads them. The values are those of
   design/tokens/tokens.css, verbatim. */

export const noonKit = {
  "backdrop": "linear-gradient(180deg, #C2CFCF 0%, #D2DADA 24%, #E1E3DE 42%, #EDD3C8 51%, #F2BEA8 55%, #E6DED9 61%, #E0E5E2 74%, #E9EBE7 100%)",
  "ambient": "radial-gradient(60% 50% at 15% 15%, rgba(255,255,255,.8) 0%, rgba(255,255,255,0) 60%), radial-gradient(50% 45% at 85% 20%, rgba(241,213,203,.55) 0%, rgba(241,213,203,0) 65%)",
  "line": "rgba(26,35,32,.15)",
  "hairline": "rgba(26,35,32,.09)",
  "header": "rgba(249,250,248,.50)",
  "header-border": "rgba(255,255,255,.92)",
  "glass": "rgba(255,255,255,.68)",
  "glass-border": "rgba(255,255,255,.95)",
  "glass-2": "rgba(255,255,255,.58)",
  "cell": "rgba(255,255,255,.55)",
  "row-highlight": "rgba(255,255,255,.85)",
  "tab": "rgba(255,255,255,.82)",
  "field": "rgba(255,255,255,.72)",
  "media-tag": "rgba(248,248,246,.92)",
  "plate": "rgba(247,248,249,.72)",
  "scrim": "rgba(247,248,249,.35)",
  "dock": "rgba(255,255,255,.55)",
  "dock-border": "rgba(255,255,255,.95)",
  "dock-tile": "rgba(255,255,255,.85)",
  "ring-glow": "none",
  "orb-glass": "radial-gradient(ellipse 58% 34% at 50% 78%, #F8F8F6 0%, #F8F8F6 36%, #F0C8B8 52%, #E3A594 58%, rgba(143,167,155,.45) 68%, rgba(143,167,155,0) 80%), linear-gradient(180deg, #B4C4C3 0%, #CCD6D4 40%, #E9EBE7 58%, #CCD6D4 80%, #B4C4C3 100%)",
  "orb-glass-edge": "rgba(255,255,255,.95)",
  "orb-solid": "radial-gradient(circle at 32% 28%, #4B5752 0%, #2C3632 40%, #1A2320 75%, #0C1210 100%)",
  "shadow-float": "0 40px 90px rgba(26,35,32,.20)",
  "panel-highlight": "inset 0 1px 0 rgba(255,255,255,1)",
  "ring-track": "rgba(27,32,38,.10)",
  "lamp-glow": "none",
  "picture-lamp-glow": "none",
  "picture-lamp-wash": "rgba(255,255,255,.9)",
  "shadow-card": "0 14px 30px rgba(26,35,32,.11)",
  "nav-lamp-glow": "none",
  "rank-glow": "none",
  "banner-scrim": "rgba(247,248,249,.8)",
  "inset": "rgba(255,255,255,.7)",
  "secret-fill": "rgba(242,109,109,.2)",
  "sheet-dim": "rgba(10,8,14,.45)",
  "shadow-square": "0 14px 30px rgba(0,0,0,.35)",
  "shadow-dock": "inset 0 1px 0 rgba(255,255,255,.25), 0 18px 44px rgba(0,0,0,.3)",
  "shadow-sheet": "0 -20px 50px rgba(0,0,0,.35)",
  "signin-edge": "inset 0 0 0 1px rgba(255,255,255,.9), inset 0 0 120px rgba(203,198,228,.6), inset 0 -80px 160px rgba(239,196,168,.55)",
} as const;

export const duskKit = {
  "backdrop": "radial-gradient(60% 42% at 88% 0%, rgba(140,120,196,.42) 0%, rgba(140,120,196,0) 72%), radial-gradient(40% 26% at 80% 6%, rgba(217,140,107,.22) 0%, rgba(217,140,107,0) 70%), radial-gradient(55% 45% at 10% 100%, rgba(92,84,128,.28) 0%, rgba(92,84,128,0) 70%), linear-gradient(180deg, #241C33 0%, #1F1829 45%, #1A1523 100%)",
  "ambient": "radial-gradient(60% 50% at 12% 80%, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 65%)",
  "line": "rgba(238,234,244,.14)",
  "hairline": "rgba(238,234,244,.09)",
  "header": "rgba(13,10,20,.60)",
  "header-border": "rgba(238,234,244,.16)",
  "glass": "rgba(31,27,45,.66)",
  "glass-border": "rgba(238,234,244,.12)",
  "glass-2": "rgba(238,234,244,.06)",
  "cell": "rgba(14,11,20,.35)",
  "row-highlight": "rgba(238,234,244,.10)",
  "tab": "rgba(238,234,244,.10)",
  "field": "rgba(238,234,244,.07)",
  "media-tag": "rgba(14,11,20,.78)",
  "plate": "rgba(14,11,20,.62)",
  "scrim": "rgba(14,11,20,.55)",
  "dock": "rgba(30,24,44,.62)",
  "dock-border": "rgba(238,234,244,.20)",
  "dock-tile": "rgba(238,234,244,.08)",
  "evidence-fill": "rgba(134,189,211,.16)",
  "ring-glow": "0 0 40px rgba(217,164,65,.35)",
  "orb-glass": "radial-gradient(ellipse 58% 34% at 50% 78%, #0B0910 0%, #0B0910 38%, #7A3F2E 52%, #D98C6B 60%, rgba(140,120,196,.55) 70%, rgba(140,120,196,0) 82%), linear-gradient(180deg, #2E2C52 0%, #474670 40%, #8C8AA8 58%, #474670 80%, #2E2C52 100%)",
  "orb-glass-edge": "rgba(238,234,244,.45)",
  "orb-solid": "radial-gradient(circle at 32% 28%, #FFFFFF 0%, #ECEDF0 35%, #BFC3CA 72%, #8E949D 100%)",
  "shadow-float": "0 40px 100px rgba(4,3,8,.6)",
  "panel-highlight": "inset 0 1px 0 rgba(238,234,244,.10)",
  "ring-track": "rgba(238,234,244,.10)",
  "lamp-glow": "0 0 10px rgba(217,164,65,.6)",
  "picture-lamp-glow": "0 0 14px rgba(217,164,65,.65)",
  "picture-lamp-wash": "rgba(217,164,65,.22)",
  "shadow-card": "0 18px 40px rgba(4,3,8,.35)",
  "nav-lamp-glow": "0 0 12px rgba(217,164,65,.8)",
  "rank-glow": "0 0 20px rgba(217,164,65,.5)",
  "banner-scrim": "rgba(14,11,20,.75)",
  "inset": "rgba(14,11,20,.4)",
  "turn": "rgba(238,234,244,.05)",
  "secret-fill": "rgba(242,109,109,.2)",
  "sheet-dim": "rgba(10,8,14,.45)",
  "shadow-square": "0 14px 30px rgba(0,0,0,.35)",
  "shadow-dock": "inset 0 1px 0 rgba(255,255,255,.25), 0 18px 44px rgba(0,0,0,.3)",
  "shadow-sheet": "0 -20px 50px rgba(0,0,0,.35)",
  "signin-edge": "inset 0 0 0 1px rgba(203,198,228,.25), inset 0 0 26px rgba(203,198,228,.45), inset 0 0 120px rgba(217,140,107,.45), inset 0 -80px 180px rgba(140,120,196,.45)",
} as const;

/* ── Part-category hues ───────────────────────────────────────────────────── */
//
// Nine hues, one per part category. Each keeps its hue across both themes and
// changes only its value — the `700`/`600` step on Noon, the `400` step
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
// and then flattened: `50` is the Noon step over `#E4E6E8`, `900` the Dusk
// step over `#1F1B2B`. The alpha is the largest on a 0.01 ladder capped at 0.20
// at which the hue still clears 4.5:1 on the result — the hue never moves to
// make a fill legal, only the alpha does, and where a hue sits close to its
// floor on the ground (Noon's magenta, at 4.83:1) the alpha that survives
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
