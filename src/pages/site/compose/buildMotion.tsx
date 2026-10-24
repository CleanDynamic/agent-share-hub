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

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import {
  CROSSFADE,
  DROP,
  DROP_FALL,
  LIFT,
  LIFT_RISE,
  OUTLINE_HOLD,
  OUTLINE_IN,
  OUTLINE_OUT,
  SLIDE,
  STAGGER,
  STAGGER_CAP,
} from "@/lib/build/buildMotion";
import { prefersReducedMotion, STANDARD } from "@/lib/theme/motion";
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

/* ── slideOut: arriving from under something ── */

/** An element that starts at `from` (behind what it comes out of) and moves to where it is, fading in, over `DROP`. A copy slides out from under its original. */
export function slideOut(element: Element, from: Box, ms: number = DROP): MotionRun {
  if (!canAnimate(element)) return DONE;
  const now = element.getBoundingClientRect();
  const dx = from.x - now.left;
  const dy = from.y - now.top;
  const sx = now.width > 0 ? from.w / now.width : 1;
  const sy = now.height > 0 ? from.h / now.height : 1;
  return runOf([
    start(element, "out", [{ opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: "0 0" }, { opacity: 1, transform: "none", transformOrigin: "0 0" }], { duration: ms, fill: "backwards" }),
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
export function useLeaving<T>(items: readonly T[], keyOf: (item: T) => string, { find, stagger = 0, reverse = false, enabled = true, ms = LIFT }: LeavingOptions): Leaving<T> {
  const previous = useRef<readonly T[]>(items);
  const held = useRef(new Map<string, { item: T; after: string | null }>());
  const fresh = useRef<string[]>([]);
  const timers = useRef<number[]>([]);
  const [, redraw] = useState(0);
  const options = useRef({ find, stagger, reverse, ms });
  options.current = { find, stagger, reverse, ms };

  if (previous.current !== items) {
    const now = new Set(items.map(keyOf));
    // Something that came back while it was leaving is simply there again.
    for (const key of now) if (held.current.has(key)) held.current.delete(key);
    if (enabled && !prefersReducedMotion()) {
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
export function outlineOnce(element: HTMLElement, colour: string = t.selectedEdge, { inMs = OUTLINE_IN, hold = OUTLINE_HOLD, out = OUTLINE_OUT, width = 1.5, offset = 4 }: OutlineOptions = {}): MotionRun {
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
    borderColor: colour,
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

/* ── crossfade ── */

/**
 * Words that change: the old words (a copy of the element as it was) fade out above the new, which fade in, over `CROSSFADE`. The
 * copy is a separate, fixed layer, so nothing in the page moves. Call it just before `change` writes the new words.
 */
export function crossfade(element: HTMLElement, change: () => void, ms: number = CROSSFADE): MotionRun {
  if (!canAnimate(element) || typeof getComputedStyle !== "function") {
    change();
    return DONE;
  }
  finishRunning(element);
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const ghost = element.cloneNode(true) as HTMLElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("data-testid", "crossfade-old");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    margin: "0",
    pointerEvents: "none",
    font: style.font,
    color: style.color,
    letterSpacing: style.letterSpacing,
    textAlign: style.textAlign,
    whiteSpace: style.whiteSpace,
    lineHeight: style.lineHeight,
    zIndex: "100",
  });
  element.ownerDocument.body.appendChild(ghost);
  change();
  const gone = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: STANDARD, fill: "forwards", id: `${OURS}crossfade-old` });
  const arriving = start(element, "crossfade", [{ opacity: 0 }, { opacity: 1 }], { duration: ms, fill: "backwards" });
  return runOf([gone, arriving], () => ghost.remove());
}

/** `<Crossfade value>`: its words crossfade whenever `value` changes. At rest it draws nothing but its children. */
export function Crossfade({ value, children, ms = CROSSFADE }: { value: string | number; children: ReactNode; ms?: number }) {
  const was = useRef<{ value: string | number; children: ReactNode }>({ value, children });
  const [old, setOld] = useState<ReactNode>(null);
  const fresh = useRef<HTMLSpanElement | null>(null);
  const stale = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    if (was.current.value === value) {
      was.current = { value, children };
      return;
    }
    const before = was.current.children;
    was.current = { value, children };
    if (prefersReducedMotion()) return;
    setOld(before);
    const timer = window.setTimeout(() => setOld(null), ms);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useLayoutEffect(() => {
    if (old === null) return;
    if (fresh.current && canAnimate(fresh.current)) start(fresh.current, "crossfade", [{ opacity: 0 }, { opacity: 1 }], { duration: ms, fill: "backwards" });
    if (stale.current && canAnimate(stale.current)) start(stale.current, "crossfade-old", [{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: "forwards" });
  }, [old, ms]);
  if (old === null) return <>{children}</>;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span ref={fresh}>{children}</span>
      <span ref={stale} aria-hidden="true" data-testid="crossfade-old" style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap", pointerEvents: "none" }}>
        {old}
      </span>
    </span>
  );
}
