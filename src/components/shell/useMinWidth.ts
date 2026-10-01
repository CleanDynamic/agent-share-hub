/* UI-P16 — `(min-width: Npx)` as a boolean, for the one place the frame's
   padding changes at a width the 768px breakpoint hook does not cover. Server
   and jsdom (no matchMedia) read as wide. */

import { useSyncExternalStore } from "react";

export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const subscribe = (onChange: () => void) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
  const read = () =>
    typeof window === "undefined" || typeof window.matchMedia !== "function" ? true : window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, read, () => true);
}
