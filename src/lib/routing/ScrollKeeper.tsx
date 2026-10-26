// SV-04 P6: where a page is scrolled to. Placed once inside the router.
//
//   A new page (a push to another pathname) opens at the top, or at its `#hash` when it has one.
//   Back and Forward put the page where it was: the position is kept per history entry in sessionStorage as
//   `scroll:v1:<entry key>` -> `{ y }`, and put back in the same frame the page is drawn, with `behavior: "instant"`. A
//   page whose content is not in yet (its height is still its placeholder's) is put back when it says it is ready
//   (`usePageReady`), so it never shows at the top and then jumps.
//   A replace (/compose/new becoming /compose/{id}) and a change of parameters on the same page (a tab, a filter) leave
//   the scroll alone. The composer scrolls itself from there (SV-06's scroll helper).
//
// The browser's own restoration is switched off (`history.scrollRestoration = "manual"`) so it does not put the old
// page's position on the new one before React has drawn it. Storage can be missing or full: every read and write is in
// try/catch, and a page that cannot be put back opens at the top.

import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

import { PAGE_READY_EVENT } from "./pageReady";

const KEY = (entry: string) => `scroll:v1:${entry}`;

export function readScroll(entry: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(KEY(entry));
    if (!raw) return null;
    const value = (JSON.parse(raw) as { y?: unknown }).y;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeScroll(entry: string, y: number): void {
  try {
    window.sessionStorage.setItem(KEY(entry), JSON.stringify({ y: Math.round(y) }));
  } catch {
    /* storage refused: Back opens this page at the top */
  }
}

const instant = (top: number) => window.scrollTo({ top, left: 0, behavior: "instant" as ScrollBehavior });

/** Put the page at `y`; true when it got there (the page is already tall enough). */
function restore(y: number): boolean {
  instant(y);
  return Math.abs(window.scrollY - y) <= 4;
}

function toHash(hash: string): boolean {
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return false;
  // The target's own `scroll-margin-top` keeps it clear of the sticky header.
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  instant(target.getBoundingClientRect().top + window.scrollY - margin);
  return true;
}

let manual = false;

export function ScrollKeeper() {
  const location = useLocation();
  const type = useNavigationType();
  const shown = useRef(location.key);
  const lastPath = useRef(location.pathname);

  if (!manual && typeof window !== "undefined" && "scrollRestoration" in window.history) {
    manual = true;
    window.history.scrollRestoration = "manual";
  }

  // The position of the entry on screen, as the reader scrolls it (one write a frame at most).
  useLayoutEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        writeScroll(shown.current, window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // The first page of a visit with a `#hash`: the browser looked for the target before the page was drawn.
  useLayoutEffect(() => {
    if (!location.hash) return;
    const onReady = () => {
      toHash(location.hash);
    };
    if (toHash(location.hash)) return;
    window.addEventListener(PAGE_READY_EVENT, onReady, { once: true });
    return () => window.removeEventListener(PAGE_READY_EVENT, onReady);
    // Once, for the address the visit opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    // The page being left was written as it was scrolled; reading it here would read the new page's height.
    if (shown.current === location.key) return;
    shown.current = location.key;
    const samePage = lastPath.current === location.pathname;
    lastPath.current = location.pathname;

    let wait: (() => void) | null = null;
    // Now if the page is drawn; else once it says it is ready, as far as it then goes.
    const later = (attempt: () => boolean) => {
      if (attempt()) return;
      const onReady = () => {
        attempt();
      };
      window.addEventListener(PAGE_READY_EVENT, onReady, { once: true });
      wait = () => window.removeEventListener(PAGE_READY_EVENT, onReady);
    };

    if (type === "POP") {
      const y = readScroll(location.key);
      if (y === null) instant(0);
      else later(() => restore(y));
    } else if (type === "PUSH" && !samePage) {
      if (location.hash) {
        instant(0);
        later(() => toHash(location.hash));
      } else instant(0);
    }
    return () => wait?.();
  }, [location.key, location.pathname, location.hash, type]);

  return null;
}

export default ScrollKeeper;
