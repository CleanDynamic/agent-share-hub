import { useEffect, useState } from "react";

/**
 * useBreakpoint
 *
 * Returns the current responsive tier for the app shell:
 *   - 'xl'     ≥ 1280px — full three-column desktop
 *   - 'lg'     1024–1279px — left rail + centre (right rail in drawer)
 *   - 'md'     768–1023px — collapsed left rail + centre (right rail in drawer)
 *   - 'mobile' < 768px — mobile chrome (top bar + bottom nav)
 *
 * Updates in real time on window resize.
 */
export type Breakpoint = "xl" | "lg" | "md" | "mobile";

function compute(width: number): Breakpoint {
  if (width >= 1280) return "xl";
  if (width >= 1024) return "lg";
  if (width >= 768) return "md";
  return "mobile";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    typeof window === "undefined" ? "xl" : compute(window.innerWidth),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setBp(compute(window.innerWidth));
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return bp;
}
