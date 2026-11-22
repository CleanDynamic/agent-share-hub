/* The page templates' loading layouts.

   A page's skeleton is drawn through the page's own column component where it has one (Home's, the Library's, Drafts',
   Settings', Builds'), so the skeleton's columns are the loaded page's by construction. This file holds what a skeleton
   needs when it cannot do that: the feed template's columns for a page whose loaded view borrows another page's frame
   (OpenBuilds draws Home's columns; its skeleton must not import Home), and the rows every skeleton draws.

   THE FEED TEMPLATE (Synth 03): three PANELS, 8 apart, no lines (`panelColumns("three")`): `300px minmax(0, 1fr) 340px` from
   1101, the left one going from 761 (`minmax(0, 1fr) 300px`), one column of panels below. The same numbers as Home's
   columns, so a feed page's skeleton and the page it loads into share their edges. The page header is never part of a
   skeleton: it is drawn above this, at once. */

import type { CSSProperties, ReactNode } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { t } from "@/lib/theme/tokens";

import { PANEL_GUTTER, PANEL_PAD, PANEL_RADIUS } from "./chromeSize";
import { useColumnPanels } from "./frameChrome";
import { panelColumns } from "./pageGrid";
import { useMinWidth } from "./useMinWidth";

export type FeedLayout = "three" | "two" | "one";

/** The feed template's layout at this width: three columns from 1101, two from 761, one below. */
export function useFeedLayout(): FeedLayout {
  const three = useMinWidth(1101);
  const two = useMinWidth(761);
  return three ? "three" : two ? "two" : "one";
}

const panel: CSSProperties = { background: t.surface, borderRadius: PANEL_RADIUS, overflow: "clip", minWidth: 0, boxSizing: "border-box" };
const side: CSSProperties = { ...panel, padding: PANEL_PAD, display: "flex", flexDirection: "column", gap: 24 };

/** The feed template's panels, with bones in its three slots. */
export function FeedTemplateBones({ left, centre, right }: { left: ReactNode; centre: ReactNode; right: ReactNode }) {
  useColumnPanels(true);
  const layout = useFeedLayout();
  const sidesFull = useMinWidth(1192);
  if (layout === "one") {
    return (
      <div data-layout="one" style={{ display: "flex", flexDirection: "column", gap: PANEL_GUTTER, minWidth: 0 }}>
        <div style={{ ...panel, paddingBottom: 48 }}>{centre}</div>
        <div style={side}>{right}</div>
      </div>
    );
  }
  const three = layout === "three";
  return (
    <div data-layout={layout} style={panelColumns(three ? "three" : "two", { sidesFull, between: !three })}>
      {three ? <div style={side}>{left}</div> : null}
      <div style={{ ...panel, paddingBottom: 48 }}>{centre}</div>
      <div style={side}>{right}</div>
    </div>
  );
}

/** Rows while they load, at the loaded rows' pitch: a bar inside each, 12 in from top and bottom. */
export function RowBones({ count, height, what, ruleAbove = false }: { count: number; height: number; what: string; ruleAbove?: boolean }) {
  return (
    <LoadingRegion what={what} style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ height, boxSizing: "border-box", display: "flex", alignItems: "center" }}>
          <Skeleton height={height - 24} radius={6} />
        </div>
      ))}
    </LoadingRegion>
  );
}
