// The skeleton (UI-P37): what a panel shows in place of its content while the
// content is on its way.
//
// A `--recess` block that is THE SAME SIZE AS WHAT IT REPLACES — a card the
// card's size, a row the row's height, an orb a circle of the orb's diameter, a
// chart the chart's box — so that nothing moves when the real thing arrives.
// Panels, their heads and their padding render normally while loading; only the
// content inside them is skeletal, which is why this takes a width, a height
// and a radius and nothing else: it is a rectangle, not a layout.
//
// ONE MOVEMENT, ONE PROPERTY. A 1.4s pulse between opacity 1 and .55, in the
// `skeletonPulse` keyframe in `index.css` (a keyframe is the one thing an inline
// style cannot express). Opacity is compositor-only, so a page of forty bones
// costs no layout and no paint. Under `prefers-reduced-motion` the animation is
// not emitted at all (`animation()` returns undefined) and the global rule in
// `index.css` covers a visitor who changes the setting mid-load: what is left is
// a flat recess, which still reads as "not content yet" because the colour and
// the shape say so. Not the older sweep in `ui/skeleton.tsx`: that one is the
// legacy control kit's and stays for the pages that still use it.
//
// A LOADING REGION IS NAMED, NOT JUST DRAWN. The bones are `aria-hidden`; the
// region around them (`LoadingRegion`) is `aria-busy="true"` and holds a
// visually hidden "Loading {what}", so a screen reader meets a sentence where a
// sighted reader meets a pulse. Only a whole page announces itself (`announce`):
// a page with five loading panels would otherwise read five sentences at once.

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { animation, SKELETON_PULSE_MS } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import { VisuallyHidden } from "./VisuallyHidden";

export interface SkeletonProps {
  /** A full row by default: the width of the content it replaces. */
  width?: number | string;
  /** The height of the content it replaces. */
  height: number | string;
  /** 8 (the chip step) unless the content has another: 50% for an orb or an avatar. */
  radius?: number | string;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height, radius = 8, style }: SkeletonProps) {
  return (
    <div
      data-ui="skeleton"
      data-bg-animated=""
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background: t.recess,
        flexShrink: 0,
        animation: animation("skeletonPulse", SKELETON_PULSE_MS, { iterations: "infinite" }),
        ...style,
      }}
    />
  );
}

export interface LoadingRegionProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "role"> {
  /** What is loading, as a noun phrase: "the visitors’ book". Read as "Loading the visitors’ book". */
  what: string;
  /** A polite announcement, for a whole page. A panel among others stays quiet. */
  announce?: boolean;
  children?: ReactNode;
}

export function LoadingRegion({ what, announce = false, children, ...rest }: LoadingRegionProps) {
  return (
    <div data-ui="loading" {...rest} role={announce ? "status" : undefined} aria-busy="true">
      <VisuallyHidden>Loading {what}</VisuallyHidden>
      {children}
    </div>
  );
}

/* ── the build card ───────────────────────────────────────────────────────────
   Every wall in the product hangs the same card, so its placeholder is one
   component: the card's own chrome (glass, hairline, radius 14, the card shadow,
   7px of padding) with bones where its content goes — the cover, then the title,
   the credit, the plaque and the chips. The chrome is the real card's, so what
   arrives is the card's content and nothing else.

   THE LAMP'S 18PX IS KEPT, and SHRINKS as the real lamp does: on a board the grid
   row is a fixed 250 and the lamp gives up what the card's content needs, so the
   placeholder gives up the same. `body` is the record's height under the cover
   (124 on the desktop wall, 144 on a phone's, where the chips wrap to two rows). */

export interface CardSkeletonProps {
  /** The cover's height: 92 on the desktop wall, 96 on a phone's, 86 for a profile's works. */
  cover: number;
  /** The record under the cover, in px: the title, credit, plaque and chips. */
  body?: number;
}

export function CardSkeleton({ cover, body = 124 }: CardSkeletonProps) {
  return (
    <div
      data-ui="card-skeleton"
      aria-hidden="true"
      style={{ display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}
    >
      <div style={{ height: 18, flexShrink: 1 }} />
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 7,
          padding: 7,
          background: t.glass,
          borderRadius: r.card,
          border: `1px solid ${t.glassBorder}`,
          boxShadow: t.shadowCard,
          boxSizing: "border-box",
        }}
      >
        <Skeleton height={cover} radius={r.media} />
        <div style={{ height: body, padding: "0 5px 5px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton width="72%" height={20} />
          <Skeleton width="48%" height={12} />
          <Skeleton width="84%" height={16} />
          <div style={{ display: "flex", gap: 4 }}>
            <Skeleton width={64} height={17} radius={r.chip} />
            <Skeleton width={48} height={17} radius={r.chip} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
