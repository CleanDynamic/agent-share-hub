// The refined look's control recipes (UI-P84), spent by the primitives.
//
// Each is a ready-made style object of tokens, from the recipes in the series rules: *control* (fill, 1px border, the
// shadow; hover steps the fill to `--control-on`, never an opacity), *pressed* (the control sinks to the well),
// *selected* (fill, 1px edge, ring: a colour never says which) and *well* (fields). Nothing here is a literal.

import type { CSSProperties } from "react";

import { t } from "./tokens";

export const CONTROL: CSSProperties = {
  background: t.control,
  border: `1px solid ${t.controlBorder}`,
  boxShadow: t.controlShadow,
};

export const CONTROL_HOVER: CSSProperties = { background: t.controlOn };

export const PRESSED: CSSProperties = {
  background: t.well,
  borderColor: t.wellBorder,
  boxShadow: t.wellShadow,
};

export const SELECTED: CSSProperties = {
  background: t.selectedFill,
  border: `1px solid ${t.selectedEdge}`,
  boxShadow: t.selectedRing,
};

export const WELL: CSSProperties = {
  background: t.well,
  border: `1px solid ${t.wellBorder}`,
  boxShadow: t.wellShadow,
};

export const PRIMARY: CSSProperties = {
  background: t.action,
  border: `1px solid ${t.action}`,
  boxShadow: t.actionShadow,
  color: t.onAction,
};

/** A control's paint for its state: rest, hover, then pressed over both. */
export function controlPaint(state: { hovered?: boolean; pressed?: boolean }): CSSProperties {
  return { ...CONTROL, ...(state.hovered ? CONTROL_HOVER : null), ...(state.pressed ? PRESSED : null) };
}

/** Button heights: 24 (drawn 28, a row's small button) or 32. A phone's 44 and 48 touch targets stay. Drawn 44 and
    over keeps 36 on desktop: only sign-in and the editor pass it, and neither is part of the control-heights pass. */
export function refinedButtonHeight(size: number, phone: boolean): number {
  if (phone && size >= 44) return size;
  if (size <= 28) return 24;
  if (size < 44) return 32;
  return 36;
}
