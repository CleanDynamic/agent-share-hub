/* SV-06 P1, P2: the build list's one animator.

   ONE PLACE PLAYS. Every animation on the build page starts here (`animateOn`), so nothing in the list cancels what another part
   of it started. The modules that used to play their own (the director, the fold, the arrival, the drag) now say what kind of change
   is coming and ask for the vocabulary: a drop, a lift, an outline once, a crossfade. The slides they all needed come from one pass.

   ONE PASS PER COMMIT. `MotionBoundary` stands round the list. Before React changes the DOM (`getSnapshotBeforeUpdate`) it reads
   where every `[data-slide-id]` element is DRAWN, a running slide included; after (`componentDidUpdate`) it reads where each now
   stands, and everything that moved slides from the one to the other. Nothing is measured while rendering. All the reads come
   first and then all the writes. Two changes in one commit are one plan, and every slide in a plan has the same duration.

   NEVER CANCEL, ALWAYS CONTINUE. A slide is added to whatever the element is already doing (`composite: "add"`): an element
   mid-slide when the next change lands carries on from where it is drawn to its new place, and the slide it was in finishes
   under it, so nothing is cancelled and nothing snaps. A drop, a lift or a fade that replaces one of its own kind on an element
   starts from the values that one has reached.

   LABELS, NOT TIMERS. An action says what it is about to do with `motion.expect({ kind, keys })` (the `MotionChannel`, shared by
   the page). The animator uses the label on the first commit that touches those keys, and it is spent then, never by time: a
   slow write still gets its motion. A newer label takes the place of one whose keys never came. A change with no label still
   slides; it never snaps.

   Windowed builds: a session the browser skips (`content-visibility: auto`, `largeBuild.tsx`) is measured as one box, never tile
   by tile, because reading a skipped tile's box makes the browser lay it out. Under reduced motion nothing here plays. */

import { Component, createContext, useContext, useRef, useState, type ReactNode, type RefObject } from "react";

import { SEQUENCE_CAP, SLIDE } from "@/lib/build/buildMotion";
import { BASE, prefersReducedMotion, STANDARD } from "@/lib/theme/motion";

import { SLIDE_ATTR, type Box } from "./flip";

/* ── labels ── */

/** What an action is about to do to the build. Every kind is sent by an action today (`useBuildHistory`, `useBuildActions`, MotionDemo). */
export type MotionKind = "remove" | "clear" | "duplicate" | "convert" | "merge" | "split" | "add" | "change" | "move" | "part" | "undo" | "redo" | "restore";

export interface MotionLabel {
  kind: MotionKind;
  /** The tiles, sessions or parts it touches. None: the first change that touches anything. */
  keys: readonly string[];
  /** The step's sentence, for the notice and the status line. */
  sentence?: string;
}

/** Where the actions on a page say what is coming, and the List takes it from. */
export class MotionChannel {
  private label: MotionLabel | null = null;
  /** The label just taken: still seen by `peek` until this task ends, so Sources and the List, which commit together, agree. */
  private spent: MotionLabel | null = null;

  /** Says what is about to change. The newest wins: an older label whose keys never came is dropped. */
  expect(label: MotionLabel): MotionLabel {
    this.label = { ...label, keys: [...label.keys] };
    return this.label;
  }

  /** The label waiting for a change that touches any of `touched`, or null. Not spent. */
  peek(touched: Iterable<string>): MotionLabel | null {
    const label = this.label ?? this.spent;
    if (!label) return null;
    const keys = [...touched];
    if (label.keys.length === 0) return keys.length > 0 ? label : null;
    return keys.some((key) => label.keys.includes(key)) ? label : null;
  }

  /** The same, and spent: the change that touches those keys has used it. */
  take(touched: Iterable<string>): MotionLabel | null {
    const label = this.label ? this.peek(touched) : null;
    if (label) {
      this.label = null;
      this.spent = label;
      queueMicrotask(() => {
        if (this.spent === label) this.spent = null;
      });
    }
    return label;
  }

  /** The label that is waiting, whatever it touches. */
  waiting(): MotionLabel | null {
    return this.label;
  }

  /** Tests, and a page that is left. */
  reset(): void {
    this.label = null;
    this.spent = null;
  }
}

export const MotionChannelContext = createContext<MotionChannel | null>(null);

/** The page's channel, or one of the List's own where no page gave one (a dev page, a test). */
export function useMotionChannel(): MotionChannel {
  const shared = useContext(MotionChannelContext);
  const [own] = useState(() => new MotionChannel());
  return shared ?? own;
}

/* ── a run: what a helper hands back ── */

export interface MotionRun {
  /** Resolves when every animation has ended (or at once, when nothing moved). Never rejects. */
  finished: Promise<void>;
  /** End now, in the end state. */
  finish: () => void;
  /** Stop now and leave nothing behind. */
  cancel: () => void;
}

export const DONE: MotionRun = { finished: Promise.resolve(), finish: () => undefined, cancel: () => undefined };

/** Whether anything here moves at all: not under reduced motion, and not where the Web Animations API is missing. */
export const motionOn = (): boolean => !prefersReducedMotion() && typeof Element !== "undefined" && typeof Element.prototype.animate === "function";

const canAnimate = (element: Element): element is HTMLElement => !prefersReducedMotion() && typeof (element as HTMLElement).animate === "function";

const ended = (animation: Animation): Promise<void> => Promise.resolve(animation.finished).then(
  () => undefined,
  () => undefined,
);

export function runOf(animations: readonly (Animation | null)[], after?: () => void): MotionRun {
  const live = animations.filter((animation): animation is Animation => animation !== null);
  if (live.length === 0) {
    after?.();
    return DONE;
  }
  const finished = Promise.all(live.map(ended)).then(() => after?.());
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

/** Every run given, as one. */
export function allOf(runs: readonly MotionRun[]): MotionRun {
  const live = runs.filter((run) => run !== DONE);
  if (live.length === 0) return DONE;
  return {
    finished: Promise.all(live.map((run) => run.finished)).then(() => undefined),
    finish: () => live.forEach((run) => run.finish()),
    cancel: () => live.forEach((run) => run.cancel()),
  };
}

/* ── sequences: each step waits on the one before ── */

/**
 * A sequence's safety net: past `SEQUENCE_CAP` it is ended (`toEnd`: everything goes to its end state). Returns the way to stand it
 * down once the sequence has ended by itself.
 */
export function capSequence(toEnd: () => void, ms: number = SEQUENCE_CAP): () => void {
  if (typeof window === "undefined") return () => undefined;
  const timer = window.setTimeout(toEnd, ms);
  return () => window.clearTimeout(timer);
}

/**
 * Resolves when the window's scroll has ended: the browser's `scrollend`, or the position unchanged for two frames (a browser without
 * `scrollend`, or a scroll that never started). Never rejects.
 */
export function untilScrollEnds(): Promise<void> {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return Promise.resolve();
  return new Promise<void>((resolve) => {
    let last = window.scrollY;
    let still = 0;
    let frame = 0;
    const done = () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scrollend", done);
      resolve();
    };
    window.addEventListener("scrollend", done, { passive: true, once: true });
    const tick = () => {
      still = window.scrollY === last ? still + 1 : 0;
      last = window.scrollY;
      if (still >= 2) done();
      else frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
  });
}

/* ── the one place an element is animated ── */

/** Every animation this module starts carries this in its id. */
export const OURS = "bm:";

/** Our animations running on an element, by what they do. */
const RUNNING = new WeakMap<Element, Map<string, Set<Animation>>>();

/** The property groups that replace each other: a drop and a lift on one element are one group, a slide is added to anything. */
const GROUP: Record<string, string> = { drop: "presence", lift: "presence", fade: "presence", rise: "presence", fall: "presence", "swap-out": "presence", out: "presence", crossfade: "presence" };

function track(element: HTMLElement, name: string, animation: Animation) {
  const groups = RUNNING.get(element) ?? new Map<string, Set<Animation>>();
  RUNNING.set(element, groups);
  const set = groups.get(name) ?? new Set<Animation>();
  groups.set(name, set);
  set.add(animation);
  // While something runs on it, the browser is told; at rest nothing is left on the element.
  element.style.willChange = "transform, opacity";
  const done = () => {
    set.delete(animation);
    if (set.size === 0) groups.delete(name);
    if (groups.size === 0) {
      RUNNING.delete(element);
      element.style.willChange = "";
    }
  };
  void ended(animation).then(done);
  animation.addEventListener?.("cancel", done);
}

/** The opacity and transform an element is drawn with now, as a keyframe a new animation can start from. */
function drawnNow(element: HTMLElement): Keyframe | null {
  if (typeof getComputedStyle !== "function") return null;
  const style = getComputedStyle(element);
  const opacity = Number.parseFloat(style.opacity);
  return { opacity: Number.isFinite(opacity) ? opacity : 1, transform: style.transform && style.transform !== "" ? style.transform : "none" };
}

export interface AnimateOptions extends KeyframeAnimationOptions {
  /** A new animation that takes the place of one of its group starts from what that one has reached (its first keyframe is replaced). */
  continueFrom?: boolean;
}

/**
 * Starts one animation on one element, in `STANDARD` easing. The only `element.animate` the build page makes.
 * A slide is added on top of what the element is doing; anything else takes the place of the running one of its group, from where
 * that one is drawn (with `continueFrom`), so the two never fight and nothing jumps. Returns null under reduced motion.
 */
export function animateOn(element: Element, name: string, frames: Keyframe[], { continueFrom = false, ...options }: AnimateOptions): Animation | null {
  if (!canAnimate(element)) return null;
  const group = GROUP[name] ?? name;
  let keyframes = frames;
  if (name !== "slide" && typeof element.getAnimations === "function") {
    // Ours of the same group: one still running hands over where it has the element; one that has ended but still holds it (its
    // fill) lets go. Read first, then let go, so the new one carries on from there in the same frame.
    const earlier = element.getAnimations().filter((animation) => {
      const id = String(animation.id);
      if (!id.startsWith(OURS) || (GROUP[id.slice(OURS.length)] ?? id.slice(OURS.length)) !== group) return false;
      const fill = (animation.effect as KeyframeEffect | null)?.getTiming?.().fill;
      return animation.playState === "running" || (animation.playState === "finished" && (fill === "forwards" || fill === "both"));
    });
    const from = continueFrom && earlier.some((animation) => animation.playState === "running") ? drawnNow(element) : null;
    for (const animation of earlier) animation.cancel();
    if (from && frames.length > 0) keyframes = [{ ...frames[0], ...pick(from, frames[0]) }, ...frames.slice(1)];
  }
  const animation = element.animate(keyframes, { easing: STANDARD, ...options, id: `${OURS}${name}` });
  track(element, group, animation);
  return animation;
}

/** Of what is drawn now, the properties the first keyframe animates. */
const pick = (drawn: Keyframe, first: Keyframe): Keyframe => Object.fromEntries(Object.keys(first).filter((key) => key in drawn).map((key) => [key, drawn[key]]));

/** Whatever of ours is sliding in `root` ends at once: reduced motion turned on while something moved. */
export function finishSlides(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>(`[${SLIDE_ATTR}]`)) {
    const slides = RUNNING.get(element)?.get("slide");
    if (slides) for (const animation of [...slides]) animation.finish();
  }
}

/* ── slides ── */

/** An element as it is drawn now: where, and how big, a running transform included. */
export interface Drawn extends Box {
  element: HTMLElement;
}

export type Measure = Map<string, Drawn>;

const LISTS = '[data-testid="session-tiles"]';

const viewHeight = (): number => (typeof window === "undefined" ? 0 : window.innerHeight || 0);

/** Whether any of a box is in the window, or near it. Nothing is slid that is not, before or after: it cannot be seen to move. */
const seen = (box: Box): boolean => {
  const height = viewHeight() || Number.POSITIVE_INFINITY;
  return box.y + box.h > 0 && box.y < height;
};

/**
 * Where every element that can slide is drawn, by its `data-slide-id`. A session the browser skips is read as one box: none of what
 * is in it is read, so none of it is laid out. An element with no box (not drawn) is left out.
 */
export function measureDrawn(root: ParentNode): Measure {
  const out: Measure = new Map();
  const height = viewHeight();
  const skipped = new Set<Element>();
  for (const list of root.querySelectorAll<HTMLElement>(LISTS)) {
    if (list.style.contentVisibility !== "auto") continue;
    const box = list.getBoundingClientRect();
    if (box.bottom < -height || box.top > 2 * height) skipped.add(list);
  }
  for (const element of root.querySelectorAll<HTMLElement>(`[${SLIDE_ATTR}]`)) {
    if (skipped.size > 0) {
      const list = element.closest(LISTS);
      if (list && skipped.has(list)) continue;
    }
    const r = element.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    out.set(element.getAttribute(SLIDE_ATTR) as string, { element, x: r.left, y: r.top, w: r.width, h: r.height });
  }
  return out;
}

export interface SlideOptions {
  /** How long; by default the slide's own timing. */
  ms?: number;
  /** Before the slide starts: what slides sits where it was until then. */
  delay?: number;
}

export interface Plan {
  /** Counts up with every commit that slid something. */
  id: number;
  /** The slide ids that moved, and the ones that came and went, without their kind (`tile:p2` is `p2`). */
  moved: string[];
  added: string[];
  removed: string[];
  /** How long its slides take, all of them. */
  ms: number;
  slides: MotionRun;
}

const EMPTY_PLAN: Plan = { id: 0, moved: [], added: [], removed: [], ms: 0, slides: DONE };

/** `tile:p2` is `p2`: labels name the thing, not its kind. */
const bare = (slideId: string): string => slideId.slice(slideId.indexOf(":") + 1);

/** The nearest element round `element` that slides too. */
const slidingParent = (element: HTMLElement): HTMLElement | null => element.parentElement?.closest<HTMLElement>(`[${SLIDE_ATTR}]`) ?? null;

/**
 * From where things were drawn to where they stand now. Every element that moved slides from its old place; an element inside
 * another that slides moves only by its own part of the change, since its parent carries it the rest. Reads first, then writes.
 */
export function planSlides(before: Measure, after: Measure, options: SlideOptions, id: number): Plan {
  const moves: { element: HTMLElement; dx: number; dy: number }[] = [];
  const grown: { element: HTMLElement; by: number }[] = [];
  const by = new Map<string, { dx: number; dy: number }>();
  for (const [key, now] of after) {
    const was = before.get(key);
    if (!was) continue;
    let dx = was.x - now.x;
    let dy = was.y - now.y;
    const parent = slidingParent(now.element);
    const carried = parent ? by.get(parent.getAttribute(SLIDE_ATTR) as string) : undefined;
    if (carried) {
      dx -= carried.dx;
      dy -= carried.dy;
    }
    if (!seen(was) && !seen(now)) continue;
    // A thing that grew (a tile that took a nested row, a tile converted to a taller kind) opens down.
    if (now.h - was.h > 1) grown.push({ element: now.element, by: now.h - was.h });
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    by.set(key, { dx: dx + (carried?.dx ?? 0), dy: dy + (carried?.dy ?? 0) });
    moves.push({ element: now.element, dx, dy });
  }
  const ms = options.ms ?? SLIDE;
  const delay = options.delay ?? 0;
  const slides = moves.map(({ element, dx, dy }) =>
    animateOn(element, "slide", [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: ms, composite: "add", ...(delay > 0 ? { delay, fill: "backwards" as const } : null) }),
  );
  for (const { element, by: height } of grown) slides.push(animateOn(element, "grow", [{ clipPath: `inset(0 0 ${height}px 0)` }, { clipPath: "inset(0 0 0 0)" }], { duration: BASE, ...(delay > 0 ? { delay, fill: "backwards" as const } : null) }));
  return {
    id,
    moved: [...by.keys()].map(bare),
    added: [...after.keys()].filter((key) => !before.has(key)).map(bare),
    removed: [...before.keys()].filter((key) => !after.has(key)).map(bare),
    ms: moves.length > 0 ? ms : 0,
    slides: runOf(slides),
  };
}

/** A box of the skeleton that stands somewhere else now: it slides from where it was, and a lane scales from its old size. */
export function slideBox(element: HTMLElement, from: Box, to: Box, ms: number = SLIDE): MotionRun {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const sx = to.w > 0 ? from.w / to.w : 1;
  const sy = to.h > 0 ? from.h / to.h : 1;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) return DONE;
  return runOf([animateOn(element, "slide", [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: "0 0" }, { transform: "none", transformOrigin: "0 0" }], { duration: ms, composite: "add" })]);
}

/* ── words that change, through the same pass ── */

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

/** The old words (a fixed layer, so nothing in the page moves) fade out over the new, which fade in, over `ms`. */
export function crossfadeFrom(words: Words | null, element: HTMLElement, ms: number): MotionRun {
  if (!words || !canAnimate(element)) return DONE;
  const { clone, box, style } = words;
  Object.assign(clone.style, { position: "fixed", left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, margin: "0", pointerEvents: "none", zIndex: "100", ...style });
  element.ownerDocument.body.appendChild(clone);
  const gone = animateOn(clone, "crossfade-old", [{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: "forwards" });
  const arriving = animateOn(element, "crossfade", [{ opacity: 0 }, { opacity: 1 }], { duration: ms, fill: "backwards", continueFrom: true });
  return runOf([gone, arriving], () => clone.remove());
}

/** Whether an element is in the window. With no layout to read (a test's jsdom) it is taken to be. */
export const inWindow = (element: HTMLElement): boolean => {
  const box = element.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return true;
  return box.bottom > 0 && box.top < (viewHeight() || Number.POSITIVE_INFINITY);
};

/** A number or a word the List crossfades when it changes (`useCrossfade`). */
export interface WordsEntry {
  ref: RefObject<HTMLElement | null>;
  /** Its words changed in the render now being committed. */
  pending: boolean;
  /** Only crossfade when the words stayed where they were. */
  inPlace: boolean;
  ms: number;
  captured: Words | null;
}

/** Taken before the DOM changes: only words that can be seen change before the eye. */
function captureEntry(entry: WordsEntry) {
  const element = entry.ref.current;
  entry.captured = entry.pending && element && canAnimate(element) && inWindow(element) ? captureWords(element) : null;
}

/** Played after: words that moved (a session's head sliding to its new place) are simply the new ones, with `inPlace`. */
function playEntry(entry: WordsEntry) {
  const element = entry.ref.current;
  const words = entry.captured;
  entry.pending = false;
  entry.captured = null;
  if (!words || !element) return;
  if (entry.inPlace) {
    const box = element.getBoundingClientRect();
    if (Math.abs(box.left - words.box.left) > 1 || Math.abs(box.top - words.box.top) > 1) return;
  }
  crossfadeFrom(words, element, entry.ms);
}

/* ── the animator ── */

export interface ListMotion {
  channel: MotionChannel;
  /** Reads where everything is drawn: `MotionBoundary`, before the DOM changes. */
  measure: () => Measure | null;
  /** Slides what moved since `measure`: `MotionBoundary`, after. */
  commit: (before: Measure | null, options: SlideOptions) => Plan;
  /** The plan of the last commit that slid something. */
  plan: () => Plan;
  /** The label for a change that touches `keys`, spent. */
  take: (keys: Iterable<string>) => MotionLabel | null;
  /** A number or a word that crossfades, measured in the same pass. */
  words: (entry: WordsEntry) => () => void;
  /** Something to read before the DOM changes, in the same pass (the words of a tile about to be converted). */
  onMeasure: (listener: () => void) => () => void;
}

export function useListMotion(rootRef: RefObject<HTMLElement | null>): ListMotion {
  const channel = useMotionChannel();
  const state = useRef<{ plan: Plan; count: number; words: Set<WordsEntry>; listeners: Set<() => void> }>({ plan: EMPTY_PLAN, count: 0, words: new Set(), listeners: new Set() });
  const [motion] = useState<ListMotion>(() => ({
    channel,
    measure: () => {
      const root = rootRef.current;
      if (!root || !motionOn()) return null;
      for (const listener of state.current.listeners) listener();
      for (const entry of state.current.words) if (entry.pending) captureEntry(entry);
      return measureDrawn(root);
    },
    commit: (before, options) => {
      const root = rootRef.current;
      for (const entry of state.current.words) if (entry.pending) playEntry(entry);
      if (!root || !before) return state.current.plan;
      const plan = planSlides(before, measureDrawn(root), options, state.current.count + 1);
      if (plan.ms > 0 || plan.added.length + plan.removed.length > 0) {
        state.current.count = plan.id;
        state.current.plan = plan;
      }
      return plan;
    },
    plan: () => state.current.plan,
    take: (keys) => motion.channel.take(keys),
    words: (entry) => {
      state.current.words.add(entry);
      return () => state.current.words.delete(entry);
    },
    onMeasure: (listener) => {
      state.current.listeners.add(listener);
      return () => state.current.listeners.delete(listener);
    },
  }));
  // The page's channel can be given after the List first draws.
  motion.channel = channel;
  return motion;
}

/** What draws inside the List and plays through its animator: the skeleton, the numbers. */
export const ListMotionContext = createContext<ListMotion | null>(null);

export const useListAnimator = (): ListMotion | null => useContext(ListMotionContext);

/* ── the boundary ── */

interface BoundaryProps {
  motion: ListMotion;
  /** How this commit's slides go, when a module times them (a fold, a lane opening, a put back). */
  slide: SlideOptions;
  /** Measure this commit at all: false leaves it alone (Sources slides only when a lifted row lets go). True by default. */
  when?: boolean;
  children: ReactNode;
}

/** Slides in their own timing. */
export const NO_SLIDE: SlideOptions = {};

/**
 * Round the List. It draws nothing of its own. Before each commit changes the DOM it has the animator read where everything is
 * drawn; after, the animator slides what moved. React runs this before the List's own layout effects, so the director, the fold
 * and the arrival see this commit's plan when they run.
 */
export class MotionBoundary extends Component<BoundaryProps> {
  getSnapshotBeforeUpdate(): Measure | null {
    return this.props.when === false ? null : this.props.motion.measure();
  }

  componentDidUpdate(_: BoundaryProps, __: unknown, before: Measure | null): void {
    this.props.motion.commit(before, this.props.slide);
  }

  render() {
    return this.props.children;
  }
}
