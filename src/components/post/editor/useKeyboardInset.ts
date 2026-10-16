// useKeyboardInset: how far the on-screen keyboard (or any browser chrome) covers the bottom of the page (PT-07).
//
// A fixed bar at `bottom: 0` sits behind the keyboard on a phone, because the layout viewport does not shrink when the
// keyboard opens; the visual viewport does. The gap between the two is the inset, and the bar rides up by it.
// Where there is no visualViewport, or nothing covers the page, the inset is 0.

import { useEffect, useState } from "react";

/** Pixels of the layout viewport the visual viewport leaves uncovered at the bottom. */
export function keyboardInset(): number {
  if (typeof window === "undefined") return 0;
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  const covered = window.innerHeight - (viewport.height + viewport.offsetTop);
  return Number.isFinite(covered) ? Math.max(0, Math.round(covered)) : 0;
}

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(keyboardInset);

  useEffect(() => {
    const viewport = typeof window === "undefined" ? null : window.visualViewport;
    const update = () => setInset(keyboardInset());
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return inset;
}
