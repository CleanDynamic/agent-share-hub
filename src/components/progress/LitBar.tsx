// RC-P27 — the progress page's one bar: light, never type.
//
// AMBER IS LIGHT ⟦buildgallery-theme › Progress and achievement⟧: the fill is
// --lit and nothing is written on it, in either room; the track is --recess
// and both carry --r-control. The number the bar draws is always printed
// beside it in DM Mono, so the bar is never the only carrier of a value.
// MEASURED from the declared tokens (Noon / Dusk): --lit on --recess
// 1.55 / 5.60, and the track on --bg 1.16 / 1.33, both under the 3.0 UI floor
// on Noon, as the focus ring BG-P30 escalated is. Reported, not
// repainted: the prompt fixes these colours, and the bar is a picture of the
// number, which is what is read.
//
// ONE BAR, TWO USES ⟦law-of-similarity⟧: the level's progress under PROGRESS
// and each weekly challenge under THIS WEEK, so "how far along" looks the same
// wherever it is asked.
//
// MOTION ⟦buildgallery-theme › Motion⟧: the fill grows in once, from the
// inline start, when the bar first draws: transform only, at the 200ms
// ceiling, never its width. The fill's length is its inline-size, so it
// mirrors under a right-to-left direction ⟦better-layout › Logical
// properties⟧; the one physical value, the origin of the grow, is read from
// the track's own direction. Under prefers-reduced-motion the fill is drawn
// at its length at once and carries no transition (move() answers "none"),
// and index.css's global rule covers a setting changed while it is on screen.
//
// The height is 8, a step of the spacing scale.

import { useEffect, useRef, useState } from "react";

import { move, prefersReducedMotion } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";

export interface LitBarProps {
  /** How far along, from 0 to max. Clamped. */
  value: number;
  max: number;
  /** The bar's accessible name: what is being measured. */
  label: string;
  /** The value in words, as the text beside the bar says it: "1 of 3". */
  valueText: string;
  "data-testid"?: string;
}

/** The fill's share of the track, as a percentage from 0 to 100. */
function litBarPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round((Math.min(Math.max(value, 0), max) / max) * 1000) / 10;
}

export function LitBar({ value, max, label, valueText, "data-testid": testId }: LitBarProps) {
  const track = useRef<HTMLDivElement>(null);
  const still = prefersReducedMotion();
  // null until the first frame has painted the fill at nothing; then the side it grows from.
  const [origin, setOrigin] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const rtl = track.current ? getComputedStyle(track.current).direction === "rtl" : false;
      setOrigin(rtl ? "right" : "left");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const percent = litBarPercent(value, max);
  const clamped = Math.min(Math.max(value, 0), Math.max(max, 0));

  return (
    <div
      ref={track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      data-testid={testId ?? "lit-bar"}
      style={{
        height: SPACE.xs,
        background: t.recess,
        borderRadius: r.control,
        overflow: "hidden",
      }}
    >
      <div
        data-testid="lit-bar-fill"
        style={{
          height: "100%",
          inlineSize: `${percent}%`,
          background: t.lit,
          borderRadius: r.control,
          transformOrigin: origin === "right" ? "right center" : "left center",
          transform: still || origin !== null ? "none" : "scaleX(0)",
          transition: still ? "none" : move(),
        }}
      />
    </div>
  );
}

export default LitBar;
