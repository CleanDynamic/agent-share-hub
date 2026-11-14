/* The React side of the fluid loading fields (Reference E; the drawing is src/lib/dots/fluid.ts).

   A REGION is an element with one canvas over it: `useFluidRegion` makes one for an element and gives it to the shapes
   inside through context. A SHAPE (`FluidShape`) is an element that keeps its own box, exactly as it would be laid out,
   paints nothing, and tells its region where it is and how round its corners are, relative to the region, kept current
   with ResizeObserver. A shape with no region around it is its own region: one canvas for one small element. */

import { createContext, forwardRef, useContext, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type RefObject } from "react";

import { addRegion, FluidRegion, markGone, removeRegion, type RegionMode } from "@/lib/dots/fluid";

/** Inside a region: `region` is null for the first render, until the region's element is on the page. */
export const FluidRegionContext = createContext<{ region: FluidRegion | null } | null>(null);

/** One canvas over `host`, for as long as it is on the page; `gone` starts its wind-down. */
export function useFluidRegion(host: RefObject<HTMLElement | null>, { mode = "shapes", gone = false }: { mode?: RegionMode; gone?: boolean } = {}) {
  const [region, setRegion] = useState<FluidRegion | null>(null);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const made = new FluidRegion(el, mode);
    addRegion(made);
    setRegion(made);
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => made.resized());
    sizes?.observe(el);
    const onResize = () => made.resized();
    window.addEventListener("resize", onResize);
    return () => {
      sizes?.disconnect();
      window.removeEventListener("resize", onResize);
      removeRegion(made);
    };
  }, [host, mode]);
  useLayoutEffect(() => {
    if (region && gone) markGone(region);
  }, [region, gone]);
  return region;
}

/** A corner radius as the element draws it, in px (a percentage is of the shorter side, as an orb's 50% is). */
function radiusOf(el: HTMLElement, width: number, height: number): number {
  const value = getComputedStyle(el).borderTopLeftRadius;
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 0;
  return value.trim().endsWith("%") ? (n / 100) * Math.min(width, height) : n;
}

/** Keep `region` told where `el` is, relative to it, and how round. */
function useShape(el: RefObject<HTMLElement | null>, region: FluidRegion | null, own: boolean) {
  useLayoutEffect(() => {
    const node = el.current;
    if (!node || !region) return;
    const key = {};
    const measure = () => {
      const box = node.getBoundingClientRect();
      if (own) {
        region.setShape(key, { x: 0, y: 0, width: node.clientWidth || box.width, height: node.clientHeight || box.height, radius: radiusOf(node, box.width, box.height) });
        return;
      }
      const host = region.host.getBoundingClientRect();
      region.setShape(key, {
        x: box.left - host.left - region.host.clientLeft,
        y: box.top - host.top - region.host.clientTop,
        width: box.width,
        height: box.height,
        radius: radiusOf(node, box.width, box.height),
      });
    };
    measure();
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    sizes?.observe(node);
    if (!own) sizes?.observe(region.host);
    window.addEventListener("resize", measure);
    return () => {
      sizes?.disconnect();
      window.removeEventListener("resize", measure);
      region.removeShape(key);
    };
  }, [el, region, own]);
}

export interface FluidShapeProps extends HTMLAttributes<HTMLDivElement> {
  /** The content is ready (a shape that is its own region winds down). */
  gone?: boolean;
}

/** An element whose box is a shape in the nearest region's field, or, with none around it, a region of its own. */
export const FluidShape = forwardRef<HTMLDivElement, FluidShapeProps>(function FluidShape({ gone = false, style, ...rest }, ref) {
  const inside = useContext(FluidRegionContext);
  return inside ? <ShapeInRegion {...rest} style={style} region={inside.region} forwardedRef={ref} /> : <ShapeOwnRegion {...rest} style={style} gone={gone} forwardedRef={ref} />;
});

type Inner = HTMLAttributes<HTMLDivElement> & { forwardedRef: React.ForwardedRef<HTMLDivElement> };

function ShapeInRegion({ region, forwardedRef, ...rest }: Inner & { region: FluidRegion | null }) {
  const el = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => el.current as HTMLDivElement);
  useShape(el, region, false);
  return <div ref={el} {...rest} />;
}

function ShapeOwnRegion({ forwardedRef, gone, style, ...rest }: Inner & { gone: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => el.current as HTMLDivElement);
  const region = useFluidRegion(el, { gone });
  useShape(el, region, true);
  // The canvas sits inside the element: it is the containing block unless the caller has placed it already.
  const placed: CSSProperties = { position: "relative", ...style };
  return <div ref={el} {...rest} style={placed} />;
}
