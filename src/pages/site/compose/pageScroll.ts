/* SV-06 P7: the build page's one scroll helper. Go to it, Find, an arrival off screen and the session jump tabs all scroll through it.

   It uses the browser's own smooth scroll (`window.scrollTo` with `behavior: "smooth"`; `index.css` keeps `scroll-behavior: auto`),
   and it yields to the maker: it stops the moment they scroll, touch, press a key or grab the scrollbar, and it never starts within
   `YIELD_MS` of their own scrolling. It scrolls only when the target is not wholly in view, by the least distance that brings it
   there (`nearest`), to the middle (`middle`, Go to it and Find) or to the top (`start`, a jump tab). An arrival scrolls to the
   bottom edge of what it opens under (`edge: "bottom"`), to the middle, so the lane opening there is seen. In a windowed build the tiles
   above a far target are guessed at and shift as the scroll passes them: with `hold`, `largeBuild.tsx`'s `settle` keeps the target
   where it was sent for a moment, and stops on the maker's input too. Under reduced motion it jumps. */

import { prefersReducedMotion } from "@/lib/theme/motion";

import { settle } from "./largeBuild";
import { untilScrollEnds } from "./listMotion";

/** A helper scroll never starts this soon after the maker's own scrolling. */
export const YIELD_MS = 300;

export type Align = "nearest" | "middle" | "start";

export interface ScrollRun {
  /** Resolves when the scroll has ended, been stopped by the maker, or was not needed. Never rejects. */
  finished: Promise<void>;
  /** Whether it scrolls at all. */
  moved: boolean;
  /** Stop where it is now, and stop holding. */
  cancel: () => void;
}

const NOWHERE: ScrollRun = { finished: Promise.resolve(), moved: false, cancel: () => undefined };

/** Inputs that stop a helper scroll at once. */
const STOPS = ["wheel", "touchstart", "touchmove", "keydown", "pointerdown"] as const;
/** Keys that scroll the page. */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"]);

/** When the maker last scrolled by their own hand: a wheel, a touch moving, a key that scrolls, or a grab of the page's scrollbar. */
let makerAt = Number.NEGATIVE_INFINITY;
let watching = false;

function watchMaker() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  // Passive: these only note the time, and never call `preventDefault`.
  window.addEventListener("wheel", () => (makerAt = now()), { capture: true, passive: true });
  window.addEventListener("touchmove", () => (makerAt = now()), { capture: true, passive: true });
  window.addEventListener("keydown", (event) => SCROLL_KEYS.has(event.key) && (makerAt = now()), { capture: true, passive: true });
  // The page's own scrollbar is pressed on the root element.
  window.addEventListener("pointerdown", (event) => event.target === document.documentElement && (makerAt = now()), { capture: true, passive: true });
}

/** Whether the maker has scrolled in the last `YIELD_MS`. */
export const makerScrolling = (): boolean => (typeof performance !== "undefined" ? performance.now() : Date.now()) - makerAt < YIELD_MS;

/** Tests. */
export function __resetPageScroll(): void {
  makerAt = Number.NEGATIVE_INFINITY;
}

const viewHeight = () => window.innerHeight || 0;

/**
 * How far the window must scroll to show `box` as `align` asks; 0 when it is in view already. SV-07 P3: `offset` is where "start"
 * puts the top, below what is sticky at the top of the window.
 */
export function scrollNeeded(box: { top: number; bottom: number; height: number }, align: Align, height: number = viewHeight(), offset = 0): number {
  const whole = box.top >= 0 && box.bottom <= height;
  if (align === "start") return box.top >= offset - 2 && box.top <= offset + 120 ? 0 : box.top - offset;
  if (whole) return 0;
  if (align === "middle") return box.height > height ? box.top : box.top - (height - box.height) / 2;
  if (box.height > height || box.top < 0) return box.top;
  return box.bottom - height;
}

/** What is scrolled to: the element, or only its bottom edge. */
export type Edge = "whole" | "bottom";

const boxOf = (element: HTMLElement, edge: Edge): { top: number; bottom: number; height: number } => {
  const box = element.getBoundingClientRect();
  return edge === "bottom" ? { top: box.bottom, bottom: box.bottom, height: 0 } : box;
};

/** Whether the target still stands where `align` sent it: a held jump puts it back when not. */
const stillThere = (element: HTMLElement, align: Align, offset = 0): boolean => {
  if (!element.isConnected) return true;
  const box = element.getBoundingClientRect();
  const height = viewHeight();
  if (box.height > height) return true;
  if (align === "middle") return Math.abs((box.top + box.bottom) / 2 - height / 2) < 24;
  return scrollNeeded(box, align, height, offset) === 0;
};

const jumpTo = (element: HTMLElement, align: Align, offset = 0) => {
  const by = scrollNeeded(element.getBoundingClientRect(), align, viewHeight(), offset);
  if (Math.abs(by) >= 1) window.scrollTo?.({ top: Math.max(0, window.scrollY + by), behavior: "instant" });
};

/**
 * Scrolls the window so `element` shows as `align` asks, over the browser's smooth scroll. Not at all when it is in view, or when
 * the maker is scrolling. Stops on the maker's input. With `hold`, keeps it there for a moment afterwards (a windowed build).
 */
export function scrollToShow(element: HTMLElement, { align = "nearest", hold = false, edge = "whole", offset = 0 }: { align?: Align; hold?: boolean; edge?: Edge; offset?: number } = {}): ScrollRun {
  if (typeof window === "undefined") return NOWHERE;
  watchMaker();
  const by = scrollNeeded(boxOf(element, edge), align, viewHeight(), offset);
  if (Math.abs(by) < 1 || makerScrolling()) return NOWHERE;
  const top = Math.max(0, window.scrollY + by);
  const reduced = prefersReducedMotion();
  let stopped = false;
  let unhold = () => undefined as void;
  let release = () => undefined as void;
  const stopped$ = new Promise<void>((resolve) => {
    release = resolve;
  });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const name of STOPS) window.removeEventListener(name, onInput, true);
    release();
  };
  // The maker's hand: the scroll stops where it is, and theirs takes over.
  const onInput = () => {
    if (stopped) return;
    window.scrollTo?.({ top: window.scrollY, behavior: "instant" });
    stop();
  };
  if (!reduced) for (const name of STOPS) window.addEventListener(name, onInput, { capture: true, passive: true });
  window.scrollTo?.({ top, behavior: reduced ? "instant" : "smooth" });
  const finished = (reduced ? Promise.resolve() : Promise.race([untilScrollEnds(), stopped$])).then(() => {
    const byHand = stopped;
    stop();
    if (hold && !byHand) unhold = settle(() => stillThere(element, align, offset), () => jumpTo(element, align, offset));
  });
  return {
    finished,
    moved: true,
    cancel: () => {
      unhold();
      if (!stopped) window.scrollTo?.({ top: window.scrollY, behavior: "instant" });
      stop();
    },
  };
}
