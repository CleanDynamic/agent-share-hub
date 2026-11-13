/* The page templates' loading layouts.

   A page's skeleton is drawn through the page's own column component where it has one (Home's, the Library's, Drafts',
   Settings', Builds'), so the skeleton's columns are the loaded page's by construction. This file holds what a skeleton
   needs when it cannot do that: the feed template's columns for a page whose loaded view borrows another page's frame
   (OpenBuilds draws Home's columns; its skeleton must not import Home), and the rows every skeleton draws.

   THE FEED TEMPLATE (3 / 6 / 3, 32 gutters, `pageColumns("feed")`): the centre has a hairline either side, centred in its
   gutter; the side columns start 8 below the top. Below 1101 the left column goes (`minmax(0, 628px) 300px`, centred);
   below 761 one column, the centre then the right. The same numbers as Home's columns, so a feed page's skeleton and the
   page it loads into share their edges. The page header is never part of a skeleton: it is drawn above this, at once. */

import type { CSSProperties, ReactNode } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { t } from "@/lib/theme/tokens";

import { PAGE_GUTTER, pageColumns } from "./pageGrid";
import { useMinWidth } from "./useMinWidth";

export type FeedLayout = "three" | "two" | "one";

/** The feed template's layout at this width: three columns from 1101, two from 761, one below. */
export function useFeedLayout(): FeedLayout {
  const three = useMinWidth(1101);
  const two = useMinWidth(761);
  return three ? "three" : two ? "two" : "one";
}

const side: CSSProperties = { padding: "8px 0 48px", display: "flex", flexDirection: "column", gap: 32, minWidth: 0 };

/** The feed template's columns, with bones in its three slots. */
export function FeedTemplateBones({ left, centre, right }: { left: ReactNode; centre: ReactNode; right: ReactNode }) {
  const layout = useFeedLayout();
  if (layout === "one") {
    return (
      <div data-layout="one" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0, paddingBottom: 48 }}>
        <div style={{ minWidth: 0 }}>{centre}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 32, minWidth: 0 }}>{right}</div>
      </div>
    );
  }
  const three = layout === "three";
  return (
    <div data-layout={layout} style={three ? pageColumns("feed") : { display: "grid", gridTemplateColumns: "minmax(0, 628px) 300px", columnGap: PAGE_GUTTER, justifyContent: "center" }}>
      {three ? <div style={side}>{left}</div> : null}
      <div style={{ borderLeft: `1px solid ${t.hairline}`, borderRight: `1px solid ${t.hairline}`, minWidth: 0, padding: "0 0 48px", margin: `0 -${PAGE_GUTTER / 2}px` }}>{centre}</div>
      <div style={side}>{right}</div>
    </div>
  );
}

/** Rows while they load, at the loaded rows' pitch: a hairline between them, a bar inside each, 12 in from top and bottom. */
export function RowBones({ count, height, what, ruleAbove = false }: { count: number; height: number; what: string; ruleAbove?: boolean }) {
  return (
    <LoadingRegion what={what} style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ height, boxSizing: "border-box", borderTop: index > 0 || ruleAbove ? `1px solid ${t.hairline}` : "none", display: "flex", alignItems: "center" }}>
          <Skeleton height={height - 24} radius={6} />
        </div>
      ))}
    </LoadingRegion>
  );
}
