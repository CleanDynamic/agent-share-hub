// CA-17 P6 (Synth 09 restyle): the measures of the composer's title row, as the boards draw it (the top of every board): 44 tall across the
// top, a hairline under it, padding 0 22; List and Map at 13, 22 apart, 13 above the rule; the actions at the right.

import type { CSSProperties } from "react";

import { size, space } from "@/lib/theme/space";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, textStep } from "@/lib/theme/type";

/* Synth 09: the title row is a panel of its own (the Panel fill, radius 12), its controls centred on one line. */
export const TAB_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "nowrap",
  boxSizing: "border-box",
  minHeight: size.touch,
  padding: `${space[3]}px ${space[4]}px`,
  background: t.surface,
  borderRadius: r.panel,
  minWidth: 0,
};

/** List and Map: two pills, 4 apart. */
export const TAB_GROUP: CSSProperties = { display: "flex", alignItems: "center", gap: space[1], minWidth: 0, flexShrink: 0 };

/** A pill, 32 tall, padded 0 14, radius 999; 15 Text 2; the chosen one on Raised in Text. */
export const tabStyle = (selected: boolean): CSSProperties => ({
  appearance: "none",
  border: 0,
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  boxSizing: "border-box",
  height: size.control,
  padding: "0 14px",
  borderRadius: r.full,
  cursor: "pointer",
  fontFamily: FIGTREE,
  fontSize: textStep.body,
  lineHeight: "normal",
  fontWeight: selected ? 500 : 400,
  color: selected ? t.text : t.text2,
  background: selected ? t.control : "transparent",
});

/** Classification, Preview and Publish: 32 tall, space[2] apart, on the rule as the tabs are. */
export const TAB_ACTIONS: CSSProperties = { display: "flex", alignItems: "center", gap: space[2], marginLeft: "auto", flexShrink: 0 };

/** The draft's title and its status line, at the top of the List's Build column: the line 3 under the title. */
export const BUILD_HEAD: CSSProperties = { display: "flex", flexDirection: "column", gap: space[1], minWidth: 0 };
