/* CA-24 P1: building blocks, the loading placeholder.

   One component draws any placeholder as a grid of small characters in the shape of what is coming (`loadingBlocks.ts` has
   the numbers). A `line` is one row; a `box` is `rows`. The block is `aria-hidden`: whoever shows it supplies the one
   visually hidden "Loading" (`LoadingStatus`, below).

   HOW A BLOCK IS DRAWN. The cell is 8 by 12 and holds one of four characters, which change in ten step-end frames over 1,600 ms
   (the `bgLoad*` keyframes in index.css; only opacity moves). Cells that start their cycle together share their animated layers:
   one layer for each of the four characters and each start, holding that character at every cell of that start and a space at
   the rest, a line of text for each row, 8 to the cell (the letter spacing is the rest of the 8 after the character's own
   advance). So a block costs at most 10 starts times four layers whatever its size, which is what lets a whole first-load
   skeleton hold its frame rate. The wave is `waveDelay` from the page position, to the nearest `PHASE_MS`.

   NO TIMERS AND NO STATE PER CELL. A block reads where it stands on the page once (one state for the whole block) so that the
   wave is the page's, not its own. `order` and `building` are for the first load: each row rises 4 and fades in, bottom row
   first. `gone` fades the block out over 200 ms (the content is ready); the block stays where it was, so nothing moves.

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
  fillOf,
  layersOf,
  lineOf,
  pageClock,
  rowsOf,
} from "./loadingBlocks";

export interface LoadingBlocksProps {
  /** The box's width in px, or "fill" to take the width of its parent. */
  width: number | "fill";
  /** A box's rows (a line is always one). */
  rows?: number;
  /** SV-05 P4: "fill" takes the height of its parent: as many rows as fit, the cells centred so they cover the whole box. */
  height?: "fill";
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

/** The text's own advance is one `ch`; the rest of the cell's 8 is letter spacing, and half of it is put before the first character. */
const SPARE = `calc(${CELL_W}px - 1ch)`;

const TEXT: CSSProperties = {
  position: "absolute",
  top: 0,
  left: `calc(${SPARE} / 2)`,
  whiteSpace: "pre",
  letterSpacing: SPARE,
  fontFamily: DM_MONO,
  fontSize: CELL_FONT,
  lineHeight: `${CELL_H}px`,
  color: t.textDisabled,
};

/** A layer: the characters of every cell that starts its cycle at `delay`, one glyph, opacity the only thing that moves. */
const layerStyle = (glyph: number, delay: number): CSSProperties => ({
  ...TEXT,
  opacity: 0,
  animation: `${bgLoadNames[glyph]} ${CYCLE_MS}ms step-end ${delay}ms infinite`,
});

/** The still fill: a `·` at 62%. */
const STILL: CSSProperties = { ...TEXT, opacity: GLYPH_OPACITY[0] };

export function LoadingBlocks({ width, rows = 1, height, kind = "box", order = 0, building = false, gone = false, at, style }: LoadingBlocksProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const [reduced] = useState(() => prefersReducedMotion());
  const [clock] = useState(() => pageClock());
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(at ?? null);
  const [measured, setMeasured] = useState<number | null>(null);
  const [tall, setTall] = useState<number | null>(null);

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
      if (height === "fill") {
        const room = Math.floor(element.parentElement?.clientHeight ?? box.height);
        setTall((held) => (held === room ? held : room));
      }
    };
    read();
    window.addEventListener("resize", read);
    // SV-05 P4: a box that fills its parent is read again when the parent changes size, not only the window.
    const observer = (width === "fill" || height === "fill") && typeof ResizeObserver !== "undefined" && element.parentElement ? new ResizeObserver(read) : null;
    if (observer && element.parentElement) observer.observe(element.parentElement);
    return () => {
      window.removeEventListener("resize", read);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, at?.x, at?.y]);

  const total = width === "fill" ? (measured ?? 0) : width;
  const filled = height === "fill" ? fillOf(total, tall ?? 0) : null;
  const count = filled ? filled.rows : rowsOf(kind, rows);
  const cols = filled ? filled.cols : columnsOf(total);
  const base = at ?? origin ?? { x: 0, y: 0 };
  const out = gone && !reduced;
  const rising = building && !reduced;

  /** A row of a layer: its own element only while the block builds, when the rows rise one after another. */
  const rowOf = (row: number, text: string) => (
    <div key={row} style={{ height: CELL_H, ...(rising ? { animation: `bgLoadRise ${BUILD_MS}ms backwards`, animationDelay: `${buildDelay(order, row, count)}ms` } : null) }}>
      {text}
    </div>
  );

  const layers: ReactNode[] = [];
  if (cols > 0 && count > 0) {
    if (reduced) {
      layers.push(
        <span key="still" style={STILL}>
          {Array.from({ length: count }, (_, row) => (
            <div key={row} style={{ height: CELL_H }}>
              {GLYPHS[0].repeat(cols)}
            </div>
          ))}
        </span>,
      );
    } else {
      for (const layer of layersOf(cols, count, base, clock)) {
        GLYPHS.forEach((glyph, at) => {
          layers.push(
            <span key={`${layer.delay}:${at}`} style={layerStyle(at, layer.delay)}>
              {layer.rows.map((members, row) => rowOf(row, lineOf(cols, members, glyph)))}
            </span>,
          );
        });
      }
    }
  }

  return (
    <div
      ref={root}
      aria-hidden="true"
      data-loading-blocks=""
      data-testid="loading-blocks"
      data-kind={kind}
      data-rows={count}
      data-cols={cols}
      data-layers={layers.length}
      style={{
        position: "relative",
        width: width === "fill" ? "100%" : width,
        height: filled ? "100%" : count * CELL_H,
        overflow: "hidden",
        flexShrink: 0,
        pointerEvents: "none",
        userSelect: "none",
        opacity: out ? 0 : 1,
        transition: out ? `opacity ${BLOCKS_OUT_MS}ms ${STANDARD}` : undefined,
        ...style,
      }}
    >
      {filled ? <div style={{ position: "absolute", left: filled.left, top: filled.top, right: 0, bottom: 0 }}>{layers}</div> : layers}
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
