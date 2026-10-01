// The page backdrop (UI-P13): the room behind every page — `--ambient` over
// `--backdrop`, the glowing arc, and film grain on Dusk.
//
// IT IS THE PAGE REGION'S FIRST CHILD, AND IT SCROLLS. It is `position:
// absolute` over the whole height of its (positioned) parent — not `fixed` —
// so it moves with the page and costs one paint, `pointer-events: none` and
// `z-index: 0`; everything else in the region sits above it at z-index 1 or
// more. The parent must be `position: relative`, which is the frame's to say.
//
// THE ARC SCALES WITH THE WIDTH. It is drawn in the reference's coordinate
// space (1440 × 1066 on desktop, 390 × 640 on mobile) in a box that is exactly
// the viewport's width and keeps the artboard's aspect, so at 1920 it is a third
// larger and at 390 it is the mobile drawing, never a crop of the desktop one.
// The 768px breakpoint is the app's own (`useIsMobile`); `viewport` overrides it
// for the dev compare page, which sizes a wrapper rather than the window.
//
// GRAIN IS DUSK'S: a fractal-noise layer at .15 in `overlay`, which on Noon
// would only dirty a light ground. It blends with the backdrop it sits on,
// because this element is its own stacking context.
//
// STATIC. No animation, no displacement, nothing reading the scroll.

import { useId } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import { t } from "@/lib/theme/tokens";

import { Arc, ARC_PAGE_DESKTOP, ARC_PAGE_MOBILE } from "./Arc";
import { useRoom } from "./useRoom";

export interface PageBackdropProps {
  /** Which artboard to draw. Defaults to the app's 768px breakpoint. */
  viewport?: "desktop" | "mobile";
}

export function PageBackdrop({ viewport }: PageBackdropProps) {
  const dusk = useRoom() === "dusk";
  const isMobile = useIsMobile();
  const geometry = (viewport ?? (isMobile ? "mobile" : "desktop")) === "mobile" ? ARC_PAGE_MOBILE : ARC_PAGE_DESKTOP;
  const grain = `grain-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div
      data-ui="page-backdrop"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: `${t.ambient}, ${t.backdrop}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          aspectRatio: `${geometry.width} / ${geometry.height}`,
        }}
      >
        <Arc geometry={geometry} />
      </div>
      {dusk ? (
        <svg
          data-ui="grain"
          width="100%"
          height="100%"
          focusable="false"
          style={{ position: "absolute", inset: 0, opacity: 0.15, mixBlendMode: "overlay", pointerEvents: "none" }}
        >
          <filter id={grain}>
            <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={2} stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#${grain})`} />
        </svg>
      ) : null}
    </div>
  );
}

export default PageBackdrop;
