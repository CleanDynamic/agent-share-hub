// The refined look's control recipes (UI-P84), spent by the primitives.
//
// Each is a ready-made style object of tokens, from the recipes in the series rules: *control* (fill, 1px border, the
// shadow; hover steps the fill to `--control-on`, never an opacity), *pressed* (the control sinks to the well),
// *selected* (fill, 1px edge, ring: a colour never says which) and *well* (fields). Nothing here is a literal.

import type { CSSProperties } from "react";

import { t } from "./tokens";

/* Synth 06: Raised fill, no border, no shadow. */
export const CONTROL: CSSProperties = {
  background: t.control,
  border: "1px solid transparent",
  boxShadow: "none",
};

/**
 * The surface ladder's one hover: the resting fill moved four grey levels toward the text (1.9% of --text: #FFFFFF to
 * #FBFBFB in Noon, #28282C to #2C2C30 in Dusk). A row that rests transparent takes the same step laid over whatever it
 * sits on. Every hovered row, menu item and control spends this; nothing hovers to --control-on, which is --control.
 */
export const hoverFill = (resting?: string): string =>
  `color-mix(in srgb, ${t.text} 1.9%, ${!resting || resting === "transparent" || resting === "none" ? "transparent" : resting})`;

export const CONTROL_HOVER: CSSProperties = { background: hoverFill(t.control) };

export const PRESSED: CSSProperties = {
  background: t.well,
  borderColor: t.wellBorder,
  boxShadow: t.wellShadow,
};

/* The surface ladder: state is not elevation. Selected is the selected border alone, laid over the element's own fill
   (on a card, the card's fill), so a selected item and its neighbours share one fill. No ring, no shadow. */
export const SELECTED: CSSProperties = {
  border: `1px solid ${t.selectedEdge}`,
};

/* Synth 09: a chosen tile in the editor. A 2px Mint ring outside a 2px gap in the panel's own fill, as a shadow so the
   tile's border stays free for the maker's colour (a colour never replaces it). */
export const SELECT_RING = `0 0 0 2px ${t.surface}, 0 0 0 4px ${t.brandAccent}`;

/* Synth 06: a field. Panel fill and an inset 1px `--field-edge`; no border. */
export const WELL: CSSProperties = {
  background: t.surface,
  border: "1px solid transparent",
  boxShadow: `inset 0 0 0 1px ${t.fieldEdge}`,
};

/* Synth 06: the Main button. Mint fill, On-mint text, no border, no highlight, no shadow. */
export const PRIMARY: CSSProperties = {
  background: t.brandAccent,
  border: "1px solid transparent",
  boxShadow: "none",
  color: t.onBrandAccent,
};

/** A control's paint for its state: rest, hover, then pressed over both. */
export function controlPaint(state: { hovered?: boolean; pressed?: boolean }): CSSProperties {
  return { ...CONTROL, ...(state.hovered ? CONTROL_HOVER : null), ...(state.pressed ? PRESSED : null) };
}

/** Button heights: 32 (small: a row, a card or a modal), 36 (the standard) or 44 (large, a page-level call). A drawn size
    of 34 or less renders small, 36 to 42 standard, 44 and over large. */
export function refinedButtonHeight(size: number, _phone: boolean): number {
  if (size <= 34) return 32;
  if (size < 44) return 36;
  return 44;
}
