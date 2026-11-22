// UI-P97 — a refined two-track row at the widths between the boards.
//
// A refined page that has an aside lays its main column and the aside out as one row. From 1024 up that row is two
// tracks, kept side by side (the aside narrows before it wraps), with the hairline on the aside's inner edge. Below
// 1024 (UI-P39's `BETWEEN.stack`) the row is one column: the aside drops under the main column, full width, and its
// side rule goes. Synth 03: there are no rules, so nothing replaces it; the row's gap and the aside's top padding group it.
// The switch is the one width, so a page's layout and its wrap can never disagree.
//
// Pure: the views read the width with `useMinWidth(BETWEEN.stack)` and pass `stacked` in.

import type { CSSProperties } from "react";


/** The row that holds a main column and an aside. */
export function trackRow(stacked: boolean, gap: number): CSSProperties {
  return stacked
    ? { display: "flex", flexDirection: "column", alignItems: "stretch", gap, minWidth: 0 }
    : { display: "flex", flexWrap: "nowrap", alignItems: "flex-start", gap, minWidth: 0 };
}

/**
 * An aside's style: `base` from 1024 up, and below it a full-width block under the main column (`order: 1`, so a sidebar
 * that leads the row in the markup still drops under it), its side rule gone and no rule in its place.
 */
export function asideStyle(stacked: boolean, base: CSSProperties): CSSProperties {
  if (!stacked) return base;
  const rest: CSSProperties = { ...base };
  delete rest.paddingLeft;
  delete rest.paddingRight;
  delete rest.borderLeft;
  delete rest.borderRight;
  return {
    ...rest,
    boxSizing: "border-box",
    order: 1,
    flex: "none",
    width: "100%",
    maxWidth: "none",
    paddingTop: 24,
  };
}

/** The main column's style: `base` from 1024 up, and below it a full-width block (a flex basis in a column is a height). */
export function mainStyle(stacked: boolean, base: CSSProperties): CSSProperties {
  return stacked ? { ...base, flex: "none", width: "100%", minWidth: 0 } : base;
}
