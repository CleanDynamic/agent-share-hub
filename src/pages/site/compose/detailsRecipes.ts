/* CA-18 P3: the Details column's measures, as the boards "Details: read only" and "Details: on a 1920 window" draw them.

   Details is a column on the surface (not a boxed module), split by spacing and thin lines. Every number here is the board's, in
   pixels at 100%; every paint is a token, so Noon follows. These are recipes like `modalRecipes`: the measures that are not
   steps of the spacing scale (10, 22, 27, 38) live here and nowhere else, and `lookRules.test.ts` reads this file as a recipe file. */

import type { CSSProperties } from "react";

import { CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

const type = (size: number, weight: 400 | 500, color: string, line: number): CSSProperties => ({ fontFamily: FIGTREE, fontSize: size, fontWeight: weight, lineHeight: `${line}px`, color });

/** What sits between two sections: 22, a 1px rule, 22. */
export const SECTION_GAP = { above: 22, rule: 1, below: 22 } as const;
/** The space a section takes above itself when it is not first in its column. */
export const SECTION_SEPARATION = SECTION_GAP.above + SECTION_GAP.rule + SECTION_GAP.below;
/** The head block to the value: 10. */
export const HEAD_TO_VALUE = 10;
/** 4 below the head of the whole column. */
export const HEAD_BELOW = 4;
/** The line naming what is empty sits 22 below the last section. */
export const FOOT_ABOVE = 22;

export const COLUMN: CSSProperties = { display: "flex", flexDirection: "column", minWidth: 0 };

/* ── the head ── */

export const HEAD_ROW: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 };
export const HEAD_MARK: CSSProperties = { marginTop: 1, flexShrink: 0 };
export const HEAD_TEXT: CSSProperties = { display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 };
export const HEAD_TITLE: CSSProperties = { ...type(15, 500, t.text, 22), margin: 0, overflowWrap: "anywhere" };
export const HEAD_LINE: CSSProperties = { ...type(12.5, 400, t.text2, 18), margin: 0, display: "flex", alignItems: "center", gap: 8, overflowWrap: "anywhere" };
/** Edit: secondary, 28 tall, padding 0 10 (the `Button` draws the rest: 12.5/500, radius 6). */
export const EDIT_BUTTON: CSSProperties = { padding: "0 10px", flexShrink: 0 };

/* ── a section ── */

export const SECTION_HEAD: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, minWidth: 0 };
export const SECTION_LABEL: CSSProperties = { ...type(14, 500, t.text, 20), margin: 0 };
export const SECTION_COUNT: CSSProperties = { ...type(12.5, 400, t.text2, 18), margin: 0 };

/** A section after the first in its column: 22, a 1px `--hairline`, 22. */
export const SECTION_BREAK: CSSProperties = { marginTop: SECTION_GAP.above, paddingTop: SECTION_GAP.below, borderTop: `1px solid ${t.hairline}` };

export const VALUE: CSSProperties = { marginTop: HEAD_TO_VALUE, minWidth: 0 };

/* ── values ── */

export const PROSE: CSSProperties = { ...type(13, 400, t.text, 21), margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" };
export const PROSE_MUTED: CSSProperties = { ...PROSE, color: t.text2 };
export const PROSE_CODE: CSSProperties = { ...PROSE, fontFamily: DM_MONO, fontSize: 12.5, lineHeight: "20px" };

/** A label and its value: 38 tall, 13px, a 1px `--hairline` rule above; the label at the left, the value at the right, 14 apart at least. */
export const ROW: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, minHeight: 38, boxSizing: "border-box", borderTop: `1px solid ${t.hairline}`, fontFamily: FIGTREE, fontSize: 13, minWidth: 0 };
export const ROW_LABEL: CSSProperties = { ...type(13, 400, t.text2, 18), flexShrink: 0 };
export const ROW_VALUE: CSSProperties = { ...type(13, 400, t.text, 18), textAlign: "right", overflowWrap: "anywhere", minWidth: 0 };

/** A list or links row: 27 tall, 13px, gap 10. */
export const LIST_ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 10, minHeight: 27, minWidth: 0, fontFamily: FIGTREE, fontSize: 13 };
/** The tile's number: the data face 10.5/14 on the control, radius 3, padding 2 6, at least 30 wide, centred. */
export const BADGE: CSSProperties = { ...CONTROL, boxSizing: "border-box", minWidth: 30, padding: "2px 6px", borderRadius: 3, fontFamily: DM_MONO, fontSize: 10.5, lineHeight: "14px", color: t.text, textAlign: "center", fontVariantNumeric: "tabular-nums", flexShrink: 0 };
export const LIST_NAME: CSSProperties = { ...type(13, 500, t.text, 18), overflowWrap: "anywhere", minWidth: 0 };
export const LIST_KIND: CSSProperties = { ...type(13, 400, t.text2, 18), whiteSpace: "nowrap" };
export const LIST_VALUE: CSSProperties = { ...type(12.5, 400, t.text2, 18), marginLeft: "auto", whiteSpace: "nowrap", paddingLeft: 10 };
export const LIST_DETAIL: CSSProperties = { ...type(12.5, 400, t.text2, 18), overflowWrap: "anywhere" };
export const LINK_ROW: CSSProperties = { appearance: "none", background: "none", border: 0, padding: 0, margin: 0, width: "100%", textAlign: "left", cursor: "pointer", color: "inherit" };
export const CHIPS: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0 };

/** The tool's mark in place of the badge: 20. */
export const TOOL_MARK_SIZE = 20;

/* ── the foot ── */

export const NOT_SET: CSSProperties = { ...type(12, 400, t.label, 17), margin: 0, marginTop: FOOT_ABOVE };
export const EMPTY: CSSProperties = { ...type(13, 400, t.text2, 18), margin: 0 };

/* CA-18 P4: the composer's frame. The composer sits 34 in from the surface; the build head's post is 18 below its status line and 18 above its hairline. */
export const COMPOSER_PAD = 34;
export const HEAD_GAP = 18;

/* CA-18 P5: the overlay panel of a smaller window, and the foot that says a click edits. */
export const OVERLAY_WIDTH = 360;
export const OVERLAY_EDGE = 8;
export const OVERLAY_PAD = 20;
export const OVERLAY_FOOT_PAD = "14px 20px";
export const OVERLAY_FOOT_COPY = { click: "Click to edit", tap: "Tap to edit" } as const;
