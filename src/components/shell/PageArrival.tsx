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

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { ErrorState } from "@/components/brand/ErrorState";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { BLOCKS_OUT_MS, CONTENT_IN_MS } from "@/pages/site/compose/loadingBlocks";
import { STANDARD, prefersReducedMotion } from "@/lib/theme/motion";

// The dots fade out over BLOCKS_OUT_MS while the content fades in over CONTENT_IN_MS, in place.
const IN = `bgPageIn ${CONTENT_IN_MS}ms ${STANDARD} both`;

/** 29c: on a phone no loading state stays longer than this. Then the page's failed state is drawn in its place. */
export const SKELETON_CEILING_MS = 8000;

/**
 * 29c: the phone's ceiling. After SKELETON_CEILING_MS of `loading` the page says "That didn't load." with "Try again"
 * in the loading state's place. The queries keep running: data that arrives later ends `loading`, and the content
 * replaces the failed state. Desktop is not touched.
 */
export function useLoadingCeiling(loading: boolean): boolean {
  const phone = useIsPhone();
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!phone || !loading) {
      setLate(false);
      return;
    }
    const timer = window.setTimeout(() => setLate(true), SKELETON_CEILING_MS);
    return () => window.clearTimeout(timer);
  }, [phone, loading]);
  return phone && loading && late;
}

export function PageArrival({
  loading,
  placeholder,
  children,
  region = "This page",
  onRetry,
}: {
  loading: boolean;
  placeholder: ReactNode;
  children: ReactNode;
  /** The failed state's panel name, said to a screen reader. */
  region?: string;
  /** Try again. Without it every query on screen is asked again. */
  onRetry?: () => void;
}) {
  const queryClient = useQueryClient();
  const timedOut = useLoadingCeiling(loading);
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
      {timedOut ? (
        <ErrorState panel={region} data-testid="page-arrival-failed" style={{ padding: 16 }} onRetry={onRetry ?? (() => void queryClient.refetchQueries({ type: "active" }))} />
      ) : (
        children
      )}
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
