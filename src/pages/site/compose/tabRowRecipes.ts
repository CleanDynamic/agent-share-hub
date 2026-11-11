// CA-17 P6: the measures of the composer's tab row, as the boards draw it (the top of every board): 44 tall across the
// top, a hairline under it, padding 0 22; List and Map at 13, 22 apart, 13 above the rule; the actions at the right.

import type { CSSProperties } from "react";

import { size, space } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const TAB_ROW: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  flexWrap: "nowrap",
  boxSizing: "border-box",
  height: size.touch,
  padding: `0 ${space[6]}px`,
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: t.hairline,
  minWidth: 0,
};

export const TAB_GROUP: CSSProperties = { display: "flex", alignItems: "flex-end", gap: space[6], minWidth: 0 };

/** S33: a tab, 32 high, padded 0 space[2], its words centred; 13 `--text2`; the selected one draws its line along its foot. */
export const tabStyle = (selected: boolean): CSSProperties => ({
  appearance: "none",
  background: "none",
  border: 0,
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  boxSizing: "border-box",
  height: size.control,
  padding: `0 ${space[2]}px`,
  cursor: "pointer",
  fontFamily: FIGTREE,
  fontSize: 13,
  lineHeight: "normal",
  fontWeight: selected ? 500 : 400,
  color: selected ? t.text : t.text2,
  /* The line is an inset shadow, 1.5 thick, so the row does not move. */
  boxShadow: selected ? `inset 0 -1.5px 0 ${t.text}` : "none",
});

/** Classification, Preview and Publish: 32 tall, space[2] apart, on the rule as the tabs are. */
export const TAB_ACTIONS: CSSProperties = { display: "flex", alignItems: "center", gap: space[2], marginLeft: "auto", flexShrink: 0 };

/** The draft's title and its status line, at the top of the List's Build column: the line 3 under the title. */
export const BUILD_HEAD: CSSProperties = { display: "flex", flexDirection: "column", gap: space[1], minWidth: 0 };
