// The page backdrop (UI-P13, UI-P13b): the room behind every page — `--ambient`
// over `--backdrop`, the glowing arc, film grain on Dusk — and, over it, the
// living WebGL field.
//
// TWO LAYERS. The first is the UI-P13 room, painted with CSS and SVG and static:
// no animation, no displacement, nothing reading the scroll. It is always there,
// so it is the fallback when WebGL is missing or refuses the shader, and what
// shows for the moment before the canvas draws. The second is the one backdrop
// canvas (`backdropCanvas.ts`), which this component only hosts: the canvas, its
// program and its loop belong to the document, not to this mount, so a frame that
// remounts (crossing into `/rebuild/:slug` or the entrance) moves the same canvas
// rather than compiling a new one. The canvas is `position: fixed` over the
// viewport and draws on top of the room.
//
// IT IS THE PAGE REGION'S FIRST CHILD, AND IT SCROLLS. The room is `position:
// absolute` over the whole height of its (positioned) parent — not `fixed` —
// `pointer-events: none` and `z-index: 0`; everything else in the region sits
// above it at z-index 1 or more. The parent must be `position: relative`, which
// is the frame's to say.
//
// THE ARC SCALES WITH THE WIDTH. It is drawn in the reference's coordinate
// space (1440 × 1066 on desktop, 390 × 640 on mobile) in a box that is exactly
// the viewport's width and keeps the artboard's aspect. The 768px breakpoint is
// the app's own (`useIsMobile`); `viewport` overrides it for the dev compare page.
//
// GRAIN IS DUSK'S: a fractal-noise layer at .15 in `overlay`.
//
// THE ENTRANCE HAS ITS OWN TONE (UI-P36). Sign in, join, reset and verify are
// lit from the edges: on desktop the horizon gives way to `--ambient` over the
// flat `--bg`, the box gets `--signin-edge`, and the arc is drawn on a
// 1440 × 1000 board. On a phone `signin` changes nothing.

import { useEffect, useId, useRef } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import { t } from "@/lib/theme/tokens";

import { Arc, ARC_PAGE_DESKTOP, ARC_PAGE_MOBILE, ARC_SIGNIN_DESKTOP } from "./Arc";
import { attachBackdrop, setBackdropRoom } from "./backdropCanvas";
import { useRoom } from "./useRoom";

export type PageBackdropTone = "page" | "signin";

export interface PageBackdropProps {
  /** Which artboard to draw. Defaults to the app's 768px breakpoint. */
  viewport?: "desktop" | "mobile";
  /** `signin` is the entrance's room on desktop; every other page is `page`. */
  tone?: PageBackdropTone;
}

export function PageBackdrop({ viewport, tone = "page" }: PageBackdropProps) {
  const room = useRoom();
  const dusk = room === "dusk";
  const isMobile = useIsMobile();
  const phone = (viewport ?? (isMobile ? "mobile" : "desktop")) === "mobile";
  const entrance = tone === "signin" && !phone;
  const geometry = phone ? ARC_PAGE_MOBILE : entrance ? ARC_SIGNIN_DESKTOP : ARC_PAGE_DESKTOP;
  const grain = `grain-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => (host.current ? attachBackdrop(host.current) : undefined), []);
  useEffect(() => setBackdropRoom(room), [room]);

  return (
    <div
      data-ui="page-backdrop"
      data-tone={tone}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: `${t.ambient}, ${entrance ? t.bg : t.backdrop}`,
        boxShadow: entrance ? t.signinEdge : undefined,
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
      {/* Last, so the canvas paints over the room; React's own children are inserted before it. */}
      <div ref={host} data-slot="backdrop-canvas-host" />
    </div>
  );
}

export default PageBackdrop;
