// The header's shrink (motion prompt 04): 88 tall at the top of a page, 56 once the page scrolls. Under reduced motion it is
// 56 from the start. Only the logo animates (`transform`, in SiteHeader); the height itself steps, so no layout property
// is ever animated. `scroll-padding-top` follows the height so an anchor or a focused field never lands under the header.

import { useEffect, useState } from "react";

import { prefersReducedMotion } from "@/lib/theme/motion";

import { HEADER_COMPACT_HEIGHT, headerHeight } from "./chromeSize";

const scrolled = () => typeof window !== "undefined" && window.scrollY > 0;

/** True once the page has scrolled, or always under reduced motion. */
export function useHeaderCompact(): boolean {
  const [compact, setCompact] = useState(() => prefersReducedMotion() || scrolled());
  useEffect(() => {
    if (prefersReducedMotion()) {
      setCompact(true);
      return;
    }
    const read = () => setCompact(scrolled());
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);
  return compact;
}

/** The header's height on this viewport right now, and `scroll-padding-top` kept equal to it. */
export function useHeaderHeight(phone: boolean): number {
  const compact = useHeaderCompact();
  const height = phone ? headerHeight(true) : compact ? HEADER_COMPACT_HEIGHT : headerHeight(false);
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.scrollPaddingTop;
    root.style.scrollPaddingTop = `${height}px`;
    return () => {
      root.style.scrollPaddingTop = before;
    };
  }, [height]);
  return height;
}
