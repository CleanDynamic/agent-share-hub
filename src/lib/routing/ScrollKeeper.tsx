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
// G1 to G3: WHERE FOCUS GOES. A new page (a push or a Back/Forward to another pathname) puts focus on its h1, made a
// programmatic target (tabIndex -1, no outline), so a screen reader says the page's name and the next Tab goes into it.
// An address with a `#hash` puts it on that anchor instead, on a new page or the same one. A change of query string on
// the same page, and a replace (/compose/new becoming /compose/{id}), leave focus alone. An h1 not drawn yet (a loading
// page) is waited for, and a hidden placeholder h1 (`data-h1-placeholder`) hands focus to the real one when it comes,
// unless the person has moved focus in the meantime (D1, G2). The editor is the one exception (D1): focus goes to its
// "Skip to build", and the page's title is said once through the polite line below.
//
// The browser's own restoration is switched off (`history.scrollRestoration = "manual"`) so it does not put the old
// page's position on the new one before React has drawn it. Storage can be missing or full: every read and write is in
// try/catch, and a page that cannot be put back opens at the top.

import { useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";

import { dockSectionOf, isPhoneView, readDockScroll, saveDockScroll } from "./dockScroll";
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

/* ── G1 to G3: focus after a page change ── */

/** A loading page's stand-in for its title (G2): focus may rest on it until the real h1 replaces it. */
export const H1_PLACEHOLDER = "data-h1-placeholder";
/** How long a page change keeps looking for its target while the page loads. */
export const FOCUS_WAIT_MS = 15_000;
const SKIP_TO_BUILD = '[data-testid="skip-to-build"]';

/** The page's h1: the real one when it is drawn, else its placeholder. */
function pageHeading(): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>("main h1"));
  if (all.length === 0) all.push(...Array.from(document.querySelectorAll<HTMLElement>("h1")));
  return all.find((h) => !h.hasAttribute(H1_PLACEHOLDER)) ?? all[0] ?? null;
}

const isPlaceholder = (el: Element | null): boolean => Boolean(el?.hasAttribute(H1_PLACEHOLDER));

/** Focus `el` as a programmatic target: out of the Tab order when it was not in it, no outline, no scroll (the keeper scrolls). */
function takeFocus(el: HTMLElement): void {
  if (!el.matches('a[href], button, input, select, textarea, [tabindex]')) el.setAttribute("tabindex", "-1");
  if (el.tabIndex < 0) el.style.outline = "none";
  el.focus({ preventScroll: true });
}

/**
 * Put focus on `pick()`'s element now, or when it is drawn, for up to FOCUS_WAIT_MS. While waiting, focus that falls to the
 * body or rests on a placeholder h1 is moved on; focus the person moved themselves ends the wait. Returns the stop.
 */
function settleFocus(pick: () => HTMLElement | null, onFound?: () => boolean): () => void {
  const started = document.activeElement;
  let owned: Element | null = null;
  let stopped = false;
  const moved = () => {
    const now = document.activeElement;
    return Boolean(now && now !== document.body && now !== owned && now !== started && !isPlaceholder(now));
  };
  const attempt = () => {
    if (stopped) return;
    if (onFound && onFound()) onFound = undefined;
    if (moved()) return stop();
    const now = document.activeElement;
    const target = pick();
    if (!target || target === now) return;
    if (now && now !== document.body && now !== started && now !== owned && !isPlaceholder(now)) return stop();
    owned = target;
    takeFocus(target);
  };
  const watch = new MutationObserver(attempt);
  const timer = window.setTimeout(() => stop(), FOCUS_WAIT_MS);
  function stop() {
    stopped = true;
    watch.disconnect();
    window.clearTimeout(timer);
  }
  watch.observe(document.body, { childList: true, subtree: true });
  attempt();
  return stop;
}

const anchorOf = (hash: string): HTMLElement | null => {
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
};

let manual = false;

export function ScrollKeeper() {
  const location = useLocation();
  const type = useNavigationType();
  const shown = useRef(location.key);
  const lastPath = useRef(location.pathname);
  const lastHash = useRef(location.hash);
  /** D1: the editor's title, said once through the polite line after a page change. */
  const [said, setSaid] = useState("");

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
        // 29c: a dock tab's root page keeps its own position for the visit.
        const section = dockSectionOf(window.location.pathname);
        if (section && isPhoneView()) saveDockScroll(section, window.scrollY);
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
    // G3: a plain `<a href="#…">` makes an entry with no key of the router's, so a new hash is a change too.
    if (shown.current === location.key && lastPath.current === location.pathname && lastHash.current === location.hash) return;
    shown.current = location.key;
    const samePage = lastPath.current === location.pathname;
    const sameHash = lastHash.current === location.hash;
    lastPath.current = location.pathname;
    lastHash.current = location.hash;

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

    if (type === "POP" && samePage && location.hash && !sameHash) {
      // G3: a fragment link on this page (a plain `<a href="#…">`, the skip link) is a pop with a hash: to the anchor.
      later(() => toHash(location.hash));
    } else if (type === "POP") {
      const y = readScroll(location.key);
      if (y === null) instant(0);
      else later(() => restore(y));
    } else if (type === "PUSH" && !samePage) {
      if (location.hash) {
        instant(0);
        later(() => toHash(location.hash));
      } else {
        // 29c: a dock tab opens where it was left, once its content is drawn (after the first paint).
        const section = isPhoneView() ? dockSectionOf(location.pathname) : null;
        const y = section ? readDockScroll(section) : null;
        if (y && y > 0) {
          instant(0);
          // Now if the page is tall enough; else once it is ready, and once more after the first paint.
          later(() => restore(y));
          window.requestAnimationFrame(() => restore(y));
        } else instant(0);
      }
    }

    // G1 to G3: focus. A replace and a change of query string on the same page leave it where it is.
    let stopFocus: (() => void) | null = null;
    if (type !== "REPLACE" && location.hash && (!samePage || !sameHash)) {
      stopFocus = settleFocus(() => anchorOf(location.hash));
    } else if (type !== "REPLACE" && !samePage) {
      const editor = document.querySelector<HTMLElement>(SKIP_TO_BUILD);
      if (editor) {
        setSaid("");
        stopFocus = settleFocus(
          () => document.querySelector<HTMLElement>(SKIP_TO_BUILD),
          () => {
            const heading = pageHeading();
            if (!heading || isPlaceholder(heading)) return false;
            setSaid((heading.textContent ?? "").trim());
            return true;
          },
        );
      } else stopFocus = settleFocus(pageHeading);
    }
    return () => {
      wait?.();
      stopFocus?.();
    };
  }, [location.key, location.pathname, location.hash, type]);

  return (
    <div data-testid="page-said" aria-live="polite" style={VISUALLY_HIDDEN}>
      {said}
    </div>
  );
}

export default ScrollKeeper;
