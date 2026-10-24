/* CA-24 P1: building blocks, the loading placeholder.

   One component draws any placeholder as a grid of small characters in the shape of what is coming (`loadingBlocks.ts` has
   the numbers). A `line` is one row; a `box` is `rows`. The block is `aria-hidden`: whoever shows it supplies the one
   visually hidden "Loading" (`LoadingStatus`, below).

   NO TIMERS AND NO STATE PER CELL. The cycle is the `bgLoad*` keyframes in index.css; each cell carries only its delay, as the
   inline variable `--bd`. A block reads where it stands on the page once (one state for the whole block) so that the wave is
   the page's, not its own. `order` and `building` are for the first load: the block's rows rise in, bottom row first. `gone`
   fades the block out over 200 ms (the content is ready); the block stays where it was, so nothing moves.

   REDUCED MOTION: a still `·` fill in the same shapes. No wave, no building, an instant swap. */

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { prefersReducedMotion, STANDARD } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import {
  BLOCKS_OUT_MS,
  BUILD_MS,
  CELL_FONT,
  CELL_H,
  CELL_W,
  CYCLE_MS,
  GLYPHS,
  GLYPH_OPACITY,
  buildDelay,
  columnsOf,
  pageClock,
  rowsOf,
  waveDelay,
} from "./loadingBlocks";

export interface LoadingBlocksProps {
  /** The box's width in px, or "fill" to take the width of its parent. */
  width: number | "fill";
  /** A box's rows (a line is always one). */
  rows?: number;
  kind?: "line" | "box";
  /** Reading order among the blocks of one placeholder, for building. */
  order?: number;
  /** First show: the rows build in. */
  building?: boolean;
  /** The content is ready: fade out. */
  gone?: boolean;
  /** Where the block stands on the page, when the page already knows (otherwise it is measured). */
  at?: { x: number; y: number };
  style?: CSSProperties;
}

const bgLoadNames = ["bgLoadDot", "bgLoadOpen", "bgLoadSmall", "bgLoadFull"] as const;

const glyphStyle = (at: number): CSSProperties => ({
  position: "absolute",
  inset: 0,
  textAlign: "center",
  opacity: 0,
  animation: `${bgLoadNames[at]} ${CYCLE_MS}ms step-end var(--bd) infinite`,
});

const GLYPH_STYLES = bgLoadNames.map((_, at) => glyphStyle(at));

const CELL: CSSProperties = {
  position: "relative",
  flex: `0 0 ${CELL_W}px`,
  width: CELL_W,
  height: CELL_H,
  fontFamily: DM_MONO,
  fontSize: CELL_FONT,
  lineHeight: `${CELL_H}px`,
  color: t.textDisabled,
};

/** The still fill: a `·` at 62%. */
const STILL: CSSProperties = { ...CELL, textAlign: "center", opacity: GLYPH_OPACITY[0] };

export function LoadingBlocks({ width, rows = 1, kind = "box", order = 0, building = false, gone = false, at, style }: LoadingBlocksProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const [reduced] = useState(() => prefersReducedMotion());
  const [clock] = useState(() => pageClock());
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(at ?? null);
  const [measured, setMeasured] = useState<number | null>(null);

  /* Where the block stands on the page (not in its parent), and, for "fill", how wide it is. Read once, and again if the
     window changes size. */
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const read = () => {
      const box = element.getBoundingClientRect();
      if (!at) {
        const x = Math.round(box.left + window.scrollX);
        const y = Math.round(box.top + window.scrollY);
        setOrigin((held) => (held && held.x === x && held.y === y ? held : { x, y }));
      }
      if (width === "fill") {
        const room = Math.floor(element.parentElement?.clientWidth ?? box.width);
        setMeasured((held) => (held === room ? held : room));
      }
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, at?.x, at?.y]);

  const total = width === "fill" ? (measured ?? 0) : width;
  const count = rowsOf(kind, rows);
  const cols = columnsOf(total);
  const base = at ?? origin ?? { x: 0, y: 0 };
  const out = gone && !reduced;

  const lines: ReactNode[] = [];
  for (let row = 0; row < count; row += 1) {
    const cells: ReactNode[] = [];
    for (let col = 0; col < cols; col += 1) {
      if (reduced) {
        cells.push(
          <span key={col} style={STILL}>
            {GLYPHS[0]}
          </span>,
        );
        continue;
      }
      const delay = waveDelay(base.x + col * CELL_W, base.y + row * CELL_H, clock);
      cells.push(
        <span key={col} style={{ ...CELL, ["--bd" as string]: `${delay}ms` }}>
          {GLYPHS.map((glyph, at) => (
            <span key={glyph} style={GLYPH_STYLES[at]}>
              {glyph}
            </span>
          ))}
        </span>,
      );
    }
    lines.push(
      <div
        key={row}
        style={{
          display: "flex",
          height: CELL_H,
          ...(building && !reduced ? { animation: `bgLoadRise ${BUILD_MS}ms backwards`, animationDelay: `${buildDelay(order, row, count)}ms` } : null),
        }}
      >
        {cells}
      </div>,
    );
  }

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-testid="loading-blocks"
      data-kind={kind}
      data-rows={count}
      data-cols={cols}
      style={{
        width: width === "fill" ? "100%" : width,
        height: count * CELL_H,
        overflow: "hidden",
        flexShrink: 0,
        pointerEvents: "none",
        userSelect: "none",
        opacity: out ? 0 : 1,
        transition: out ? `opacity ${BLOCKS_OUT_MS}ms ${STANDARD}` : undefined,
        ...style,
      }}
    >
      {lines}
    </div>
  );
}

/** The one visually hidden "Loading" for a whole placeholder, announced politely. */
export function LoadingStatus({ children }: { children?: ReactNode }) {
  return (
    <div role="status" data-testid="loading-status">
      <VisuallyHidden>Loading</VisuallyHidden>
      {children}
    </div>
  );
}

export default LoadingBlocks;
