/* CA-24 P1: building blocks, the loading placeholder; Part E (Reference E): drawn as a living dot field.

   A `line` is one row; a `box` is `rows`; `width` and `height` may be "fill". The block keeps exactly the box it always
   had (rows of 12px, `loadingBlocks.ts` has the numbers), so nothing moves, and that box is a shape in the fluid field:
   in the nearest LoadingRegion's canvas, or, with none around it, its own. The block is `aria-hidden`: whoever shows it
   supplies the one visually hidden "Loading" (`LoadingStatus`, below).

   The props are unchanged. `gone` (the content is ready) winds the block's dots down from its top; `order`, `building`
   and `at` are kept for the callers and no longer change what is drawn: every first show builds in from the top, and
   the field is laid on the page's own 7px grid.

   REDUCED MOTION: one still frame of the same shapes. */

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { FluidShape } from "@/components/brand/FluidField";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";

import { CELL_H, columnsOf, fillOf, rowsOf } from "./loadingBlocks";

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

export function LoadingBlocks({ width, rows = 1, height, kind = "box", gone = false, style }: LoadingBlocksProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const [tall, setTall] = useState<number | null>(null);

  /* For "fill", how wide and how tall the parent is: the block's rows and columns, which its data attributes report. */
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || (width !== "fill" && height !== "fill")) return;
    const read = () => {
      const box = element.getBoundingClientRect();
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
    const observer = typeof ResizeObserver !== "undefined" && element.parentElement ? new ResizeObserver(read) : null;
    if (observer && element.parentElement) observer.observe(element.parentElement);
    return () => {
      window.removeEventListener("resize", read);
      observer?.disconnect();
    };
  }, [width, height]);

  const total = width === "fill" ? (measured ?? 0) : width;
  const filled = height === "fill" ? fillOf(total, tall ?? 0) : null;
  const count = filled ? filled.rows : rowsOf(kind, rows);
  const cols = filled ? filled.cols : columnsOf(total);

  return (
    <FluidShape
      ref={root}
      aria-hidden="true"
      data-loading-blocks=""
      data-testid="loading-blocks"
      data-kind={kind}
      data-rows={count}
      data-cols={cols}
      data-gone={gone ? "" : undefined}
      gone={gone}
      style={{
        width: width === "fill" ? "100%" : width,
        height: filled ? "100%" : count * CELL_H,
        flexShrink: 0,
        pointerEvents: "none",
        userSelect: "none",
        ...style,
      }}
    />
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
