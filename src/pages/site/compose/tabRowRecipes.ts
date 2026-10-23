// CA-17 P6: the measures of the composer's tab row, as the boards draw it (the top of every board): 44 tall across the
// top, a hairline under it, padding 0 22; List and Map at 13, 22 apart, 13 above the rule; the actions at the right.

import type { CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const TAB_ROW: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  flexWrap: "nowrap",
  boxSizing: "border-box",
  height: 44,
  padding: "0 22px",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: t.hairline,
  minWidth: 0,
};

export const TAB_GROUP: CSSProperties = { display: "flex", alignItems: "flex-end", gap: 22, minWidth: 0 };

/** A tab: 13 `--text2`; 13 of room under its text, where the selected one draws its line. */
export const tabStyle = (selected: boolean): CSSProperties => ({
  appearance: "none",
  background: "none",
  border: 0,
  margin: 0,
  padding: "0 0 13px",
  cursor: "pointer",
  fontFamily: FIGTREE,
  fontSize: 13,
  lineHeight: "normal",
  fontWeight: selected ? 500 : 400,
  color: selected ? t.text : t.text2,
  /* The line is an inset shadow, 1.5 thick, so the row does not move. */
  boxShadow: selected ? `inset 0 -1.5px 0 ${t.text}` : "none",
});

/** "Map is now available", at 11.5 `--label`, just after the tabs. */
export const TAB_HINT: CSSProperties = { fontFamily: FIGTREE, fontSize: 11.5, fontWeight: 400, lineHeight: "normal", color: t.label, paddingLeft: 12, paddingBottom: 14, whiteSpace: "nowrap" };

/** Card, Preview and Publish: 28 tall, 8 apart, 9 above the rule. */
export const TAB_ACTIONS: CSSProperties = { display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", marginBottom: 9, flexShrink: 0 };

/** The draft's title and its status line, at the top of the List's Build column: the line 3 under the title. */
export const BUILD_HEAD: CSSProperties = { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 };
