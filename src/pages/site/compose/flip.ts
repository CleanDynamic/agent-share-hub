/* CA-21: sliding by measuring. Nothing here animates a layout property: a thing that moved is put back where it was with a
   `transform` and let go to `none`, over `FAST` in `STANDARD` easing (Web Animations, so nothing is left in a style attribute).
   Under reduced motion nothing slides: the thing is simply where it now is. */

import { BASE, prefersReducedMotion, STANDARD } from "@/lib/theme/motion";

import { SLIDE_MS } from "@/lib/build/buildMotion";

export interface Spot {
  x: number;
  y: number;
}

export interface Box extends Spot {
  w: number;
  h: number;
}

export const SLIDE_ATTR = "data-slide-id";

const boxOf = (element: Element): Box => {
  const r = element.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/** Where everything that can slide is now, as it looks (a thing still sliding is where it looks to be). */
export function snapshot(root: ParentNode): Map<string, Box> {
  const out = new Map<string, Box>();
  for (const element of root.querySelectorAll<HTMLElement>(`[${SLIDE_ATTR}]`)) out.set(element.getAttribute(SLIDE_ATTR) as string, boxOf(element));
  return out;
}

/** Stop what is sliding, so the next measure reads where things stand. */
export function settle(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>(`[${SLIDE_ATTR}]`)) {
    if (typeof element.getAnimations === "function") for (const animation of element.getAnimations()) if ((animation as Animation & { id?: string }).id === "slide") animation.cancel();
  }
}

/** CA-22: whatever is sliding finishes at once, so the next measure reads where things now stand and the next change starts clean. */
export function finishSlides(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>(`[${SLIDE_ATTR}]`)) {
    if (typeof element.getAnimations === "function") for (const animation of element.getAnimations()) if ((animation as Animation & { id?: string }).id === "slide") animation.finish();
  }
}

/** One element from `from` to where it is now: a translate, and a scale where its size changed (a lane). */
export function animateFrom(element: HTMLElement, from: Box, to: Box, ms: number = SLIDE_MS, delay = 0): Animation | null {
  if (prefersReducedMotion() || typeof element.animate !== "function") return null;
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const sx = to.w > 0 ? from.w / to.w : 1;
  const sy = to.h > 0 ? from.h / to.h : 1;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) return null;
  const animation = element.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: "0 0" }, { transform: "none", transformOrigin: "0 0" }], { duration: ms, easing: STANDARD, id: "slide", ...(delay > 0 ? { delay, fill: "backwards" as const } : null) });
  return animation;
}

/** The new part of an element that grew, revealed from the top down: `clip-path: inset()`, no layout property, no stretching. */
export function grow(element: HTMLElement, by: number, delay = 0): Animation | null {
  if (prefersReducedMotion() || typeof element.animate !== "function") return null;
  return element.animate([{ clipPath: `inset(0 0 ${by}px 0)` }, { clipPath: "inset(0 0 0 0)" }], { duration: BASE, easing: STANDARD, id: "slide", ...(delay > 0 ? { delay, fill: "backwards" as const } : null) });
}

/**
 * Play every slide: what `before` says stood somewhere else slides from there to where it stands now. Resolves how many slid.
 * Call it after the change is in the DOM and before it is painted.
 */
export function play(root: ParentNode, before: ReadonlyMap<string, Box>, ms: number = SLIDE_MS, delay = 0): number {
  settle(root);
  let slid = 0;
  for (const element of root.querySelectorAll<HTMLElement>(`[${SLIDE_ATTR}]`)) {
    const was = before.get(element.getAttribute(SLIDE_ATTR) as string);
    if (!was) continue;
    const now = boxOf(element);
    // Components keep their size; only a lane (which the layer draws) changes it.
    if (animateFrom(element, { ...was, w: now.w, h: now.h }, now, ms, delay)) slid += 1;
    // CA-22: a thing that grew (a tile that took a nested row, a tile converted to a taller kind) opens down over `BASE`: its new part is revealed by `clip-path`, nothing is stretched.
    if (now.h - was.h > 1) grow(element, now.h - was.h, delay);
  }
  return slid;
}
