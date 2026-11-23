/* Synth 06: the loading state drawn as dots, measured from the real layout.

   `children` is the real component tree for the loading state. It is rendered with its content hidden (`opacity: 0`, not
   `display: none`, so it keeps its boxes), measured by `measureLayout` (src/lib/dots/measure.ts) and drawn as one dot
   field on one shared lattice, with the water of prompt 04 running under the whole layout. When the data arrives, `gone`
   fades the field out, and the content takes its place in the same boxes. Under reduced motion one still frame is drawn.

   The tree is `aria-hidden`: the page supplies the one visually hidden "Loading <thing>" (`LoadingStatus`). */

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { measureLayout } from "@/lib/dots/measure";

import { useFluidRegion } from "./FluidField";

export interface DotSkeletonProps {
  children: ReactNode;
  /** The data has arrived: the dots fade out. */
  gone?: boolean;
  style?: CSSProperties;
  "data-testid"?: string;
}

export function DotSkeleton({ children, gone = false, style, "data-testid": testId = "dot-skeleton" }: DotSkeletonProps) {
  const host = useRef<HTMLDivElement>(null);
  const tree = useRef<HTMLDivElement>(null);
  const region = useFluidRegion(host, { gone });

  useLayoutEffect(() => {
    const node = tree.current;
    if (!node || !region) return;
    const measure = () => region.replaceShapes(measureLayout(node));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const sizes = new ResizeObserver(measure);
    sizes.observe(node);
    for (const child of Array.from(node.children)) sizes.observe(child);
    /* Fonts arriving move the lines. */
    void document.fonts?.ready.then(measure);
    return () => sizes.disconnect();
  }, [region]);

  return (
    <div ref={host} aria-hidden="true" data-testid={testId} data-dot-skeleton="" data-gone={gone ? "" : undefined} style={{ position: "relative", pointerEvents: "none", userSelect: "none", ...style }}>
      <div ref={tree} style={{ opacity: 0 }}>
        {children}
      </div>
    </div>
  );
}

export default DotSkeleton;
