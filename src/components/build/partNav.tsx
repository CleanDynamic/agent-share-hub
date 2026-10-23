// partNav: finding a tile or a session on the page, and bringing it to the middle (CA-06 P3).
//
// A link in the post names a part by its `to`. The List, the Map and the build page register the element that draws
// each part here, by that `to`, through a ref: nothing is added to their markup, so a build with no links draws as it
// did. `centre` scrolls an element to the middle of the window (and of the map's well), smoothly unless the reader
// prefers reduced motion.

import { createContext, useCallback, useContext, type ReactNode } from "react";

import { scrollBehavior } from "@/lib/theme/motion";

export type PartRegistry = Map<string, HTMLElement>;

const PartRegistryContext = createContext<PartRegistry | null>(null);

export function PartRegistryProvider({ registry, children }: { registry: PartRegistry; children: ReactNode }) {
  return <PartRegistryContext.Provider value={registry}>{children}</PartRegistryContext.Provider>;
}

/** A ref that registers the element drawing `to`; it does nothing outside a provider, or for null. */
export function usePartRef(to: string | null): (el: HTMLElement | null) => void {
  const registry = useContext(PartRegistryContext);
  return useCallback(
    (el: HTMLElement | null) => {
      if (!registry || !to) return;
      if (el) registry.set(to, el);
      else if (registry.get(to)?.isConnected === false) registry.delete(to);
    },
    [registry, to],
  );
}

/** Registers elements by `to` from inside a loop, where a hook per element cannot be called. */
export function usePartRegister(): (to: string, el: HTMLElement | null) => void {
  const registry = useContext(PartRegistryContext);
  return useCallback(
    (to: string, el: HTMLElement | null) => {
      if (!registry) return;
      if (el) registry.set(to, el);
      else if (registry.get(to)?.isConnected === false) registry.delete(to);
    },
    [registry],
  );
}

/** Two refs as one. */
export function bothRefs<T>(...refs: ((el: T | null) => void)[]): (el: T | null) => void {
  return (el) => refs.forEach((ref) => ref(el));
}

/** The nearest box round an element that scrolls sideways (the map's well), or null. */
function sidewaysBox(el: HTMLElement): HTMLElement | null {
  for (let at = el.parentElement; at && at !== document.body; at = at.parentElement) {
    const overflow = getComputedStyle(at).overflowX;
    if ((overflow === "auto" || overflow === "scroll") && at.scrollWidth > at.clientWidth) return at;
  }
  return null;
}

/** Scrolls an element to the middle of the window, and across to the middle of a box that scrolls sideways. */
export function centre(el: HTMLElement): void {
  const behavior = scrollBehavior();
  const box = sidewaysBox(el);
  if (box) {
    const inner = el.getBoundingClientRect();
    const outer = box.getBoundingClientRect();
    box.scrollTo?.({ left: box.scrollLeft + (inner.left + inner.width / 2) - (outer.left + outer.width / 2), behavior });
  }
  // Never sideways in the window: the page itself does not scroll across.
  el.scrollIntoView?.({ block: "center", inline: "nearest", behavior });
}

/** The element drawing `to`, if it is on the page now. */
export function partElement(registry: PartRegistry, to: string): HTMLElement | null {
  const el = registry.get(to);
  return el && el.isConnected ? el : null;
}

/** The element itself when it takes focus, else the nearest one round it that does. */
export function focusable(el: HTMLElement): HTMLElement {
  if (el.tabIndex >= 0) return el;
  let at: HTMLElement | null = el.parentElement;
  while (at && at.tabIndex < 0) at = at.parentElement;
  return at ?? el;
}

/**
 * CA-19 P3, Go to the group: every member is outlined and the rest of the parts drawn here are dimmed, until Escape (or the
 * next call). A part holding a member is not dimmed itself (its other parts are), so a tile in a session stays bright.
 * Returns what puts it all back. Straight on the elements, as `flashOutline` is: nothing in the List or the map re-renders.
 */
export function focusGroup(registry: PartRegistry, members: readonly string[], dimFilter: string, ring: { width: number | string; style: string; colour: string; offset: number | string }): () => void {
  stopFocusGroup?.();
  const memberEls = members.flatMap((to) => {
    const el = partElement(registry, to);
    return el ? [el] : [];
  });
  const touched: { el: HTMLElement; filter: string; was: [string, string, string, string] }[] = [];
  const keep = (el: HTMLElement) => touched.push({ el, filter: el.style.filter, was: [el.style.outlineWidth, el.style.outlineStyle, el.style.outlineColor, el.style.outlineOffset] });
  for (const el of memberEls) {
    keep(el);
    const px = (value: number | string) => (typeof value === "number" ? `${value}px` : value);
    el.style.outlineWidth = px(ring.width);
    el.style.outlineStyle = ring.style;
    el.style.outlineColor = ring.colour;
    el.style.outlineOffset = px(ring.offset);
    el.setAttribute("data-group-focus", "member");
  }
  for (const [to, el] of registry) {
    if (!el.isConnected || members.includes(to)) continue;
    if (memberEls.some((member) => el.contains(member) || member.contains(el))) continue;
    keep(el);
    el.style.filter = dimFilter;
    el.setAttribute("data-group-focus", "dimmed");
  }
  const restore = () => {
    for (const { el, filter, was } of touched) {
      el.style.filter = filter;
      [el.style.outlineWidth, el.style.outlineStyle, el.style.outlineColor, el.style.outlineOffset] = was;
      el.removeAttribute("data-group-focus");
    }
    document.removeEventListener("keydown", onKey, true);
    if (stopFocusGroup === restore) stopFocusGroup = null;
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") restore();
  };
  document.addEventListener("keydown", onKey, true);
  stopFocusGroup = restore;
  if (memberEls[0]) centre(memberEls[0]);
  return restore;
}

let stopFocusGroup: (() => void) | null = null;
