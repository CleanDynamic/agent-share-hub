// buildgallery.ai — the elevation model.
//
// The chrome rim is gone with the rest of the shape language, so depth needs a
// definition. Three levels, and only three:
//
//   flat     a --line hairline and no shadow.   The DEFAULT for cards.
//   raised   menus, popovers, the publish sheet.
//   overlay  dialogs, plus a scrim over the page behind them.
//
// A fourth level is not added. Three is the number of distances a reader can
// tell apart without measuring, and a system with five is a system where two of
// them are decoration.
//
// DEFINED PER THEME, BECAUSE A SHADOW ON A LIGHT GROUND AND A SHADOW ON A DARK
// GROUND ARE NOT THE SAME OBJECT. On Exhibition, depth is a true shadow: the
// luminous grey room has a light source, and a surface above the page casts.
// On Dusk, a shadow alone does not read — black on lavender stone at dusk is
// barely a change — so each level pairs a deeper shadow with an inset `--glass-hi`
// top hairline, which is the lit edge of the surface catching the horizon. That
// hairline is what says "above", and the shadow only says "how far"
// (`dark-mode-design`).
//
// So the shadows themselves are tokens — `--elev-raised`, `--elev-overlay` —
// declared in both theme blocks and flipped by the same one attribute as every
// colour. `flat` needs no token: it is the absence of a shadow plus a hairline
// in `--line`, which already flips.
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
// WHY LONGHANDS AND NOT `border`. `flat` returns `borderWidth`/`borderStyle`/
// `borderColor` rather than a `border` shorthand, because a shorthand whose
// colour is a `var()` is valid CSS that jsdom's cssstyle drops whole — so a unit
// test rendering a flat card would see no border at all rather than a border
// whose colour it cannot read.
//
// A HAIRLINE IS STRUCTURAL. `flat` adds 1px to each side of an element that had
// no border. Spreading it onto a surface that already has a border is a repaint;
// spreading it onto one that does not is a layout change, and `neoscale-ui`
// forbids that on an existing element. Check before you spread.

import type { CSSProperties } from "react";

/** The two shadows that differ by theme, and therefore have to be tokens. */
export const ELEVATION_TOKENS = ["elev-raised", "elev-overlay"] as const;

export type ElevationTokenName = (typeof ELEVATION_TOKENS)[number];

/**
 * Exhibition — a true shadow. Two layers each: a tight contact shadow that
 * anchors the surface to the page, and a wider ambient one that gives it its
 * height. Struck from `--text` (#1B2026) rather than from black, so the shadow
 * belongs to the cool grey room rather than sitting on top of it.
 */
export const exhibitionElevation: Record<ElevationTokenName, string> = {
  "elev-raised": "0 1px 2px rgba(27,32,38,.08), 0 6px 16px rgba(27,32,38,.10)",
  "elev-overlay": "0 2px 6px rgba(27,32,38,.12), 0 24px 56px rgba(27,32,38,.20)",
};

/**
 * Dusk — a lit top edge and a deeper shadow.
 *
 * The `inset 0 1px 0 var(--glass-hi)` is doing the work a shadow cannot do on a
 * dark ground: it is the surface's own edge catching the violet-to-salmon
 * horizon, and it is what reads as "above". The shadows are darker and wider
 * than Exhibition's because they have to travel further to register at all.
 */
export const duskElevation: Record<ElevationTokenName, string> = {
  "elev-raised": "inset 0 1px 0 var(--glass-hi), 0 2px 4px rgba(0,0,0,.36), 0 10px 24px rgba(0,0,0,.44)",
  "elev-overlay": "inset 0 1px 0 var(--glass-hi), 0 4px 10px rgba(0,0,0,.48), 0 32px 72px rgba(0,0,0,.62)",
};

export const elevationThemes = {
  exhibition: exhibitionElevation,
  dusk: duskElevation,
} as const;

/**
 * The three levels, as full style objects.
 *
 * Every value is a `var()` reference or a constant, so a surface written with
 * one follows `<html data-theme>` with no re-render — the same contract as
 * `tokens.ts`.
 */
export const elevation = {
  /**
   * The default for cards. A hairline, no shadow. A gallery of cards each
   * casting a shadow is a gallery of stickers; the hairline is enough to
   * separate a card from the ground when the ground is doing the lighting.
   */
  flat: {
    boxShadow: "none",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--line)",
  },
  /** Menus, popovers, the publish sheet. Above the page, still part of it. */
  raised: {
    boxShadow: "var(--elev-raised)",
  },
  /**
   * Dialogs. The strongest level, and the only one that comes with a scrim —
   * see `SCRIM` below, which is a property of the page behind the dialog and
   * not of the dialog, so it is not folded in here.
   */
  overlay: {
    boxShadow: "var(--elev-overlay)",
  },
} as const satisfies Record<string, CSSProperties>;

export type ElevationLevel = keyof typeof elevation;

export const ELEVATION_LEVELS = Object.keys(elevation) as ElevationLevel[];

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
