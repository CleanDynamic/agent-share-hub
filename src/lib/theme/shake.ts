// Prompt 24: the one shake, for the first missing field when a phone's form is sent too early. 4px either way, once, over FAST on
// STANDARD; transform only; nothing under reduced motion.

import { FAST, REVEAL, STANDARD, prefersReducedMotion } from "./motion";

export const SHAKE_PX = 4;

export function shakeOnce(node: HTMLElement | null): void {
  if (!node || prefersReducedMotion() || typeof node.animate !== "function") return;
  node.animate(
    [{ transform: "translateX(0)" }, { transform: `translateX(-${SHAKE_PX}px)` }, { transform: `translateX(${SHAKE_PX}px)` }, { transform: "translateX(0)" }],
    { duration: FAST, easing: STANDARD },
  );
}

/** Prompt 24: "Go to it" from a reference group: the tile's colour shows once round it over REVEAL, by opacity only, on a ring
    laid over the tile (so nothing about the tile itself animates). Nothing under reduced motion. */
export function pulseColour(node: HTMLElement | null, colour: string): void {
  if (!node || prefersReducedMotion() || typeof document === "undefined") return;
  const ring = document.createElement("span");
  ring.setAttribute("aria-hidden", "true");
  ring.setAttribute("data-colour-pulse", "");
  const box = node.getBoundingClientRect();
  Object.assign(ring.style, {
    position: "fixed",
    left: `${box.left - 3}px`,
    top: `${box.top - 3}px`,
    width: `${box.width + 6}px`,
    height: `${box.height + 6}px`,
    boxSizing: "border-box",
    border: `3px solid ${colour}`,
    borderRadius: "12px",
    pointerEvents: "none",
    zIndex: "30",
    opacity: "0",
  });
  document.body.append(ring);
  if (typeof ring.animate !== "function") {
    ring.remove();
    return;
  }
  const run = ring.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: REVEAL, easing: STANDARD });
  run.onfinish = () => ring.remove();
  run.oncancel = () => ring.remove();
}
