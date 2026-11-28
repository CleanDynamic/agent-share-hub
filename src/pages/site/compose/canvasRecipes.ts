// MS-05: the map canvas's measures and paint. Like the other recipe modules (`mapRecipes.ts`, `tileRecipes.tsx`) this is
// the one place these numbers live.
//
// THE CANVAS IS PAINT, NOT THEME. Its background is the maker's choice and stays the same in either theme, so the ink on it
// can't follow the app's theme: grey paint in the light theme would get dark text. `canvasScope` re-declares every token on
// the canvas element from the theme that suits the paint (dusk on the dark presets, noon on paper), so everything inside,
// tiles included, keeps spending `t.<token>` and reads right on the paint. The background presets are the one table here
// that holds hex values (README Decision 10); the fill tints are paint too, mixed over the background.

import type { CSSProperties } from "react";

import { MAP_GRID } from "@/lib/build/mapGeometry";
import type { MapFill, MapStyle } from "@/lib/build/mapLayout";
import { luminance, over } from "@/lib/theme/luminance";
import { resolveToken, type ThemeKey } from "@/lib/theme/resolve";
import { TOKEN_NAMES, t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, textStep } from "@/lib/theme/type";

/* ── the background ── */

/** README Decision 10: the canvas's background presets, stored by key. */
export const CANVAS_BACKGROUNDS = { grey: "#3A3D3B", dusk: "#141416", slate: "#2B3138", paper: "#EDEDE8" } as const;
export type CanvasBackground = keyof typeof CANVAS_BACKGROUNDS;
const HEX = /^#[0-9a-f]{6}$/i;

/** A stored background (a preset's key or `#RRGGBB`) as a colour. Anything else is grey. */
export function backgroundOf(background: string): string {
  if (background in CANVAS_BACKGROUNDS) return CANVAS_BACKGROUNDS[background as CanvasBackground];
  return HEX.test(background) ? background.toUpperCase() : CANVAS_BACKGROUNDS.grey;
}

/** The ink for a background: the theme whose tokens read on it, and which token draws each thing. */
export interface CanvasInk {
  /** Dusk's light ink on dark paint, noon's dark ink on light paint. */
  theme: ThemeKey;
  /**
   * Box titles, explanations and frame names. The theme's quieter `text2` reaches only about 4:1 on the grey and slate
   * presets, so the canvas's own words all take `text` and step down by size and weight instead.
   */
  text: string;
  /** Build lines and arrowheads. */
  line: string;
  /** Session frames. */
  frame: string;
  /** Part frames: quieter than a session's. */
  frameQuiet: string;
  /** The dot grid's dots. */
  dots: string;
}

/** The ink on a background: light on the dark presets (and any dark colour), dark on paper (and any light colour). */
export function inkFor(background: string): CanvasInk {
  const theme: ThemeKey = luminance(backgroundOf(background)) > 0.35 ? "noon" : "dusk";
  return { theme, text: t.text, line: t.text2, frame: t.label, frameQuiet: t.label, dots: t.dotGrid };
}

const scopes = new Map<ThemeKey, CSSProperties>();
/** Every token re-declared from the ink's theme, for the canvas element: its children's `var(--x)` then read the paint's ink. */
export function canvasScope(background: string): CSSProperties {
  const { theme } = inkFor(background);
  if (!scopes.has(theme)) scopes.set(theme, Object.fromEntries(TOKEN_NAMES.map((name) => [`--${name}`, resolveToken(theme, name)])) as CSSProperties);
  return { ...(scopes.get(theme) as CSSProperties), background: backgroundOf(background), colorScheme: theme === "dusk" ? "dark" : "light" };
}

/* ── fills ── */

/** Each fill as a tint: a hue at an alpha, mixed over the background. Light paint takes a deeper alpha of the same hue. */
const TINTS: Record<Exclude<MapFill, "none">, { hue: [number, number, number]; onDark: number; onLight: number }> = {
  grey: { hue: [255, 255, 255], onDark: 0.06, onLight: 0.5 },
  green: { hue: [110, 200, 150], onDark: 0.12, onLight: 0.22 },
  amber: { hue: [230, 180, 90], onDark: 0.12, onLight: 0.22 },
  blue: { hue: [110, 160, 230], onDark: 0.12, onLight: 0.2 },
  violet: { hue: [170, 140, 230], onDark: 0.12, onLight: 0.2 },
};
/** A box with no fill chosen is drawn grey, a step off the canvas, as `01-finished-map.png` draws its boxes. */
export const DEFAULT_FILL: MapFill = "grey";

/** A fill's colour on a background, opaque: "none" is the background itself. */
export function fillFor(fill: MapFill, background: string): string {
  const ground = backgroundOf(background);
  if (fill === "none") return ground;
  const tint = TINTS[fill];
  const alpha = inkFor(background).theme === "dusk" ? tint.onDark : tint.onLight;
  return over(`rgba(${tint.hue.join(",")},${alpha})`, ground);
}

/* ── boxes ── */

/** README Decision 7: padding from `MAP_GRID`. The head is the title then the explanation, 4 apart. */
export const BOX = { radius: 12, padding: MAP_GRID.padding, headGap: 4, headBelow: 12 } as const;
/** A box's title: the type scale's body at 500 (the prompt's 14 isn't one of the five sizes). */
export const BOX_TITLE: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.body, fontWeight: 500, lineHeight: "20px", color: t.text, margin: 0, overflowWrap: "anywhere" };
/** The session's harness beside a box's title, quieter. */
export const BOX_TITLE_SIDE: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.meta, fontWeight: 400, color: t.text, marginLeft: 8 };
/** A box's explanation: meta at 400 (the prompt's 12.5 isn't one of the five sizes). */
export const BOX_EXPLANATION: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.meta, fontWeight: 400, lineHeight: "18px", color: t.text, margin: 0, overflowWrap: "anywhere" };
/** The session tab before a box's title: "S1". */
export const BOX_TAB: CSSProperties = { fontFamily: DM_MONO, fontSize: textStep.meta, lineHeight: "16px", color: t.text, border: `1px solid ${t.label}`, borderRadius: 4, padding: "0 5px", marginRight: 8 };

const BORDER_STYLE: Record<NonNullable<MapStyle["border"]>, string> = { line: "solid", dashed: "dashed", none: "none" };
/** A box's own surface: its fill on the background, its border, its corners. */
export function boxStyle(style: MapStyle | undefined, background: string): CSSProperties {
  const border = style?.border ?? "line";
  return {
    boxSizing: "border-box",
    background: fillFor(style?.fill ?? DEFAULT_FILL, background),
    border: border === "none" ? "none" : `1px ${BORDER_STYLE[border]} ${t.label}`,
    borderRadius: style?.corners ?? BOX.radius,
  };
}

/** A tile the build no longer has, for the maker: a muted slot. */
export const REMOVED_SLOT: CSSProperties = { boxSizing: "border-box", border: `1px dashed ${t.label}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FIGTREE, fontSize: textStep.meta, color: t.text };
/** The removed slot's height when nothing measures it. */
export const REMOVED_HEIGHT = 56;

/* ── frames ── */

/** A frame's line and its name tab on the top edge. Part frames are dashed and quieter than session frames. */
export const FRAME = { line: 1.5, radius: 14, partDash: "6 4", partOpacity: 0.7, tabInset: 12 } as const;
export const FRAME_TAB: CSSProperties = { position: "absolute", top: 0, transform: "translateY(-50%)", fontFamily: FIGTREE, fontSize: textStep.meta, fontWeight: 500, lineHeight: "18px", padding: "0 6px", borderRadius: 4, whiteSpace: "nowrap" };

/* ── lines ── */

/** Build lines 1.3 wide with 7px arrowheads; two-way arrows 1.6 wide in `t.evidence`. */
export const LINES = { width: 1.3, arrow: 7, dash: "4 3", twoWay: 1.6, twoWayColour: t.evidence } as const;

/* ── the canvas ── */

/** The dot grid, as the app draws it. */
export const dotGrid = (dots: string): CSSProperties => ({ backgroundImage: `radial-gradient(${dots} 1px, transparent 1px)`, backgroundSize: "16px 16px" });

/* ── MS-06: the editor ── */

/** README Decision 10: selection in `t.evidence`, 2px. One selected box gets eight 8px handles. */
export const SELECTION = { ring: 2, handle: 8, tileRadius: 12 } as const;
export const SELECTION_RING = `0 0 0 ${SELECTION.ring}px ${t.evidence}`;

/** The Map view's columns: "On the map" 252 wide, 16, then the canvas column. Under 1024 the first folds into a sheet. */
export const EDITOR = { sources: 252, gap: 16, foldBelow: 1024, toolbarGap: 12 } as const;
export const EDITOR_COLUMNS: CSSProperties = { display: "flex", alignItems: "flex-start", gap: EDITOR.gap, minWidth: 0 };
export const EDITOR_SOURCES: CSSProperties = { flex: `0 0 ${EDITOR.sources}px`, width: EDITOR.sources, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 };
export const EDITOR_CANVAS_COLUMN: CSSProperties = { flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: EDITOR.toolbarGap };
/** The canvas's scrolling well: wide maps scroll across inside the column. */
export const EDITOR_SCROLL: CSSProperties = { position: "relative", overflow: "auto", minWidth: 0, maxWidth: "100%" };

/** The toolbar above the canvas: groups of buttons, a rule between groups. */
export const TOOLBAR: CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 };
export const TOOLBAR_GROUP: CSSProperties = { display: "flex", alignItems: "center", gap: 4 };

/** Zoom: 50 to 150%, in steps of 10. */
export const ZOOM = { min: 0.5, max: 1.5, step: 0.1 } as const;

/** The floating bar: 36 tall, 8 clear of the selection, above its top-right corner (below when there's no room). */
export const FLOATING_BAR = { height: 36, clear: 8, padding: "0 6px", gap: 4 } as const;
export const FLOATING_BAR_STYLE: CSSProperties = {
  position: "absolute",
  zIndex: 2,
  height: FLOATING_BAR.height,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: FLOATING_BAR.gap,
  padding: FLOATING_BAR.padding,
  background: t.window,
  border: `1px solid ${t.windowBorder}`,
  borderRadius: 10,
  whiteSpace: "nowrap",
};
/** The selection's name at the left of the floating bar. */
export const FLOATING_NAME: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.meta, fontWeight: 500, color: t.text, padding: "0 6px" };
/** A rule between the floating bar's groups. */
export const FLOATING_RULE: CSSProperties = { width: 1, alignSelf: "stretch", margin: "8px 2px", background: t.hairline };
/** A refusal: one line in `t.lit`. */
export const REFUSAL: CSSProperties = { fontFamily: FIGTREE, fontSize: textStep.meta, lineHeight: "18px", color: t.lit, margin: 0, whiteSpace: "nowrap" };
