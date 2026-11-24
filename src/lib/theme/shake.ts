// Prompt 24: the one shake, for the first missing field when a phone's form is sent too early. 4px either way, once, over FAST on
// STANDARD; transform only; nothing under reduced motion.

import { FAST, STANDARD, prefersReducedMotion } from "./motion";

export const SHAKE_PX = 4;

export function shakeOnce(node: HTMLElement | null): void {
  if (!node || prefersReducedMotion() || typeof node.animate !== "function") return;
  node.animate(
    [{ transform: "translateX(0)" }, { transform: `translateX(-${SHAKE_PX}px)` }, { transform: `translateX(${SHAKE_PX}px)` }, { transform: "translateX(0)" }],
    { duration: FAST, easing: STANDARD },
  );
}
