// The arc (UI-P13): the lit curve that crosses the top-right of a page, and the
// smaller ones inside the Build hero and the Profile banner.
//
// ONE DRAWING, TWO ROOMS. Both are a huge circle whose centre is off the
// artboard, so that only a bend of it enters at the top-right, drawn in the
// reference's own coordinate space (`viewBox`) and scaled to whatever box it is
// put in. What differs by room is the SHAPE of the drawing, not just its colours,
// so it is read with `useRoom`, as the mark's halo is:
//
//   Dusk   a wide blurred haze (`--arc-haze`, 170, .5), then the middle stroke —
//          the three-stop gradient `--arc-1 → --arc-2 → --arc-3` at 16, .95,
//          blurred 7 — then a crisp 2.4 core in `--arc-1`, then a hairline outer
//          ring 12 outside at .5. A lamp needs darkness, so Dusk has a glow.
//   Noon   a softer haze (`--arc-haze`, 130, .6), and then only the core: the same
//          gradient at 2.4, with an outer ring at .35. No glow: there is no dark
//          for it to burn through.
//
// STATIC. No animation, no `feDisplacementMap`, nothing that reads the scroll;
// the blurs are two `feGaussianBlur`s, 46 for the haze and 7 for the middle
// stroke. Every id is unique to the instance, so two arcs on one page (the page's
// and the hero's) cannot share a gradient.
//
// The gradient runs `userSpaceOnUse` from the circle's left edge at the top
// (x = cx − r) to the artboard's bottom-right corner.

import { useId } from "react";
import type { CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";

import { useRoom } from "./useRoom";

export interface ArcGeometry {
  /** The artboard, in the reference's units. */
  width: number;
  height: number;
  /** The circle. */
  cx: number;
  cy: number;
  r: number;
}

/** The page arc, desktop (1440 wide) and mobile (390 wide). */
export const ARC_PAGE_DESKTOP: ArcGeometry = { width: 1440, height: 1066, cx: 1780, cy: -520, r: 1080 };
export const ARC_PAGE_MOBILE: ArcGeometry = { width: 390, height: 640, cx: 560, cy: -300, r: 470 };
/** The smaller arcs: the Build hero (desktop, mobile) and the Profile banner. */
export const ARC_BUILD_HERO: ArcGeometry = { width: 900, height: 400, cx: 1100, cy: -260, r: 620 };
export const ARC_BUILD_HERO_MOBILE: ArcGeometry = { width: 362, height: 380, cx: 520, cy: -240, r: 420 };
export const ARC_PROFILE_BANNER: ArcGeometry = { width: 900, height: 260, cx: 1150, cy: -420, r: 760 };
export const ARC_PROFILE_BANNER_MOBILE: ArcGeometry = { width: 362, height: 180, cx: 520, cy: -300, r: 440 };

export interface ArcProps {
  geometry: ArcGeometry;
  /** `xMaxYMin slice` pins the artboard's top-right to the box's and crops the rest. */
  preserveAspectRatio?: string;
  style?: CSSProperties;
}

export function Arc({ geometry, preserveAspectRatio = "xMaxYMin slice", style }: ArcProps) {
  const { width, height, cx, cy, r } = geometry;
  const dusk = useRoom() === "dusk";
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const haze = `arc-haze-${id}`;
  const middle = `arc-mid-${id}`;
  const gradient = `arc-grad-${id}`;

  return (
    <svg
      data-ui="arc"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={preserveAspectRatio}
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", ...style }}
    >
      <defs>
        <filter id={haze} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="46" />
        </filter>
        {dusk ? (
          <filter id={middle} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        ) : null}
        <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1={cx - r} y1={0} x2={width} y2={height}>
          <stop offset="0" stopColor={t.arc1} />
          <stop offset={dusk ? 0.4 : 0.55} stopColor={t.arc2} />
          <stop offset="1" stopColor={t.arc3} />
        </linearGradient>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={t.arcHaze}
        strokeWidth={dusk ? 170 : 130}
        opacity={dusk ? 0.5 : 0.6}
        filter={`url(#${haze})`}
      />
      {dusk ? (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#${gradient})`}
            strokeWidth={16}
            opacity={0.95}
            filter={`url(#${middle})`}
          />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.arc1} strokeWidth={2.4} />
        </>
      ) : (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${gradient})`} strokeWidth={2.4} />
      )}
      <circle cx={cx} cy={cy} r={r + 12} fill="none" stroke={t.arcOuter} strokeWidth={1} opacity={dusk ? 0.5 : 0.35} />
    </svg>
  );
}

export default Arc;
