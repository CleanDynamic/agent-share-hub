// SV-04 P2: the progress line under the header, while a page change waits.
//
// It shows only once a change has waited SHOW_LINE_AFTER_MS (go.ts), so a page that is ready sooner changes with no line
// at all. While it waits it is ONE animation, `bgPageProgress` in index.css: `scaleX` 0 to 0.9 over 2000 ms on
// `STANDARD`, from the left, never a timer loop. When the page changes it finishes from wherever it got to: `scaleX` to 1
// over `FAST`, then opacity to 0 over `FAST`, and it is removed. Under reduced motion it stands still at `scaleX(0.5)` and
// goes when the page changes.
//
// 2px, square ends, `--action` at 60% (the prompt's `t.accent` is not a token here). Transform and opacity only.

import { useEffect, useRef, useState } from "react";

import { SHOW_LINE_AFTER_MS, usePageChange, usePendingPath } from "@/lib/routing/go";
import { FAST, STANDARD, prefersReducedMotion } from "@/lib/theme/motion";
import { tokenAlpha } from "@/lib/theme/tokens";

const LINE = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 2,
  background: tokenAlpha("action", 0.6),
  transformOrigin: "left center",
  pointerEvents: "none",
} as const;

type Phase = "off" | "on" | "done";

export function PageProgress() {
  const change = usePageChange();
  const pending = usePendingPath();
  const waiting = Boolean(change?.isPending) || pending !== null;
  const [phase, setPhase] = useState<Phase>("off");
  /** Where the line had got to when the page changed: finishing starts there, not where its animation began. */
  const [reached, setReached] = useState("scaleX(0.9)");
  const [reduced] = useState(prefersReducedMotion);
  const line = useRef<HTMLDivElement>(null);

  // The line is a timed step from waiting: it comes after 300 ms of it, and finishes when it ends.
  useEffect(() => {
    if (waiting && phase !== "on") {
      const timer = window.setTimeout(() => setPhase("on"), SHOW_LINE_AFTER_MS);
      return () => window.clearTimeout(timer);
    }
    if (!waiting && phase === "on") {
      if (!reduced && line.current) setReached(getComputedStyle(line.current).transform);
      setPhase(reduced ? "off" : "done");
    }
  }, [waiting, phase, reduced]);

  if (phase === "off") return null;
  return (
    <div
      ref={line}
      aria-hidden="true"
      data-testid="page-progress"
      data-ui="page-progress"
      data-phase={phase}
      onAnimationEnd={(event) => {
        if (event.animationName === "bgPageProgressOut") setPhase("off");
      }}
      style={
        reduced
          ? { ...LINE, transform: "scaleX(0.5)" }
          : phase === "on"
            ? { ...LINE, transform: "scaleX(0)", animation: `bgPageProgress 2000ms ${STANDARD} forwards` }
            : { ...LINE, transform: reached, animation: `bgPageProgressFill ${FAST}ms ${STANDARD} forwards, bgPageProgressOut ${FAST}ms ${STANDARD} ${FAST}ms forwards` }
      }
    />
  );
}

export default PageProgress;
