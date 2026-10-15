/* UI-P93 — the composer's refined styles, shared by its forks (`RefinedSandboxView`, `RefinedSourcesPanel`,
   `RefinedBuildList`, `RefinedDetailsPanel`).

   Recipes from the series rules: the module (a prompt, an agent, the result, Details), the tile (an agent's
   instructions, a reference chip), the well (a field, the prompt's text), the selected recipe (an edge and a ring,
   never a colour) and the window (a menu). The components that spend them are in `refinedPieces.tsx`. Nothing here
   is a literal colour: every paint is a token. */

import type { CSSProperties } from "react";

import { SELECTED, WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/* ── type ── */

export const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "normal",
  color,
  ...extra,
});

export const tnum: CSSProperties = { fontVariantNumeric: "tabular-nums" };

export const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

/** The indent that lines text up under a step's title: the 24 tile and its 12 gap. */
export const INDENT = 36;

export const bareButton: CSSProperties = {
  appearance: "none",
  background: "none",
  border: 0,
  margin: 0,
  padding: 0,
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  textAlign: "left",
};

/* ── recipes ── */

/** A module, the selected recipe over it when it is the selection. */
export const moduleStyle = (selected = false, padding: number | string = 16): CSSProperties => ({
  background: t.module,
  border: `1px solid ${t.moduleBorder}`,
  borderRadius: 8,
  boxShadow: t.moduleShadow,
  padding,
  boxSizing: "border-box",
  minWidth: 0,
  ...(selected ? SELECTED : null),
});

export const tileStyle: CSSProperties = {
  background: t.tile,
  border: `1px solid ${t.tileBorder}`,
  borderRadius: 6,
  boxSizing: "border-box",
  minWidth: 0,
};

/** The well recipe for a field. The global field rule already paints `--recess`, which is `--well` under refined. */
export const wellField: CSSProperties = {
  ...WELL,
  borderRadius: 6,
  boxSizing: "border-box",
  width: "100%",
  /* No inline `outline`: the global field rule is `outline: none` at rest and rings the field on :focus-visible, and an
     inline `none` would delete that ring (UI-P97). */
  ...text(13.5, 400, t.text),
};

/** A reference: 22 high, the tile's fill, radius 4, 11.5. */
export const chipStyle: CSSProperties = {
  ...tileStyle,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 22,
  padding: "0 8px",
  borderRadius: 4,
  ...text(11.5, 400, t.text),
  whiteSpace: "nowrap",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/** A tag: 20 high, radius 4, `--tag-fill`, 11.5 `--text2`. */
export const tagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 20,
  padding: "0 6px",
  boxSizing: "border-box",
  borderRadius: 4,
  background: t.tagFill,
  ...text(11.5, 400, t.text2),
  whiteSpace: "nowrap",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/** A menu: the window recipe, radius 8, no blur. */
export const menuSurface = (width?: number): CSSProperties => ({
  zIndex: 50,
  ...(width ? { width, maxWidth: "calc(100vw - 32px)" } : { minWidth: 180 }),
  padding: 4,
  borderRadius: 8,
  background: t.window,
  border: `1px solid ${t.windowBorder}`,
  boxShadow: t.windowShadow,
  color: t.text,
});

export const menuItem = (enabled: boolean, phone: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  minHeight: phone ? 44 : 32,
  padding: "0 10px",
  borderRadius: 6,
  ...text(13, 400, t.text),
  cursor: enabled ? "pointer" : "default",
  filter: enabled ? undefined : t.dimFilter,
  outline: "none",
});

