// OpenBuilds: the elevation model (Synth draft).
//
// SHADES, NOT LINES. Depth is a step on the surface ladder, not a rule and not a shadow. Six levels:
//
//   page     the ground. The Page shade, no edge, no shadow.
//   panel    the columns. The Panel shade, no edge, no shadow.
//   card     content inside a panel, and a hovered or selected row. The Card shade.
//   raised   buttons, avatars, number boxes. The Raised shade, no edge, no shadow.
//   overlay  modals, menus, popovers, toasts, the publish sheet. Card in the dark, White in the light; a 1px edge and
//            `0 24px 64px` of shadow (`--window-shadow`, which carries both).
//   notepad  the notepad, always above an overlay. The Notepad shade, its own edge and `0 32px 80px`.
//
// WHAT AN OBJECT CARRIES. `elevation[level]` is the SHADOW (and the edge a shadow draws) and nothing else, so it can be
// spread after a surface's own background without painting over it; the FILL is `elevationFill[level]`, and `surface()` gives
// both for a surface that has no background of its own yet. Every value is a `var()` reference or a constant, so a surface
// written with one follows `<html data-theme>` with no re-render.
//
// THE EDGE IS A SHADOW RING, not a `border`, so an overlay adds nothing to its own size.
//
// DEFINED PER THEME, BECAUSE A SHADOW ON A LIGHT GROUND AND A SHADOW ON A DARK GROUND ARE NOT THE SAME OBJECT. The shadows
// that differ are tokens, `--elev-raised`, `--elev-overlay` and `--elev-notepad`, declared in both theme blocks and flipped
// by the same one attribute as every colour. `raised` is `none` in both: a button is raised by its shade.
//
// AN ELEVATION THAT CHANGES ON HOVER IS A PSEUDO-ELEMENT, NEVER AN ANIMATED
// BOX-SHADOW. `box-shadow` cannot be composited: animating it re-rasterises the
// element on every frame, which is what turns a grid of hovering cards into a
// dropped-frame scroll. Per `better-ui`, put the raised shadow on a `::after`
// that covers the card, give it `opacity: 0`, and animate the OPACITY — that
// runs on the compositor and costs nothing.
//
//   .card::after { content: ""; position: absolute; inset: 0;
//                  border-radius: inherit; pointer-events: none;
//                  box-shadow: var(--elev-raised); opacity: 0;
//                  transition: opacity 160ms ease; }
//   .card:hover::after { opacity: 1; }
//
// That is the ONE case where these levels belong in `index.css` rather than
// inline, because a pseudo-element cannot be expressed in a style object. A
// resting elevation is spread inline like everything else.
//
// NO LEVEL ADDS A BORDER. The overlay's and the notepad's edges are rings inside their shadows, so spreading a level onto a
// surface never changes its size.

import type { CSSProperties } from "react";

/** The shadows that are tokens: the ones that differ by theme, or that name another token. */
export const ELEVATION_TOKENS = ["elev-raised", "elev-overlay", "elev-notepad"] as const;

export type ElevationTokenName = (typeof ELEVATION_TOKENS)[number];

/** Noon: a button is raised by shade; the window casts the light-room shadow; the notepad is lighter on the light page. */
export const noonElevation: Record<ElevationTokenName, string> = {
  "elev-raised": "var(--control-shadow)",
  "elev-overlay": "var(--window-shadow)",
  "elev-notepad": "0 0 0 1px var(--notepad-edge), 0 32px 80px rgba(11,18,13,.22)",
};

/** Dusk: the same references, and the dark room's deeper notepad shadow. */
export const duskElevation: Record<ElevationTokenName, string> = {
  "elev-raised": "var(--control-shadow)",
  "elev-overlay": "var(--window-shadow)",
  "elev-notepad": "0 0 0 1px var(--notepad-edge), 0 32px 80px rgba(0,0,0,.65)",
};

export const elevationThemes = {
  noon: noonElevation,
  dusk: duskElevation,
} as const;

/** The six levels, shadow and edge only (see "What an object carries"). */
export const elevation = {
  /** The ground. */
  page: { boxShadow: "none" },
  /** The columns. No border, no shadow. */
  panel: { boxShadow: "none" },
  /** Content inside a panel; a hovered or selected row. */
  card: { boxShadow: "none" },
  /** Buttons, avatars, number boxes: raised by shade, so nothing is cast. */
  raised: { boxShadow: "var(--elev-raised)" },
  /**
   * Modals, menus, popovers, toasts, the publish sheet. The strongest level that is not the notepad, and the one that
   * comes with a scrim: see `SCRIM` below, which belongs to the page behind it and is not folded in here.
   */
  overlay: { boxShadow: "var(--elev-overlay)" },
  /** The notepad, always above an overlay. */
  notepad: { boxShadow: "var(--elev-notepad)" },
} as const satisfies Record<string, CSSProperties>;

export type ElevationLevel = keyof typeof elevation;

export const ELEVATION_LEVELS = Object.keys(elevation) as ElevationLevel[];

/** The fill each level paints, as the token that holds it. */
export const elevationFill = {
  page: "var(--frame)",
  panel: "var(--surface)",
  card: "var(--module)",
  raised: "var(--control)",
  overlay: "var(--window)",
  notepad: "var(--notepad)",
} as const satisfies Record<ElevationLevel, string>;

/** A level's fill and shadow together, for a surface with no background of its own. */
export function surface(level: ElevationLevel): CSSProperties {
  return { background: elevationFill[level], ...elevation[level] };
}

/**
 * The scrim that travels with `overlay`: applied to the layer BEHIND a dialog,
 * never to the dialog itself.
 *
 * Struck from `--porthole` — the darkest surface token in each theme — rather
 * than from black, so the page dims into its own room. It is the one part of
 * the overlay level that is not a shadow, which is why it is a separate export:
 * spreading `elevation.overlay` onto a backdrop by mistake would give the
 * backdrop a shadow and no dimming.
 */
export const SCRIM = {
  background: "color-mix(in srgb, var(--porthole) 62%, transparent)",
} as const satisfies CSSProperties;
