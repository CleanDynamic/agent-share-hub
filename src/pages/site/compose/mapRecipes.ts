// CA-17 P4: the measures of the map of sessions and its panel, as the boards "Map: horizontal" and "Map: vertical" draw
// them. Like the other recipe modules this is the one place these numbers live; the map's own coordinates (columns 190
// apart, boxes 164 by 38, lines 2.5 wide) are in `sessionMap.ts`, and the colours here are all tokens.

import type { CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

const type = (px: number, weight: 400 | 500, color: string, lineHeight?: number | string): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: lineHeight ?? "normal",
  color,
});

/* ── the Map view's columns: rail 52, 24, the map, 48, the panel 312 ── */

export const MAP_VIEW: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 24, minWidth: 0, flexWrap: "nowrap" };
export const MAP_AND_PANEL: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 48, flex: "1 1 0", minWidth: 0 };
export const MAP_COLUMN: CSSProperties = { display: "flex", flexDirection: "column", flex: "1 1 0", minWidth: 0 };
export const MAP_PANEL_WIDTH = 312;
export const MAP_PANEL: CSSProperties = { display: "flex", flexDirection: "column", width: MAP_PANEL_WIDTH, flexShrink: 0, minWidth: 0 };
/** On a phone the panel goes under the map. */
export const MAP_STACKED: CSSProperties = { display: "flex", flexDirection: "column", gap: 24, minWidth: 0 };

/* ── the head: the drawing starts 84 below its top ── */

export const MAP_HEAD: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0, height: 84, boxSizing: "border-box" };
export const MAP_HEAD_TEXT: CSSProperties = { flex: "1 1 0", minWidth: 0 };
export const MAP_TITLE: CSSProperties = { ...type(18, 500, t.text, "24px"), margin: 0 };
export const MAP_SUB: CSSProperties = { ...type(12.5, 400, t.text2, "18px"), margin: 0 };
export const MAP_HEAD_CONTROLS: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 };

/* ── the drawing ── */

/** The scroll area: no box round the map, no dotted background; it sits on the surface. */
export const MAP_SCROLL: CSSProperties = { position: "relative", overflowX: "auto", overflowY: "hidden", minWidth: 0 };

export const MAP_PART_NAME: CSSProperties = { position: "absolute", display: "inline-flex", alignItems: "baseline", gap: 8, whiteSpace: "nowrap", ...type(12.5, 500, t.text) };
export const MAP_PART_NOTE: CSSProperties = type(12.5, 400, t.label);

export const MAP_STRIP: CSSProperties = { position: "absolute", boxSizing: "border-box", borderRadius: 4, background: t.module };
/** The labels are already capitals ("STAGE 3 · 9 OCT", from `stageText`), so nothing here changes case. */
export const MAP_STAGE_LABEL: CSSProperties = { position: "absolute", ...type(10, 400, t.label), letterSpacing: ".05em", whiteSpace: "nowrap", lineHeight: "normal" };

export const MAP_BOX: CSSProperties = {
  position: "absolute",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "0 10px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t.hairlineModule,
  borderRadius: 8,
  background: t.module,
  textAlign: "left",
  cursor: "pointer",
  color: t.text,
};
export const MAP_BOX_TITLE: CSSProperties = { ...type(12.5, 500, t.text), flex: "1 1 0", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
export const MAP_BOX_APP: CSSProperties = { ...type(12.5, 400, t.text2), flex: "1 1 0", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
export const MAP_BOX_NUMBER: CSSProperties = { fontFamily: DM_MONO, fontSize: 10.5, fontWeight: 400, color: t.label, flexShrink: 0, fontVariantNumeric: "tabular-nums" };
/** The selected box: a ring in the surface's colour, then a thin one in `--text2`. */
export const MAP_BOX_SELECTED = `0 0 0 3px ${t.surface}, 0 0 0 4.5px ${t.text2}`;

/* ── the legend row, 18 under the strip, and the sentence 16 under it ── */

export const MAP_LEGEND: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: 24, rowGap: 6, marginTop: 18 };
export const MAP_LEGEND_TEXT: CSSProperties = type(12, 400, t.text2);
export const MAP_LEGEND_NOTE: CSSProperties = { ...type(12, 400, t.label), margin: 0 };
export const MAP_LEGEND_NOTE_BELOW: CSSProperties = { ...MAP_LEGEND_NOTE, marginTop: 16 };
export const MAP_LEGEND_KEYS: CSSProperties = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 18 };
export const MAP_LEGEND_KEY: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, ...type(12, 400, t.text2) };
export const MAP_LEGEND_SQUARE: CSSProperties = { width: 12, height: 12, borderRadius: 3, flexShrink: 0, display: "inline-block" };
export const MAP_LEGEND_BAR: CSSProperties = { width: 2, height: 11, borderRadius: 1, flexShrink: 0, display: "inline-block" };
export const MAP_LEGEND_SELECTED: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 };

/* ── the empty map: "No map for this build." ── */

export const MAP_NONE: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 };
export const MAP_NONE_TITLE: CSSProperties = { ...type(13, 400, t.text), margin: 0 };
export const MAP_NONE_BODY: CSSProperties = { ...type(12, 400, t.label), margin: "6px 0 12px", maxWidth: 480 };

/* ── the panel ── */

export const PANEL_HEAD: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 };
export const PANEL_HEAD_TEXT: CSSProperties = { flex: "1 1 0", minWidth: 0 };
export const PANEL_TITLE: CSSProperties = { ...type(14, 500, t.text, "20px"), margin: 0, overflowWrap: "anywhere" };
export const PANEL_SUB: CSSProperties = { ...type(12.5, 400, t.text2, "18px"), margin: 0 };
export const PANEL_HEADING: CSSProperties = { ...type(14, 500, t.text), margin: 0 };
export const PANEL_COUNT: CSSProperties = { ...type(12.5, 400, t.text2), margin: 0 };
export const PANEL_RULE: CSSProperties = { height: 0, border: 0, borderTop: `1px solid ${t.hairline}`, margin: "22px 0", width: "100%" };
export const PANEL_ROWS: CSSProperties = { display: "flex", flexDirection: "column", marginTop: 14 };
export const PANEL_ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 10, minHeight: 27, minWidth: 0, background: "none", border: 0, padding: 0, textAlign: "left", width: "100%" };
export const PANEL_BADGE: CSSProperties = {
  fontFamily: DM_MONO,
  fontSize: 10.5,
  lineHeight: "14px",
  color: t.text,
  background: t.control,
  borderRadius: 3,
  padding: "2px 6px",
  minWidth: 30,
  boxSizing: "border-box",
  textAlign: "center",
  flexShrink: 0,
};
export const PANEL_ROW_TITLE: CSSProperties = type(13, 500, t.text);
export const PANEL_ROW_APP: CSSProperties = type(13, 400, t.text2);
export const PANEL_ROW_SIDE: CSSProperties = { ...type(12.5, 400, t.text2), marginLeft: "auto", flexShrink: 0, whiteSpace: "nowrap" };

/** The timeline: a rail 3.5 from the left, a dot on each item. */
export const TIMELINE: CSSProperties = { position: "relative", display: "flex", flexDirection: "column", marginTop: 12, paddingLeft: 26, borderLeftWidth: 0 };
export const TIMELINE_RAIL: CSSProperties = { position: "absolute", left: 3.5, top: 0, bottom: 0, width: 1, background: t.hairlineModule };
export const TIMELINE_ITEM: CSSProperties = { position: "relative", padding: "6px 0 10px", minWidth: 0 };
export const TIMELINE_DOT: CSSProperties = { position: "absolute", left: -26, top: 10, width: 8, height: 8, borderRadius: "50%", boxShadow: `0 0 0 3px ${t.surface}` };
export const TIMELINE_LINE1: CSSProperties = { display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 };
export const TIMELINE_SENTENCE: CSSProperties = { ...type(13, 500, t.text), minWidth: 0, overflowWrap: "anywhere" };
export const TIMELINE_SIDE: CSSProperties = { ...type(12.5, 400, t.text2), marginLeft: "auto", flexShrink: 0, whiteSpace: "nowrap" };
export const TIMELINE_LINE2: CSSProperties = { display: "flex", alignItems: "center", gap: 6, marginTop: 5, ...type(12.5, 400, t.text2), minWidth: 0 };
export const TIMELINE_SESSIONS: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, marginTop: 6 };
export const TIMELINE_SESSION: CSSProperties = { display: "flex", alignItems: "center", gap: 6, ...type(12.5, 400, t.text2), minWidth: 0 };

export const PANEL_HINT: CSSProperties = { ...type(12, 400, t.label), margin: "10px 0 0" };
