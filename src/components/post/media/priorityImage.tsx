/* UX-01 P6: the largest image in the first screen is fetched at once, and the rest are lazy.

   A scope (the feed's list) hands out one claim. The first picture that asks, by its address, is the priority image: it gets
   `fetchPriority="high"` and no `loading="lazy"`. It is the first picture of the first post that has one, which on Home is the
   largest of the first screen. Every other picture, and any picture outside a scope, keeps `loading="lazy"` and
   `decoding="async"`. Nothing here changes how an image appears: no opacity, no fade. */

import { createContext, useContext, useRef, type ReactNode } from "react";

const PriorityContext = createContext<{ claimed: string | null } | null>(null);

export function PriorityImageScope({ children }: { children: ReactNode }) {
  const state = useRef<{ claimed: string | null }>({ claimed: null });
  return <PriorityContext.Provider value={state.current}>{children}</PriorityContext.Provider>;
}

/** The attributes for an `<img>` at `src`: priority for the scope's one claim, lazy for everything else. Idempotent per address. */
export function imageLoading(scope: { claimed: string | null } | null, src: string | null): { loading?: "lazy"; fetchPriority?: "high"; decoding: "async" } {
  if (scope && src) {
    scope.claimed ??= src;
    if (scope.claimed === src) return { fetchPriority: "high", decoding: "async" };
  }
  return { loading: "lazy", decoding: "async" };
}

export function useImageLoading(src: string | null) {
  return imageLoading(useContext(PriorityContext), src);
}
