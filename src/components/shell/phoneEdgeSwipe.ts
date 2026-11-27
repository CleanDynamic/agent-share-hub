// 29e: the edge swipe back's rules, pure. A touch starting within EDGE_PX of the left edge and moving right drags the pushed
// page with the finger. Released past 35% of the width, or faster than 0.5 px/ms, it completes over the remaining fraction of
// PHONE_STANDARD; otherwise it returns over the fraction it had travelled.

import { PHONE_STANDARD } from "@/lib/theme/motion";

export const EDGE_PX = 20;
export const COMPLETE_FRACTION = 0.35;
export const COMPLETE_VELOCITY = 0.5;

export type SwipeEnd = { back: boolean; ms: number };

/** `dx` travelled, `velocity` in px/ms at release, `width` of the screen. */
export function swipeEnd(dx: number, velocity: number, width: number): SwipeEnd {
  const progress = Math.min(1, Math.max(0, dx / Math.max(1, width)));
  const back = progress > COMPLETE_FRACTION || velocity > COMPLETE_VELOCITY;
  const fraction = back ? 1 - progress : progress;
  return { back, ms: Math.round(PHONE_STANDARD * Math.max(0.15, fraction)) };
}

/** Where the custom swipe is on: everywhere except iOS Safari in a browser tab, where Safari's own back swipe works. */
export function edgeSwipeEnabled(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches);
  const native = Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  return !ios || standalone || native;
}
