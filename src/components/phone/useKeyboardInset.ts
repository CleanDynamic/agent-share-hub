// How much of the bottom of the screen the on-screen keyboard covers, in CSS pixels, read from the visual viewport. A footer
// pinned to the bottom adds it to ride above the keyboard; the round post button hides while it is open. jsdom and servers
// have no visual viewport and read 0.

import { useSyncExternalStore } from "react";

/** More than this many covered pixels is a keyboard (the browser's own bars move the viewport by less). */
export const KEYBOARD_MIN = 120;

function read(): number {
  if (typeof window === "undefined" || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.visualViewport) return () => {};
  const vv = window.visualViewport;
  vv.addEventListener("resize", onChange);
  vv.addEventListener("scroll", onChange);
  return () => {
    vv.removeEventListener("resize", onChange);
    vv.removeEventListener("scroll", onChange);
  };
}

export function useKeyboardInset(): number {
  const inset = useSyncExternalStore(subscribe, read, () => 0);
  return inset > KEYBOARD_MIN ? inset : 0;
}

export function useKeyboardOpen(): boolean {
  return useKeyboardInset() > 0;
}
