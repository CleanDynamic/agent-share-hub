/* InlineLoader (Reference E, G27): the site's small "working" mark, in place of the old ring spinner and the Loader2
   spinners. A 16 to 22px circle of dots on its own centred 7px grid; a bright arc travels clockwise once every 1.1s
   (each dot's v = 0.42 + 0.58 * arc², arc = 0.5 + 0.5 * cos(angle − 5.7t)); the centre dot holds at 0.62; no edge
   breathing. It is a fluid region of its own, drawn by the page's one loop.

   `role="status"` with a visually hidden label, as the spinner had: a wait that says nothing to a screen reader is a
   silent one. The sign-in dialog's pending buttons keep their ring of dots (PendingRing). */

import { useLayoutEffect, useRef, type CSSProperties } from "react";

import { useFluidRegion } from "./FluidField";
import { VisuallyHidden } from "./VisuallyHidden";

export interface InlineLoaderProps {
  /** The circle's diameter, 16 to 22px. */
  size?: number;
  /** Announced while it is on screen. */
  label?: string;
  style?: CSSProperties;
}

export function InlineLoader({ size = 16, label = "Loading", style }: InlineLoaderProps) {
  const host = useRef<HTMLSpanElement>(null);
  const diameter = Math.min(22, Math.max(16, size));
  const region = useFluidRegion(host, { mode: "loader" });
  useLayoutEffect(() => {
    if (!region) return;
    const key = {};
    region.setShape(key, { x: 0, y: 0, width: diameter, height: diameter, radius: diameter / 2 });
    return () => region.removeShape(key);
  }, [region, diameter]);
  return (
    <span role="status" data-ui="inline-loader" style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, ...style }}>
      <span ref={host} aria-hidden="true" style={{ position: "relative", display: "inline-block", width: diameter, height: diameter }} />
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}

export default InlineLoader;
