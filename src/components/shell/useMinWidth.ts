/* UI-P16 — viewport-width queries as booleans, read synchronously.

   WHY NOT `useIsMobile`. That hook starts `false` and corrects itself in an
   effect, so a phone's first render is the desktop one; wide content then makes
   mobile browsers widen the layout viewport, `innerWidth` stays ≥768 and the
   hook never flips back. These read `matchMedia` on the first client render, so
   the frame picks the right chrome before anything can overflow. Server and
   jsdom (no matchMedia) read as wide. */

import { useSyncExternalStore } from "react";

function useMedia(query: string, fallback: boolean): boolean {
  const subscribe = (onChange: () => void) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
  const read = () =>
    typeof window === "undefined" || typeof window.matchMedia !== "function" ? fallback : window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, read, () => fallback);
}

export function useMinWidth(px: number): boolean {
  return useMedia(`(min-width: ${px}px)`, true);
}

/** True below the app's 768px breakpoint. */
export function useIsPhone(): boolean {
  return useMedia("(max-width: 767px)", false);
}
