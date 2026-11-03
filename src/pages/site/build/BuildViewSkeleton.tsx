/* SV-04 P5: the build page's loading shape, in its own small module, so the route table's Placeholder is this same
   component without the page's code in the first download. BuildView.tsx re-exports all of it. The layout helpers live
   here because the skeleton is drawn from them; the page uses them from here too. */

import type { CSSProperties } from "react";

import { Panel, PanelHead } from "@/components/brand/Panel";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BOARD_GRID_HEIGHT, boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { sideTrack, useIsPhone, useWidthTier, type WidthTier } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";
import { asideStyle, mainStyle, trackRow } from "@/lib/theme/refinedLayout";
import { t } from "@/lib/theme/tokens";

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

/* UX-01 P10: the page's own track layout for the steps, here so the skeleton and BuildView draw the same boxes. */
export const pair = (stacked: boolean): CSSProperties => trackRow(stacked, 48);
export const wide = (stacked: boolean): CSSProperties => mainStyle(stacked, { flex: "999 1 640px", minWidth: 0 });
export const side: CSSProperties = { flex: "1 0 300px", maxWidth: 340, minWidth: 0 };

/** The steps and What you need before the record arrives: the tabs, the step rows, and the aside with its hairline. */
function StepsSkeleton({ phone, stacked }: { phone: boolean; stacked: boolean }) {
  const stepRows = Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={phone ? 96 : 88} radius={r.control} />);
  const need = (
    <div data-testid="build-need-loading" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Skeleton width={110} height={17} />
        <Skeleton width={150} height={14} />
      </div>
      {[3, 2, 2].map((count, group) => (
        <div key={group} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton width={80} height={11} />
          {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} height={24} radius={r.chip} />
          ))}
        </div>
      ))}
    </div>
  );
  if (phone) {
    return (
      <>
        <div data-testid="build-steps-loading" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={36} radius={r.control} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{stepRows}</div>
        </div>
        {need}
      </>
    );
  }
  return (
    <div data-testid="build-steps-loading" style={pair(stacked)}>
      <div style={{ ...wide(stacked), display: "flex", flexDirection: "column", gap: 16 }}>
        <Skeleton height={36} radius={r.control} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{stepRows}</div>
      </div>
      <div style={asideStyle(stacked, { ...side, boxSizing: "content-box", paddingLeft: 32, borderLeft: `1px solid ${t.hairline}` })}>{need}</div>
    </div>
  );
}

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
        <StepsSkeleton phone stacked />
      </LoadingRegion>
    );
  }
  const board = fit === "board" && tier === "full";
  const stacked = tier === "stacked";
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
      <StepsSkeleton phone={false} stacked={stacked} />
    </LoadingRegion>
  );
}
