/* CA-24 P1: the composer before anything has loaded, in building blocks.

   It stands where the real composer will: the same title row, the same columns from `frameOf`, so Sources, Build and Details
   start at the positions of their blocks. It is the route's `Suspense` fallback and what `SandboxView` shows while the
   build's first queries load. A phone gets its single column: the title lines, then the post and the tiles.

   The sizes are the board's "Loading: building blocks": title 180 and 120 wide, 10 apart; Sources five lines, 22 apart; Build
   a post box of three rows, a counts line 210 wide and five tile boxes of three rows, 54 apart; Details six lines, 22 apart.

   `gone` fades the blocks out over 200 ms while the page's content fades in (`ComposeArrival`, below), the blocks staying
   exactly where they were. */

import { memo, useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { useWindowSize } from "./DetailsAside";
import { ORIGIN, frameOf, innerWidthOf } from "./detailsLayout";
import { COMPOSER_PAD } from "./detailsRecipes";
import { LoadingBlocks, LoadingStatus } from "./LoadingBlocks";
import { BLOCKS_OUT_MS, CELL_H, COLUMNS_TOP, CONTENT_IN_MS, COUNTS_WIDTH, DETAILS_WIDTHS, LINE_GAP, POST_ROWS, SOURCES_WIDTHS, TILES, TILE_INSET, TILE_PITCH, TILE_ROWS, TITLE_BLOCK_HEIGHT, TITLE_WIDTHS, TITLE_WRAP_ROOM, TITLE_WRAP_UNDER, takeFirstShow } from "./loadingBlocks";
import { TAB_ROW } from "./tabRowRecipes";

const column = (gap: number): CSSProperties => ({ display: "flex", flexDirection: "column", gap, minWidth: 0 });

interface Plan {
  phone: boolean;
  frame: ReturnType<typeof frameOf>;
  /** Phone: take the parent's width. */
  width: number | "fill";
  inner: number;
  windowWidth: number;
}

/** The blocks of one column, numbered in reading order from `start`. */
function Lines({ widths, start, building, gone, max }: { widths: readonly number[]; start: number; building: boolean; gone: boolean; max: number }) {
  return (
    <div style={column(LINE_GAP)}>
      {widths.map((width, at) => (
        <LoadingBlocks key={at} kind="line" width={Math.min(width, max)} order={start + at} building={building} gone={gone} />
      ))}
    </div>
  );
}

function BuildBlocks({ plan, start, building, gone }: { plan: Plan; start: number; building: boolean; gone: boolean }) {
  const buildWidth = plan.phone ? "fill" : plan.frame.build;
  const tileWidth = plan.phone ? "fill" : plan.frame.build - TILE_INSET;
  return (
    <div style={column(20)}>
      <LoadingBlocks kind="box" rows={POST_ROWS} width={buildWidth} order={start} building={building} gone={gone} />
      <LoadingBlocks kind="line" width={COUNTS_WIDTH} order={start + 1} building={building} gone={gone} />
      <div style={{ ...column(TILE_PITCH - TILE_ROWS * CELL_H), ...(plan.phone ? null : { paddingLeft: TILE_INSET - 1 }) }}>
        {Array.from({ length: TILES }, (_, at) => (
          <LoadingBlocks key={at} kind="box" rows={TILE_ROWS} width={tileWidth} order={start + 2 + at} building={building} gone={gone} />
        ))}
      </div>
    </div>
  );
}

/** Memoised: the page above re-renders on every change, and a skeleton is thousands of cells that have nothing new to say. */
export const ComposeSkeleton = memo(function ComposeSkeleton({ gone = false, ghost = false }: { gone?: boolean; ghost?: boolean }) {
  const phone = useIsPhone();
  const win = useWindowSize();
  const [building] = useState(() => (ghost ? false : takeFirstShow()));
  const inner = innerWidthOf(win.width);
  const frame = frameOf(inner);
  const plan: Plan = { phone, frame, width: phone ? "fill" : frame.build, inner, windowWidth: win.width };

  const title = (
    <div style={{ ...column(LINE_GAP), height: TITLE_BLOCK_HEIGHT, flexGrow: 1, minWidth: 0 }}>
      {TITLE_WIDTHS.map((width, at) => (
        <LoadingBlocks key={at} kind="line" width={width} order={at} building={building} gone={gone} />
      ))}
    </div>
  );

  if (phone) {
    return (
      <LoadingStatus>
        <div data-testid="compose-skeleton" data-layout="phone" style={column(20)}>
          <div style={{ ...column(0), paddingBottom: 16, borderBottom: `1px solid ${t.hairline}` }}>{title}</div>
          <BuildBlocks plan={plan} start={2} building={building} gone={gone} />
        </div>
      </LoadingStatus>
    );
  }

  const padLeft = frame.boxLeft - ORIGIN;
  const padRight = win.width - ORIGIN - frame.boxRight;
  const wraps = frame.boxRight - frame.boxLeft < TITLE_WRAP_UNDER;
  return (
    <LoadingStatus>
      <div data-testid="compose-skeleton" data-layout="desktop" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div data-testid="skeleton-tabrow" style={{ ...TAB_ROW, height: "auto", minHeight: 44, gap: 16, padding: `10px ${padRight}px 0 ${padLeft}px`, alignItems: "flex-start", flexWrap: wraps ? "wrap" : "nowrap" }}>
          <div style={{ flexGrow: 1, minWidth: 0, marginBottom: 12 }}>{title}</div>
          {/* The real row wraps its tabs and actions below the title in a narrow window; the room they take is kept. */}
          {wraps ? <div aria-hidden="true" style={{ flexBasis: "100%", height: TITLE_WRAP_ROOM }} /> : null}
        </div>
        <div data-testid="skeleton-columns" style={{ position: "relative", display: "block", padding: `${COLUMNS_TOP}px ${COMPOSER_PAD}px 0`, minWidth: 0 }}>
          <div data-testid="skeleton-sources" style={{ position: "absolute", top: COLUMNS_TOP, left: frame.sourcesLeft - ORIGIN, width: frame.sources }}>
            <Lines widths={SOURCES_WIDTHS} start={2} building={building} gone={gone} max={frame.sources} />
          </div>
          <div data-testid="skeleton-build" style={{ marginLeft: frame.buildLeft - ORIGIN - COMPOSER_PAD, width: frame.build }}>
            <BuildBlocks plan={plan} start={2 + SOURCES_WIDTHS.length} building={building} gone={gone} />
          </div>
          {frame.beside ? (
            <div data-testid="skeleton-details" style={{ position: "absolute", top: COLUMNS_TOP, left: frame.detailsLeft - ORIGIN, width: frame.detailsWidth }}>
              <Lines widths={DETAILS_WIDTHS} start={2 + SOURCES_WIDTHS.length + 2 + TILES} building={building} gone={gone} max={frame.detailsWidth} />
            </div>
          ) : null}
        </div>
      </div>
    </LoadingStatus>
  );
});

/**
 * The content arriving over its skeleton. While `loading`, the skeleton alone. When the content is ready, it takes the
 * skeleton's place and fades in over 250 ms while a copy of the skeleton, laid over it at the same place, fades out over 200
 * and is then taken away. The blocks occupy exactly the boxes the content will, so nothing moves. A page that was never
 * loading, and reduced motion, get the content at once.
 */
export function ComposeArrival({ loading, children }: { loading: boolean; children: ReactNode }) {
  const [was] = useState(loading);
  const [reduced] = useState(() => prefersReducedMotion());
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (loading || !was || reduced) return;
    const frame = window.requestAnimationFrame(() => setFading(true));
    // The ghost goes when its fade has ended; this is for a fade that never reports it (no transition support, a hidden tab).
    const fallback = window.setTimeout(() => setDone(true), BLOCKS_OUT_MS + 400);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [loading, was, reduced]);
  if (loading) return <ComposeSkeleton />;
  if (!was) return <>{children}</>;
  const settled = done || reduced;
  return (
    <div data-testid="compose-arrival" style={{ position: "relative" }}>
      <div style={settled ? undefined : { animation: `bgContentIn ${CONTENT_IN_MS}ms backwards` }}>{children}</div>
      {settled ? null : (
        <div aria-hidden="true" data-testid="compose-skeleton-ghost" onTransitionEnd={() => setDone(true)} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <ComposeSkeleton gone={fading} ghost />
        </div>
      )}
    </div>
  );
}
