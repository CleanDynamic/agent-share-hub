// SV-04 P5: a page's content arriving over its loading state, in the same slot.
//
// While `loading`, the page draws its loading state (the route's Placeholder has the same shape). When the first-screen
// data is in, the content is drawn and fades in over CONTENT_IN_MS while a copy of the loading state, laid over it at the same
// place, fades out over BLOCKS_OUT_MS, both on STANDARD, and is then taken away. The loading state is not removed before the
// content is drawn, and the two hold the same boxes (the placeholders' match test), so nothing moves. A page that was
// never loading when it mounted (its data in the cache), reduced motion, and an engine that cannot animate, get the
// content at once.
//
// THE PAGE'S ELEMENTS NEVER MOVE IN THE TREE, so nothing under them mounts again (a field keeps what is typed in it): a
// hidden marker stands before them and the copy after them, always in the same places. The copy is placed over the
// page's first element, which the marker finds, inside `<main>` (positioned); the content's fade is set on that element.
// The two fades are the page change's own keyframes (`bgPageIn`, `bgPageOut` in index.css): opacity only. The composer
// has its own arrival, ComposeArrival, which does the same for its building blocks.

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { BLOCKS_OUT_MS, CONTENT_IN_MS } from "@/pages/site/compose/loadingBlocks";
import { STANDARD, prefersReducedMotion } from "@/lib/theme/motion";

// The dots fade out over BLOCKS_OUT_MS while the content fades in over CONTENT_IN_MS, in place.
const IN = `bgPageIn ${CONTENT_IN_MS}ms ${STANDARD} both`;

export function PageArrival({ loading, placeholder, children }: { loading: boolean; placeholder: ReactNode; children: ReactNode }) {
  const [was] = useState(loading);
  const [reduced] = useState(() => prefersReducedMotion() || typeof Element.prototype.animate !== "function");
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const [done, setDone] = useState(false);
  const marker = useRef<HTMLSpanElement>(null);
  const fading = was && !loading && !reduced && !done;

  useLayoutEffect(() => {
    if (!fading) return;
    const content = marker.current?.nextElementSibling as HTMLElement | null;
    if (!content) {
      setDone(true);
      return;
    }
    setPlace({ top: content.offsetTop, left: content.offsetLeft, width: content.offsetWidth, height: content.offsetHeight });
    content.style.animation = IN;
    // The copy goes when its fade has ended; this is for a fade that never reports it (a hidden tab).
    const fallback = window.setTimeout(() => setDone(true), Math.max(BLOCKS_OUT_MS, CONTENT_IN_MS) + 400);
    return () => {
      window.clearTimeout(fallback);
      if (content.style.animation === IN) content.style.animation = "";
    };
  }, [fading]);

  return (
    <>
      <span ref={marker} hidden />
      {children}
      {fading && place ? (
        <div
          aria-hidden="true"
          data-testid="page-arrival-placeholder"
          onAnimationEnd={() => setDone(true)}
          style={{ position: "absolute", ...place, overflow: "hidden", pointerEvents: "none", animation: `bgPageOut ${BLOCKS_OUT_MS}ms ${STANDARD} both` }}
        >
          {placeholder}
        </div>
      ) : null}
    </>
  );
}

export default PageArrival;
