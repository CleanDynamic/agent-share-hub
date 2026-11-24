// The phone's top bar and page tabs get out of the way on scroll, as on X (prompt 20). One store for the frame: the page that
// owns a feed turns the behaviour on with `useHideBarsOnScroll`, the frame's header slot and the page's sticky tabs read
// `useBarsHidden`. Scrolling down more than 52 hides both together; any scroll up brings them back. They never hide while the
// page is at the top, while a sheet is open, or with reduced motion on. The dock never hides.

import { useEffect, useSyncExternalStore } from "react";

import { prefersReducedMotion } from "@/lib/theme/motion";

import { PHONE_TAB, PHONE_TOPBAR } from "./chromeSize";

/** How far the page scrolls down before the bars leave. */
export const HIDE_AFTER_PX = 52;
/** What the page's tabs travel: the top bar and the tabs together. */
export const HIDE_TRAVEL = PHONE_TOPBAR + PHONE_TAB;

let hidden = false;
const listeners = new Set<() => void>();
const set = (next: boolean) => {
  if (hidden === next) return;
  hidden = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether the bars are out of the way now. */
export function useBarsHidden(): boolean {
  return useSyncExternalStore(subscribe, () => hidden, () => false);
}

/** Pure: the next hidden state for a scroll from `last` to `y`. */
export function nextHidden(was: boolean, last: number, y: number, blocked: boolean): boolean {
  if (blocked || y <= 0) return false;
  if (y > last) return was || y > HIDE_AFTER_PX;
  if (y < last) return false;
  return was;
}

/** Turns the behaviour on while the calling page is mounted. `blocked`: a sheet is open. */
export function useHideBarsOnScroll(blocked = false): void {
  useEffect(() => {
    if (blocked || prefersReducedMotion()) {
      set(false);
      return;
    }
    let last = window.scrollY;
    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      set(nextHidden(hidden, last, y, false));
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      set(false);
    };
  }, [blocked]);
}
