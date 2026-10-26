/* CA-22 P1: the build page's motion, written once.

   Sixteen moments share five ideas, and each idea is one helper here:

     slides        measure, change, then slide what moved from where it stood to where it stands: SV-06's `MotionBoundary`
     useLeaving    keep a removed component on screen, in place, while it lifts out; then let it go, so nothing jumps
     dropIn        anything arriving falls 20 from above and fades in; several arrive `stagger` apart, over a fixed spread at most
     outlineOnce   a ring 4 outside the component, drawn by a separate element whose OPACITY is all that changes
     crossfade     words that change: the old words fade out over the new

   SV-06: each one plays through the list's one animator (`listMotion.ts`, `animateOn`), and the slides come from its one pass
   (`MotionBoundary`), so no helper cancels what another started: a new drop or lift on an element carries on from where the last
   one had it. Only `transform` and `opacity` are ever animated; never a layout property, never `box-shadow`. Under reduced motion
   nothing moves or fades: every change arrives at once, in the same end state (the helpers return an already-finished run). */

import { cloneElement, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type RefObject } from "react";

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
  STAGGER,
  STAGGER_SPREAD_MAX,
  staggerStep,
} from "@/lib/build/buildMotion";
import { BASE, prefersReducedMotion, STANDARD } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import type { Box } from "./flip";
import { scrollToShow, type ScrollRun } from "./pageScroll";
import { animateOn, capSequence, captureWords, crossfadeFrom as crossfadeWords, DONE, inWindow, motionOn, runOf, useListAnimator, type MotionRun, type Words, type WordsEntry } from "./listMotion";

export { captureWords, motionOn, type MotionRun, type Words };

const canAnimate = (element: Element): element is HTMLElement => !prefersReducedMotion() && typeof (element as HTMLElement).animate === "function";

/** Starts one of this file's animations through the animator; a drop or a lift that takes the place of one carries on from it. */
const start = (element: HTMLElement, id: string, frames: Keyframe[], options: KeyframeAnimationOptions): Animation | null => animateOn(element, id, frames, { ...options, continueFrom: true });

/**
 * The delay of item `index` of `count` moving together: `stagger` apart, closer together when `count` would spread them past `spread`
 * (SV-06 P5: the spread never grows with the count).
 */
export const staggerDelay = (index: number, count: number, stagger: number = STAGGER, spread: number = STAGGER_SPREAD_MAX): number => Math.max(index, 0) * staggerStep(count, stagger, spread);

/* ── dropIn ── */

export interface DropOptions {
  /** Between one and the next, in ms. 0: all at once. */
  stagger?: number;
  /** The longest from the first starting to the last: more items stand closer together. */
  spread?: number;
  /** Before the first starts. */
  delay?: number;
  ms?: number;
  /** How far above it starts. */
  from?: number;
}

/** Anything arriving: fades in and falls `DROP_FALL` from above to its place, over `DROP`. In the order given. */
export function dropIn(elements: readonly Element[], { stagger = 0, spread = STAGGER_SPREAD_MAX, delay = 0, ms = DROP, from = DROP_FALL }: DropOptions = {}): MotionRun {
  const animations = elements.map((element, at) =>
    canAnimate(element)
      ? start(element, "drop", [{ opacity: 0, transform: `translateY(-${from}px)` }, { opacity: 1, transform: "none" }], { duration: ms, delay: delay + staggerDelay(at, elements.length, stagger, spread), fill: "backwards" })
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
  spread?: number;
  delay?: number;
  ms?: number;
  rise?: number;
}

/** Anything leaving: fades out and rises `LIFT_RISE`, over `LIFT`. It stays as it ended (`fill: both`) until it is taken away. */
export function liftOut(elements: readonly Element[], { stagger = 0, spread = STAGGER_SPREAD_MAX, delay = 0, ms = LIFT, rise = LIFT_RISE }: LiftOptions = {}): MotionRun {
  const animations = elements.map((element, at) =>
    canAnimate(element) ? start(element, "lift", [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateY(-${rise}px)` }], { duration: ms, delay: delay + staggerDelay(at, elements.length, stagger, spread), fill: "both" }) : null,
  );
  return runOf(animations);
}

/** How long a lift of `count` items takes from the first starting to the last ending. */
export const liftSpan = (count: number, stagger: number = STAGGER, spread: number = STAGGER_SPREAD_MAX, ms: number = LIFT): number => (count > 0 ? staggerDelay(count - 1, count, stagger, spread) + ms : 0);

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

/**
 * An element that starts at `from` (behind what it comes out of) and moves to where it is, fading in, over `DROP`. A copy slides out
 * from under its original. SV-06 P4: a translate and an opacity only; a copy is its original's size, and its rounded corners never scale.
 */
export function slideOut(element: Element, from: Box, ms: number = DROP, delay = 0): MotionRun {
  if (!canAnimate(element)) return DONE;
  const now = element.getBoundingClientRect();
  const dx = from.x - now.left;
  const dy = from.y - now.top;
  return runOf([start(element, "out", [{ opacity: 0, transform: `translate(${dx}px, ${dy}px)` }, { opacity: 1, transform: "none" }], { duration: ms, delay, fill: "backwards" })]);
}

/* ── useLeaving ── */

export interface LeavingOptions {
  /** Where the element of an item is, to lift it. */
  find: (key: string) => HTMLElement | null;
  /** Between one lifting item and the next, in ms. 0: together. */
  stagger?: number;
  /** The last of the lifting items goes first, as when the whole build is cleared. */
  reverse?: boolean;
  /**
   * SV-06: whether these keys lift, asked once what went is held (a layout effect, before it is painted): a label for them on the
   * page's channel. False lets them go at once, so a build swapped for another, or a write from elsewhere, does not lift anything.
   */
  lifts?: (keys: readonly string[]) => boolean;
  ms?: number;
}

export interface Leaving<T> {
  /** The items now, with those leaving still in the places they were. */
  items: T[];
  /** The keys of those still leaving. Draw them without pointer events. */
  leaving: ReadonlySet<string>;
  /** This render lets the lifted items go: what stood below slides up (a `MotionBoundary` that measures only then). */
  releasing: boolean;
}

const NONE: ReadonlySet<string> = new Set();
const ALWAYS = () => true;

/**
 * Keep what was removed on screen, in place, while it lifts out; then let it go. Everything else stays where it was meanwhile, so
 * nothing jumps, and the gap closes (a slide) only once the lift has ended.
 */
export function useLeaving<T>(items: readonly T[], keyOf: (item: T) => string, { find, stagger = 0, reverse = false, lifts = ALWAYS, ms = LIFT }: LeavingOptions): Leaving<T> {
  const previous = useRef<readonly T[]>(items);
  const held = useRef(new Map<string, { item: T; after: string | null }>());
  const fresh = useRef<string[]>([]);
  const caps = useRef<(() => void)[]>([]);
  const [release, redraw] = useState(0);
  const released = useRef(release);
  const releasing = released.current !== release;
  released.current = release;
  const options = useRef({ find, stagger, reverse, ms, lifts });
  options.current = { find, stagger, reverse, ms, lifts };

  if (previous.current !== items) {
    const now = new Set(items.map(keyOf));
    // Something that came back while it was leaving is simply there again.
    for (const key of now) if (held.current.has(key)) held.current.delete(key);
    if (motionOn()) {
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
    if (!options.current.lifts(keys)) {
      // Nothing asked for a lift: let them go now, in this commit's layout pass, so the held rows are never painted.
      for (const key of keys) held.current.delete(key);
      redraw((value) => value + 1);
      return;
    }
    const ordered = backwards ? [...keys].reverse() : keys;
    const elements = ordered.map((key) => where(key)).filter((element): element is HTMLElement => element !== null);
    const lift = liftOut(elements, { stagger: step, ms: duration });
    // SV-06 P3: let go when the lift has ended, not after a guess at how long it takes; the cap ends one still running at 1.2 s.
    let done = false;
    const letGo = () => {
      if (done) return;
      done = true;
      stop();
      for (const key of keys) held.current.delete(key);
      redraw((value) => value + 1);
    };
    const stop = capSequence(() => {
      lift.finish();
      letGo();
    });
    caps.current.push(stop);
    void lift.finished.then(letGo);
  });
  useEffect(
    () => () => {
      for (const stop of caps.current) stop();
      caps.current = [];
    },
    [],
  );

  if (held.current.size === 0) return { items: items as T[], leaving: NONE, releasing };
  // Each leaving item goes back after the item it followed (or first), so the order is the one the maker last saw.
  const merged = [...items];
  const present = (key: string) => merged.findIndex((item) => keyOf(item) === key);
  for (const [key, entry] of held.current) {
    const at = entry.after === null ? -1 : present(entry.after);
    merged.splice(at + 1, 0, entry.item);
    void key;
  }
  return { items: merged, leaving: new Set(held.current.keys()), releasing };
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
    // SV-06 P3: the new content is drawn when the old one's fade has ended, not after a guess at how long that takes.
    let live = true;
    const out = element.current ? fallOutFade(element.current, ms) : DONE;
    void out.finished.then(() => {
      if (!live) return;
      settling.current = true;
      setDrawn(latest.current);
    });
    return () => {
      live = false;
    };
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
  const animation = animateOn(
    ring,
    "outline",
    [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: inMs / total },
      { opacity: 1, offset: (inMs + hold) / total },
      { opacity: 0, offset: 1 },
    ],
    { duration: total },
  );
  return runOf([animation], remove);
}

/* ── Go to it ── */

/**
 * Scrolls the window so the element is in the middle, through the page's one scroll helper (`pageScroll.ts`): the browser's smooth
 * scroll, which stops on the maker's input. With `hold`, it is kept there while a windowed build draws what it passed. Resolves when
 * it has arrived (or was cut short, or was in view already).
 */
export function scrollToMiddle(element: HTMLElement, { hold = false }: { hold?: boolean } = {}): ScrollRun {
  return scrollToShow(element, { align: "middle", hold });
}

/**
 * Go to it. A component that is not in view is scrolled to the middle (and held there in a large build, where the tiles above were
 * guessed at and shift as they are drawn); then it is outlined once in the link's colour (1.5px, 4 outside), holding `GOTO_HOLD` and
 * fading over `GOTO_OUT`, so the eye has time to arrive.
 */
export function goToIt(element: HTMLElement, colour?: string | null): MotionRun {
  let ring: MotionRun | null = null;
  const draw = () => (ring = outlineOnce(element, colour || t.selectedEdge, { hold: GOTO_HOLD, out: GOTO_OUT }));
  const scroll = scrollToMiddle(element, { hold: true });
  // In view already: the ring comes at once.
  if (!scroll.moved) draw();
  const done = (async () => {
    await scroll.finished;
    await (ring ?? draw()).finished;
  })();
  return {
    finished: done,
    finish: () => {
      scroll.cancel();
      ring?.finish();
    },
    cancel: () => {
      scroll.cancel();
      ring?.cancel();
    },
  };
}

/* ── crossfade ── */

/** The old words (a fixed layer, so nothing in the page moves) fade out over the new, which fade in, over `CROSSFADE`. */
export const crossfadeFrom = (words: Words | null, element: HTMLElement, ms: number = CROSSFADE): MotionRun => crossfadeWords(words, element, ms);

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
  /* SV-06 P1: inside the List, the words are taken by the animator's own measure, before the DOM changes, and crossfaded in the
     same pass; nothing is read while rendering. Elsewhere (the selection bar, the notice) they are taken here, as before. */
  const animator = useListAnimator();
  const entry = useRef<WordsEntry | null>(null);
  if (animator && entry.current === null) entry.current = { ref, pending: false, inPlace, ms, captured: null };
  if (was.current !== value) {
    was.current = value;
    if (entry.current && animator) entry.current.pending = true;
    // Only words that can be seen change before the eye: 300 numbers below the fold are simply the new ones.
    else old.current = ref.current && canAnimate(ref.current) && inWindow(ref.current) ? captureWords(ref.current) : null;
  }
  if (entry.current) {
    entry.current.inPlace = inPlace;
    entry.current.ms = ms;
  }
  useLayoutEffect(() => (animator && entry.current ? animator.words(entry.current) : undefined), [animator]);
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
