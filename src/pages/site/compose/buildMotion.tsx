/* CA-22 P1: the build page's motion, written once.

   Sixteen moments share five ideas, and each idea is one helper here:

     useFlip       measure, change, then slide what moved from where it stood to where it stands (transforms only)
     useLeaving    keep a removed component on screen, in place, while it lifts out; then let it go, so nothing jumps
     dropIn        anything arriving falls 20 from above and fades in; several arrive `stagger` apart, capped
     outlineOnce   a ring 4 outside the component, drawn by a separate element whose OPACITY is all that changes
     crossfade     words that change: the old words fade out over the new

   They are built on the Web Animations API, so they cancel cleanly. A new change that arrives mid-animation finishes the
   running one at once and then starts, so the end state is always the last change's. Only `transform` and `opacity` are ever
   animated; never a layout property, never `box-shadow`. Under reduced motion nothing moves or fades: every change arrives at once,
   in the same end state (the helpers return an already-finished run). */

import { settle } from "./largeBuild";
import { cloneElement, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from "react";

import {
  CROSSFADE,
  DROP,
  DROP_FALL,
  LIFT,
  LIFT_RISE,
  GOTO_HOLD,
  GOTO_OUT,
  OUTLINE_HOLD,
  OUTLINE_IN,
  OUTLINE_OUT,
  SCROLL_TO,
  SLIDE,
  STAGGER,
  STAGGER_CAP,
} from "@/lib/build/buildMotion";
import { BASE, prefersReducedMotion, STANDARD } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { finishSlides, play, snapshot, type Box } from "./flip";

/* ── a run: what a helper hands back ── */

export interface MotionRun {
  /** Resolves when every animation has ended (or at once, when nothing moved). Never rejects. */
  finished: Promise<void>;
  /** End now, in the end state. */
  finish: () => void;
  /** Stop now and leave nothing behind. */
  cancel: () => void;
}

const DONE: MotionRun = { finished: Promise.resolve(), finish: () => undefined, cancel: () => undefined };

const OURS = "bm:";

const canAnimate = (element: Element): element is HTMLElement => !prefersReducedMotion() && typeof (element as HTMLElement).animate === "function";

/** Whether anything here moves at all: not under reduced motion, and not where the Web Animations API is missing. A hold that waits for a motion that cannot play is only a delay, so none is made. */
export const motionOn = (): boolean => !prefersReducedMotion() && typeof Element !== "undefined" && typeof Element.prototype.animate === "function";

/** A change mid-animation: whatever of ours is running on this element ends at once, in its end state. */
export function finishRunning(element: Element): void {
  if (typeof (element as HTMLElement).getAnimations !== "function") return;
  for (const animation of (element as HTMLElement).getAnimations()) if (String(animation.id).startsWith(OURS)) animation.finish();
}

function runOf(animations: readonly (Animation | null)[], after?: () => void): MotionRun {
  const live = animations.filter((animation): animation is Animation => animation !== null);
  if (live.length === 0) {
    after?.();
    return DONE;
  }
  const finished = Promise.all(live.map((animation) => Promise.resolve(animation.finished).then(() => undefined, () => undefined))).then(() => after?.());
  return {
    finished,
    finish: () => {
      for (const animation of live) {
        try {
          animation.finish?.();
        } catch {
          /* already gone */
        }
      }
    },
    cancel: () => {
      for (const animation of live) animation.cancel?.();
    },
  };
}

function start(element: HTMLElement, id: string, frames: Keyframe[], options: KeyframeAnimationOptions): Animation {
  finishRunning(element);
  return element.animate(frames, { easing: STANDARD, ...options, id: `${OURS}${id}` });
}

/** The delay of item `index` among those moving together: `stagger` apart, and from the `cap`th on, together with it. */
export const staggerDelay = (index: number, stagger: number = STAGGER, cap: number = STAGGER_CAP): number => Math.min(Math.max(index, 0), Math.max(cap, 1) - 1) * stagger;

/* ── dropIn ── */

export interface DropOptions {
  /** Between one and the next, in ms. 0: all at once. */
  stagger?: number;
  /** Items beyond this go together with the last staggered one. */
  cap?: number;
  /** Before the first starts. */
  delay?: number;
  ms?: number;
  /** How far above it starts. */
  from?: number;
}

/** Anything arriving: fades in and falls `DROP_FALL` from above to its place, over `DROP`. In the order given. */
export function dropIn(elements: readonly Element[], { stagger = 0, cap = STAGGER_CAP, delay = 0, ms = DROP, from = DROP_FALL }: DropOptions = {}): MotionRun {
  const animations = elements.map((element, at) =>
    canAnimate(element)
      ? start(element, "drop", [{ opacity: 0, transform: `translateY(-${from}px)` }, { opacity: 1, transform: "none" }], { duration: ms, delay: delay + staggerDelay(at, stagger, cap), fill: "backwards" })
      : null,
  );
  return runOf(animations);
}

/** Something that was not there fades in where it stands: opacity alone. */
export function fadeIn(elements: readonly Element[], { ms = CROSSFADE, delay = 0 }: { ms?: number; delay?: number } = {}): MotionRun {
  return runOf(elements.map((element) => (canAnimate(element) ? start(element, "fade", [{ opacity: 0 }, { opacity: 1 }], { duration: ms, delay, fill: "backwards" }) : null)));
}

/* ── liftOut: the other half of a drop ── */

export interface LiftOptions {
  stagger?: number;
  cap?: number;
  delay?: number;
  ms?: number;
  rise?: number;
}

/** Anything leaving: fades out and rises `LIFT_RISE`, over `LIFT`. It stays as it ended (`fill: both`) until it is taken away. */
export function liftOut(elements: readonly Element[], { stagger = 0, cap = STAGGER_CAP, delay = 0, ms = LIFT, rise = LIFT_RISE }: LiftOptions = {}): MotionRun {
  const animations = elements.map((element, at) =>
    canAnimate(element) ? start(element, "lift", [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateY(-${rise}px)` }], { duration: ms, delay: delay + staggerDelay(at, stagger, cap), fill: "both" }) : null,
  );
  return runOf(animations);
}

/** How long a lift of `count` items takes from the first starting to the last ending. */
export const liftSpan = (count: number, stagger: number = STAGGER, cap: number = STAGGER_CAP, ms: number = LIFT): number => (count > 0 ? staggerDelay(count - 1, stagger, cap) + ms : 0);

/* ── openClip: a frame that opens ── */

/**
 * A frame that grows to hold what is in it, drawn with `clip-path: inset()` so no layout property moves: it is revealed from the
 * top down over `BASE`. Used for a part's frame, which holds sessions and so cannot fade without fading them.
 */
export function openClip(elements: readonly Element[], { delay = 0, ms = LIFT }: { delay?: number; ms?: number } = {}): MotionRun {
  return runOf(
    elements.map((element) => (canAnimate(element) ? start(element, "clip", [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: ms, delay, fill: "backwards" }) : null)),
  );
}

/* ── resizeFrame: a window that grows or closes about its fixed centre ── */

/** The three parts of a modal window that move when its frame changes size. */
export interface FrameParts {
  header: HTMLElement | null;
  body: HTMLElement | null;
  footer: HTMLElement | null;
}

/** A window's header, the body that scrolls, and its footer. */
export function frameParts(frame: HTMLElement): FrameParts {
  const part = (id: string) => frame.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  return { header: part("modal-header"), body: part("modal-body"), footer: part("modal-footer") };
}

/** How far the frame's shadow reaches past its edge: the clip leaves this much room at the sides and, once open, at the ends. */
const SHADOW_ROOM = 96;
const FRAME_RADIUS = 12;

/**
 * A centred window that was `from` tall and is now `to` tall (growing: it is already drawn at `to`; closing: it is still drawn at
 * `from`, and the caller takes the content away once this has run). Its centre stays where it is: the top edge and the header move
 * by half the difference one way, the bottom edge and the footer by half the other way. The frame is drawn with `clip-path: inset()`
 * from the old height to the new, and the header, body and footer move with `translateY`, so no layout property is animated.
 */
export function resizeFrame(frame: HTMLElement, parts: FrameParts, from: number, to: number, ms: number = BASE): MotionRun {
  const change = Math.abs(to - from);
  if (!canAnimate(frame) || change < 1) return DONE;
  const half = change / 2;
  const growing = to > from;
  const clip = (cut: number) => `inset(${cut}px -${SHADOW_ROOM}px ${cut}px -${SHADOW_ROOM}px round ${FRAME_RADIUS}px)`;
  const options: KeyframeAnimationOptions = { duration: ms, fill: growing ? "none" : "forwards" };
  const slide = (element: HTMLElement | null, id: string, by: number) => {
    if (!element || !canAnimate(element)) return null;
    const away = `translateY(${by}px)`;
    return start(element, id, growing ? [{ transform: away }, { transform: "none" }] : [{ transform: "none" }, { transform: away }], options);
  };
  return runOf([
    start(frame, "frame", growing ? [{ clipPath: clip(half) }, { clipPath: clip(-SHADOW_ROOM) }] : [{ clipPath: clip(-SHADOW_ROOM) }, { clipPath: clip(half) }], options),
    slide(parts.header, "frame-header", half),
    slide(parts.body, "frame-body", half),
    slide(parts.footer, "frame-footer", -half),
  ]);
}

/* ── slideOut: arriving from under something ── */

/** An element that starts at `from` (behind what it comes out of) and moves to where it is, fading in, over `DROP`. A copy slides out from under its original. */
export function slideOut(element: Element, from: Box, ms: number = DROP, delay = 0): MotionRun {
  if (!canAnimate(element)) return DONE;
  const now = element.getBoundingClientRect();
  const dx = from.x - now.left;
  const dy = from.y - now.top;
  const sx = now.width > 0 ? from.w / now.width : 1;
  const sy = now.height > 0 ? from.h / now.height : 1;
  return runOf([
    start(element, "out", [{ opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: "0 0" }, { opacity: 1, transform: "none", transformOrigin: "0 0" }], { duration: ms, delay, fill: "backwards" }),
  ]);
}

/* ── useFlip ── */

export interface FlipOptions {
  ms?: number;
  /** Before the slide starts: the things that slide sit where they were until then (`fill: backwards`). */
  delay?: number;
}

export interface Flip {
  /** Remember where everything stands. Whatever was sliding finishes first. The next render's layout slides from here. */
  measure: (options?: FlipOptions) => void;
  /** Slide at once, from the last `measure`, for a change that is already in the DOM. Resolves how many slid. */
  now: () => number;
  /** Whether a `measure` is waiting for the next layout. */
  pending: () => boolean;
}

/**
 * Measure, change, animate from old to new. `measure()` before the change; after the render that follows, everything that
 * stood somewhere else slides from there to where it stands now (transforms only; sizes are not animated).
 */
export function useFlip(rootRef: RefObject<HTMLElement | null>): Flip {
  const waiting = useRef<{ boxes: Map<string, Box>; options: FlipOptions } | null>(null);
  const measure = useCallback(
    (options: FlipOptions = {}) => {
      const root = rootRef.current;
      if (!root) return;
      finishSlides(root);
      waiting.current = { boxes: snapshot(root), options };
    },
    [rootRef],
  );
  const now = useCallback(() => {
    const root = rootRef.current;
    const held = waiting.current;
    waiting.current = null;
    if (!root || !held) return 0;
    return play(root, held.boxes, held.options.ms ?? SLIDE, held.options.delay ?? 0);
  }, [rootRef]);
  const pending = useCallback(() => waiting.current !== null, []);
  // After every render that follows a `measure`, before it is painted.
  useLayoutEffect(() => {
    if (waiting.current) now();
  });
  return { measure, now, pending };
}

/* ── useLeaving ── */

export interface LeavingOptions {
  /** Where the element of an item is, to lift it. */
  find: (key: string) => HTMLElement | null;
  /** Between one lifting item and the next, in ms. 0: together. */
  stagger?: number;
  /** The last of the lifting items goes first, as when the whole build is cleared. */
  reverse?: boolean;
  /** Only lift when told to: a build that is swapped for another, or a first load, must not lift everything. */
  enabled?: boolean;
  ms?: number;
  /** Just before the lifted items are let go: measure what is about to slide up (`useFlip().measure`). */
  onRelease?: () => void;
}

export interface Leaving<T> {
  /** The items now, with those leaving still in the places they were. */
  items: T[];
  /** The keys of those still leaving. Draw them without pointer events. */
  leaving: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();

/**
 * Keep what was removed on screen, in place, while it lifts out; then let it go. Everything else stays where it was meanwhile, so
 * nothing jumps, and the gap closes (a slide) only once the lift has ended.
 */
export function useLeaving<T>(items: readonly T[], keyOf: (item: T) => string, { find, stagger = 0, reverse = false, enabled = true, ms = LIFT, onRelease }: LeavingOptions): Leaving<T> {
  const previous = useRef<readonly T[]>(items);
  const held = useRef(new Map<string, { item: T; after: string | null }>());
  const fresh = useRef<string[]>([]);
  const timers = useRef<number[]>([]);
  const [, redraw] = useState(0);
  const options = useRef({ find, stagger, reverse, ms, onRelease });
  options.current = { find, stagger, reverse, ms, onRelease };

  if (previous.current !== items) {
    const now = new Set(items.map(keyOf));
    // Something that came back while it was leaving is simply there again.
    for (const key of now) if (held.current.has(key)) held.current.delete(key);
    if (enabled && motionOn()) {
      let after: string | null = null;
      const gone: string[] = [];
      for (const item of previous.current) {
        const key = keyOf(item);
        if (now.has(key) || held.current.has(key)) {
          after = key;
          continue;
        }
        held.current.set(key, { item, after });
        gone.push(key);
        after = key;
      }
      if (gone.length > 0) fresh.current = [...fresh.current, ...gone];
    }
    previous.current = items;
  }

  useLayoutEffect(() => {
    if (fresh.current.length === 0) return;
    const keys = fresh.current;
    fresh.current = [];
    const { find: where, stagger: step, reverse: backwards, ms: duration } = options.current;
    const ordered = backwards ? [...keys].reverse() : keys;
    const elements = ordered.map((key) => where(key)).filter((element): element is HTMLElement => element !== null);
    liftOut(elements, { stagger: step, ms: duration });
    const span = liftSpan(ordered.length, step, STAGGER_CAP, duration);
    timers.current.push(
      window.setTimeout(() => {
        options.current.onRelease?.();
        for (const key of keys) held.current.delete(key);
        redraw((value) => value + 1);
      }, span),
    );
  });
  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    },
    [],
  );

  if (held.current.size === 0) return { items: items as T[], leaving: NONE };
  // Each leaving item goes back after the item it followed (or first), so the order is the one the maker last saw.
  const merged = [...items];
  const present = (key: string) => merged.findIndex((item) => keyOf(item) === key);
  for (const [key, entry] of held.current) {
    const at = entry.after === null ? -1 : present(entry.after);
    merged.splice(at + 1, 0, entry.item);
    void key;
  }
  return { items: merged, leaving: new Set(held.current.keys()) };
}

/* ── useHeld: what stays on screen while it leaves ── */

/**
 * `value` while there is one; once it is null, the last one for `ms` more, flagged `leaving`, so a component that has no data any more
 * can still be drawn while it falls away. Under reduced motion it goes at once.
 */
export function useHeld<T>(value: T | null, ms: number): { value: T | null; leaving: boolean } {
  const last = useRef<T | null>(value);
  const timer = useRef<number | undefined>(undefined);
  const [, redraw] = useState(0);
  if (value !== null) last.current = value;
  const gone = value === null;
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!gone || last.current === null) return;
    if (!motionOn()) {
      last.current = null;
      redraw((n) => n + 1);
      return;
    }
    timer.current = window.setTimeout(() => {
      last.current = null;
      redraw((n) => n + 1);
    }, ms);
    return () => window.clearTimeout(timer.current);
  }, [gone, ms]);
  if (gone && !motionOn()) return { value: null, leaving: false };
  return { value: gone ? last.current : value, leaving: gone && last.current !== null };
}

/** A fixed or sticky thing that rises `by` and fades in; the same thing falling and fading out when `leaving`. Keyframes carry `base` so a centring transform is not lost. */
export function riseIn(element: HTMLElement, { by, ms, base = "" }: { by: number; ms: number; base?: string }): MotionRun {
  if (!canAnimate(element)) return DONE;
  const there = base || "none";
  return runOf([start(element, "rise", [{ opacity: 0, transform: `${base} translateY(${by}px)`.trim() }, { opacity: 1, transform: there }], { duration: ms, fill: "backwards" })]);
}

export function fallOut(element: HTMLElement, { by, ms, base = "" }: { by: number; ms: number; base?: string }): MotionRun {
  if (!canAnimate(element)) return DONE;
  const there = base || "none";
  return runOf([start(element, "fall", [{ opacity: 1, transform: there }, { opacity: 0, transform: `${base} translateY(${by}px)`.trim() }], { duration: ms, fill: "both" })]);
}

/* ── Swap: content that changes its subject ── */

/**
 * Content for one thing replaced by content for another: the old fades out over `ms`, then the new fades in over `ms`. Nothing
 * slides and nothing around it changes (it draws the one element it is given, with a ref added). While the old fades out it is
 * the last one drawn, however the new props read. With the same `id`, it is simply what it is given, live.
 */
export function Swap({ id, children, ms = CROSSFADE }: { id: string; children: ReactElement; ms?: number }) {
  const [drawn, setDrawn] = useState(id);
  const latest = useRef(id);
  latest.current = id;
  const kept = useRef<ReactElement>(children);
  const element = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const settling = useRef(false);
  const reduced = !motionOn();
  if (drawn === id || reduced) kept.current = children;
  const showing = drawn === id || reduced ? children : kept.current;
  // The subject changed: the old content fades out, then the new is drawn and fades in.
  useLayoutEffect(() => {
    if (drawn === id) return;
    if (reduced) {
      setDrawn(id);
      return;
    }
    if (element.current) fallOutFade(element.current, ms);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      settling.current = true;
      setDrawn(latest.current);
    }, ms);
    return () => window.clearTimeout(timer.current);
  }, [id, drawn, ms, reduced]);
  useLayoutEffect(() => {
    if (!settling.current) return;
    settling.current = false;
    if (element.current) fadeIn([element.current], { ms });
  }, [drawn, ms]);
  return cloneElement(showing, { ref: element } as Record<string, unknown>);
}

function fallOutFade(element: HTMLElement, ms: number): MotionRun {
  if (!canAnimate(element)) return DONE;
  return runOf([start(element, "swap-out", [{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: "both" })]);
}

/* ── outlineOnce ── */

export interface OutlineOptions {
  colour?: string;
  inMs?: number;
  hold?: number;
  out?: number;
  /** 1.5 by default. */
  width?: number;
  /** How far outside the component the ring stands. */
  offset?: number;
}

const px = (value: string): number => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * A ring round a component, once: its opacity rises in `OUTLINE_IN`, holds `OUTLINE_HOLD`, and falls in `OUTLINE_OUT`. The ring is
 * a separate element, 4 outside, its radius the component's plus 3; only its OPACITY ever changes, and it removes itself.
 * Under reduced motion it shows for the hold and goes, with no fade: the answer to "which one" is kept, the fade is dropped.
 */
export function outlineOnce(element: HTMLElement, ringColour: string = t.selectedEdge, { inMs = OUTLINE_IN, hold = OUTLINE_HOLD, out = OUTLINE_OUT, width = 1.5, offset = 4 }: OutlineOptions = {}): MotionRun {
  const ring = element.ownerDocument.createElement("div");
  ring.setAttribute("data-testid", "outline-once");
  ring.setAttribute("aria-hidden", "true");
  const radius = typeof getComputedStyle === "function" ? px(getComputedStyle(element).borderTopLeftRadius) : 0;
  const was = element.style.position;
  const needsAnchor = typeof getComputedStyle === "function" && getComputedStyle(element).position === "static";
  if (needsAnchor) element.style.position = "relative";
  Object.assign(ring.style, {
    position: "absolute",
    left: `${-offset}px`,
    top: `${-offset}px`,
    right: `${-offset}px`,
    bottom: `${-offset}px`,
    borderWidth: `${width}px`,
    borderStyle: "solid",
    borderColor: ringColour,
    borderRadius: `${radius + 3}px`,
    pointerEvents: "none",
    boxSizing: "border-box",
    opacity: "0",
  });
  element.appendChild(ring);
  const remove = () => {
    ring.remove();
    if (needsAnchor) element.style.position = was;
  };
  if (prefersReducedMotion() || typeof ring.animate !== "function") {
    ring.style.opacity = "1";
    const timer = window.setTimeout(remove, hold);
    return {
      finished: new Promise<void>((resolve) => window.setTimeout(resolve, hold)),
      finish: () => {
        window.clearTimeout(timer);
        remove();
      },
      cancel: () => {
        window.clearTimeout(timer);
        remove();
      },
    };
  }
  const total = inMs + hold + out;
  const animation = ring.animate(
    [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: inMs / total },
      { opacity: 1, offset: (inMs + hold) / total },
      { opacity: 0, offset: 1 },
    ],
    { duration: total, easing: STANDARD, id: `${OURS}outline` },
  );
  return runOf([animation], remove);
}

/* ── Go to it ── */

const onScreenWhole = (element: HTMLElement): boolean => {
  const box = element.getBoundingClientRect();
  return box.top >= 0 && box.bottom <= (window.innerHeight || Number.POSITIVE_INFINITY);
};

/** Scrolls the window so the element is in the middle, over `ms`, easing out. Resolves when it has arrived (or was cut short). */
export function scrollToMiddle(element: HTMLElement, ms: number = SCROLL_TO): { finished: Promise<void>; cancel: () => void } {
  const box = element.getBoundingClientRect();
  const from = window.scrollY;
  const to = Math.max(0, from + box.top - (window.innerHeight - box.height) / 2);
  let frame = 0;
  let stop = false;
  const finished = new Promise<void>((resolve) => {
    if (prefersReducedMotion() || ms <= 0 || Math.abs(to - from) < 1 || typeof window.requestAnimationFrame !== "function") {
      window.scrollTo?.(0, to);
      resolve();
      return;
    }
    const began = performance.now();
    const step = (now: number) => {
      if (stop) return resolve();
      const done = Math.min(1, (now - began) / ms);
      // The product's one curve, as a cubic ease-out: fast away, settling.
      window.scrollTo?.(0, from + (to - from) * (1 - (1 - done) ** 3));
      if (done < 1) frame = window.requestAnimationFrame(step);
      else resolve();
    };
    frame = window.requestAnimationFrame(step);
  });
  return {
    finished,
    cancel: () => {
      stop = true;
      window.cancelAnimationFrame?.(frame);
    },
  };
}

/**
 * Go to it. A component that is off screen is scrolled to the middle over `SCROLL_TO`; then it is outlined once in the link's colour
 * (1.5px, 4 outside), holding `GOTO_HOLD` and fading over `GOTO_OUT`, so the eye has time to arrive.
 */
export function goToIt(element: HTMLElement, colour?: string | null): MotionRun {
  let ring: MotionRun | null = null;
  let scrolling: { cancel: () => void } | null = null;
  const draw = () => {
    ring = outlineOnce(element, colour || t.selectedEdge, { hold: GOTO_HOLD, out: GOTO_OUT });
  };
  const done = (async () => {
    if (!onScreenWhole(element)) {
      const scroll = scrollToMiddle(element);
      scrolling = scroll;
      await scroll.finished;
      /* CA-27 P3: in a large build the tiles above were guessed at, and shift as they are drawn: it is kept in the middle for a moment. */
      settle(
        () => {
          const box = element.getBoundingClientRect();
          return !element.isConnected || Math.abs((box.top + box.bottom) / 2 - window.innerHeight / 2) < 24 || box.height > window.innerHeight;
        },
        () => void scrollToMiddle(element, 0),
      );
    }
    draw();
    await ring?.finished;
  })();
  return {
    finished: done,
    finish: () => {
      scrolling?.cancel();
      ring?.finish();
    },
    cancel: () => {
      scrolling?.cancel();
      ring?.cancel();
    },
  };
}

/* ── crossfade ── */

const inWindow = (element: HTMLElement): boolean => {
  const box = element.getBoundingClientRect();
  // No layout to read (a test's jsdom): it is taken to be there.
  if (box.width === 0 && box.height === 0) return true;
  return box.bottom > 0 && box.top < (window.innerHeight || Number.POSITIVE_INFINITY);
};

/** Words as they stood: a copy of the element, and where it was, kept for a crossfade. */
export interface Words {
  clone: HTMLElement;
  box: { left: number; top: number; width: number; height: number };
  style: Pick<CSSStyleDeclaration, "font" | "color" | "letterSpacing" | "textAlign" | "whiteSpace" | "lineHeight">;
}

export function captureWords(element: HTMLElement): Words | null {
  if (typeof getComputedStyle !== "function") return null;
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const clone = element.cloneNode(true) as HTMLElement;
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("data-testid", "crossfade-old");
  return {
    clone,
    box: { left: box.left, top: box.top, width: box.width, height: box.height },
    style: { font: style.font, color: style.color, letterSpacing: style.letterSpacing, textAlign: style.textAlign, whiteSpace: style.whiteSpace, lineHeight: style.lineHeight },
  };
}

/** The old words (a fixed layer, so nothing in the page moves) fade out over the new, which fade in, over `CROSSFADE`. */
export function crossfadeFrom(words: Words | null, element: HTMLElement, ms: number = CROSSFADE): MotionRun {
  if (!words || !canAnimate(element)) return DONE;
  finishRunning(element);
  const { clone, box, style } = words;
  Object.assign(clone.style, { position: "fixed", left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, margin: "0", pointerEvents: "none", zIndex: "100", ...style });
  element.ownerDocument.body.appendChild(clone);
  const gone = clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: STANDARD, fill: "forwards", id: `${OURS}crossfade-old` });
  const arriving = start(element, "crossfade", [{ opacity: 0 }, { opacity: 1 }], { duration: ms, fill: "backwards" });
  return runOf([gone, arriving], () => clone.remove());
}

/** Words that change: call it just before `change` writes the new words. */
export function crossfade(element: HTMLElement, change: () => void, ms: number = CROSSFADE): MotionRun {
  const words = canAnimate(element) ? captureWords(element) : null;
  change();
  return crossfadeFrom(words, element, ms);
}

/**
 * `useCrossfade(value)`: put the ref it returns on the element that holds the words; whenever `value` changes the old words (a copy,
 * in a fixed layer in the body, for `CROSSFADE`) fade out over the new. At rest it draws nothing and adds nothing to the page.
 * SV-05 P1: with `inPlace`, only words that stayed where they were crossfade; words that moved (a session's head sliding to
 * its new place) are simply the new ones, so the copy never stands where the words have left.
 */
export function useCrossfade<E extends HTMLElement = HTMLElement>(value: string | number, ms: number = CROSSFADE, inPlace = false): RefObject<E | null> {
  const ref = useRef<E | null>(null);
  const was = useRef(value);
  const old = useRef<Words | null>(null);
  // While rendering, the page still shows the old words: take them now.
  if (was.current !== value) {
    // Only words that can be seen change before the eye: 300 numbers below the fold are simply the new ones.
    old.current = ref.current && canAnimate(ref.current) && inWindow(ref.current) ? captureWords(ref.current) : null;
    was.current = value;
  }
  useLayoutEffect(() => {
    const words = old.current;
    old.current = null;
    if (!words || !ref.current) return;
    if (inPlace) {
      const box = ref.current.getBoundingClientRect();
      if (Math.abs(box.left - words.box.left) > 1 || Math.abs(box.top - words.box.top) > 1) return;
    }
    crossfadeFrom(words, ref.current, ms);
  });
  return ref;
}
