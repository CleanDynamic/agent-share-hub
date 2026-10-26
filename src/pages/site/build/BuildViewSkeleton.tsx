/* SV-04 P5: the build page's loading shape, in its own small module, so the route table's Placeholder is this same
   component without the page's code in the first download. BuildView.tsx re-exports all of it. The layout helpers live
   here because the skeleton is drawn from them; the page uses them from here too. */

import type { CSSProperties } from "react";

import { Panel, PanelHead } from "@/components/brand/Panel";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BOARD_GRID_HEIGHT, boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { sideTrack, useIsPhone, useWidthTier, type WidthTier } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";

/** The first row's height on the desktop board. */
export const HERO_ROW = 402;

/** The bottom row's height on the board: what the 820 leaves under the hero row. */
export const BOTTOM_ROW = BOARD_GRID_HEIGHT - HERO_ROW - 12;

/* UI-P39 — the two rows between the boards. The hero row keeps both tracks to
   1024 (the proof narrowing to 340) and stacks below. The bottom row's narrowest
   panel, the timeline, drops below the anatomy and the viewer under 1280, full
   width at the row's height. */
export function heroRow(tier: WidthTier): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: tier === "stacked" ? "minmax(0, 1fr)" : `minmax(0, 1fr) ${sideTrack(420)}`,
    gridAutoRows: tier === "stacked" ? `minmax(${HERO_ROW}px, auto)` : undefined,
    gap: 8,
    flexShrink: 0,
  };
}

export function bottomRow(tier: WidthTier): CSSProperties {
  return tier === "full"
    ? { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) 280px", gap: 8, flexGrow: 1, minHeight: 0 }
    : { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gridAutoRows: `minmax(${BOTTOM_ROW}px, auto)`, gap: 8, flexGrow: 1 };
}

/** The timeline's cell: its own track at 1280 and up, the row's full width below. */
export const dropped = (tier: WidthTier): CSSProperties => (tier === "full" ? {} : { gridColumn: "1 / -1" });

export const MOCK_ROWS = 6;

/** The proof panel before the record arrives: the orb's circle, the plaque, the button and the details, as bones. */
export function ProofSkeleton({ phone }: { phone: boolean }) {
  const orb = phone ? 118 : 128;
  return (
    <Panel surface="glass" padding={phone ? "16px" : "16px 18px"} style={phone ? { minHeight: 440 } : { height: "100%" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Skeleton width={orb} height={orb} radius="50%" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minWidth: 0 }}>
          <Skeleton width={90} height={11} />
          <Skeleton height={phone ? 37 : 51} radius={r.chip} />
          {phone ? null : <Skeleton height={31} radius={r.control} />}
          {phone ? null : <Skeleton width="80%" height={11} />}
        </div>
      </div>
      {/* The phone's action: drawn 48, rendered 44 (the touch floor). */}
      {phone ? <Skeleton height={44} radius={r.control} style={{ marginTop: 8 }} /> : null}
      <Skeleton height={phone ? 161 : 107} radius={r.control} style={{ marginTop: 8 }} />
    </Panel>
  );
}

/** The first screen's shape before the record arrives: the panels, their heads and padding are the real ones; only what is inside them is a bone. */
export function BuildViewSkeleton({ fit = "content" }: { fit?: PageFit }) {
  const phone = useIsPhone();
  const tier = useWidthTier();
  const rows = (height: number, count: number, gap: number) =>
    Array.from({ length: count }, (_, i) => <Skeleton key={i} height={height} radius={r.control} style={i ? { marginTop: gap } : undefined} />);
  if (phone) {
    return (
      <LoadingRegion what="the build" announce data-testid="build-loading" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton height={382} radius={18} />
        <Skeleton height={76} radius={18} />
        <ProofSkeleton phone />
        <Skeleton height={30} radius={r.media} />
        <Panel surface="glass" padding="14px 10px">
          <PanelHead headingLevel={2} title="Anatomy" subtitle={"\u00a0"} />
          <div style={{ marginTop: 6 }}>{rows(46, MOCK_ROWS, 2)}</div>
          {/* "Show n more parts" */}
          <Skeleton width={120} height={13} style={{ margin: "8px 0 0 8px" }} />
        </Panel>
        <Skeleton height={317} radius={r.panel} />
        <Panel surface="glass" padding="14px 16px">
          <PanelHead headingLevel={2} title="Watch it get built" subtitle={"\u00a0"} />
          <div style={{ marginTop: 8 }}>{rows(43, 4, 0)}</div>
        </Panel>
      </LoadingRegion>
    );
  }
  const board = fit === "board" && tier === "full";
  return (
    <LoadingRegion
      what="the build"
      announce
      data-testid="build-loading"
      style={{ display: "flex", flexDirection: "column", gap: 8, lineHeight: "normal", ...boardHeight(fit) }}
    >
      <div style={{ ...heroRow(tier), ...(board ? { height: HERO_ROW } : { minHeight: HERO_ROW }) }}>
        <div style={{ minHeight: 0 }}>
          <Skeleton height="100%" radius={r.panel} style={{ minHeight: HERO_ROW + 2, boxSizing: "border-box" }} />
        </div>
        <div style={{ minHeight: 0 }}>
          <ProofSkeleton phone={false} />
        </div>
      </div>
      <div style={bottomRow(tier)}>
        <Panel surface="glass" padding="14px 12px" style={{ height: "100%" }}>
          <PanelHead headingLevel={2} title="Anatomy" subtitle={"\u00a0"} />
          <div style={{ marginTop: 6 }}>{rows(40, MOCK_ROWS, 2)}</div>
        </Panel>
        <Skeleton height="100%" radius={r.panel} />
        <Panel surface="glass" padding="14px 16px" style={{ height: "100%", ...dropped(tier) }}>
          <PanelHead headingLevel={2} title="Watch it get built" subtitle={"\u00a0"} />
          <div style={{ marginTop: 8 }}>{rows(41, 5, 0)}</div>
        </Panel>
      </div>
    </LoadingRegion>
  );
}
