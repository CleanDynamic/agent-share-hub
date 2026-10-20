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
