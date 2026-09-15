// buildgallery.ai — the motion vocabulary.
//
// BG-P32. THE ONE PLACE A DURATION IS DECIDED. Before this module the remodel
// had accumulated eleven distinct durations (100, 140, 150, 160, 180, 200, 240,
// 300, 480, 500, 600ms) and five easings across 278 files, most of them arrived
// at by whichever prompt happened to be writing that surface. That is the
// scattered, per-file motion the `design-motion-principles` audit calls slop:
// not any one value being wrong, but there being no answer to "how fast is a
// hover here" other than "look at the file".
//
// So: three durations, two curves, four patterns. Everything in `src/` imports
// from here and nothing declares its own. If a surface needs a duration this
// module does not name, the answer is to argue for it here — not to write a
// number into a component.
//
// WHAT THE THEME BINDS (`buildgallery-theme` §Motion), and what each rule costs
// if broken:
//
//   • UI feedback ≤200ms, `transform` and `opacity` only. Those are the two
//     properties the compositor can animate without consulting layout or paint.
//   • Never `transition: all`. `all` subscribes to every property the element
//     will ever have, including the layout ones, so a class change three
//     prompts from now silently starts animating `height`.
//   • Never `ease-in` on UI. A control that starts slowly reads as an
//     unresponsive control; the delay is at the front, where the reader is
//     still waiting to learn whether their click registered.
//   • Never animate `box-shadow`. It is not compositable, so it re-rasterises
//     the element every frame — a grid of twenty-four hovering cards is what
//     that costs. A changing shadow goes on a pseudo-element whose OPACITY is
//     animated; `index.css` carries the two that need it.
//   • Never animate a layout property — width, height, top, left, margin,
//     padding. Each one invalidates layout for the whole subtree.
//   • Hover motion gated behind `(hover: hover) and (pointer: fine)`, because
//     on a touch screen `:hover` sticks after a tap and leaves the control
//     looking permanently pressed.
//   • `prefers-reduced-motion: reduce` disables everything, in CSS *and* here.
//
// TWO ANSWERS TO REDUCED MOTION, DELIBERATELY. This module returns "none" from
// every builder, which covers every render; `index.css` carries a global rule
// that covers the gap that leaves — a visitor who changes the setting while a
// surface is already on screen, where nothing would re-render to notice. Either
// alone leaves a hole. The CSS values below are mirrored as `--motion-*` custom
// properties in `index.css` and `motion.test.ts` holds the two to each other.

import type { CSSProperties } from "react";

/* ── Durations ────────────────────────────────────────────────────────────────
   Three, and the theme names all three. `themeSwitch` is a fourth only in the
   sense that BG-P02 fixed it before this module existed and item 5 of this
   prompt re-verifies it rather than re-deciding it.
   ─────────────────────────────────────────────────────────────────────────── */

/** 150ms. Hover, focus, press — anything the reader is waiting on. */
export const FAST = 150;

/** 200ms. The theme's ceiling for UI feedback. Sheets, disclosure, tab bodies. */
export const BASE = 200;

/** 450ms. Scroll entry, and nothing else. The theme gives this figure directly. */
export const REVEAL = 450;

/** 180ms. The theme-switch cross-fade (BG-P02). Colour properties only. */
export const THEME_SWITCH = 180;

/** The 14px rise a revealed element travels. The theme gives this figure too. */
export const REVEAL_SHIFT = 14;

/* ── Loop durations ───────────────────────────────────────────────────────────
   An ambient loop is not UI feedback and is not bound by the 200ms ceiling —
   nobody is waiting on a skeleton to finish shimmering. They are named here
   anyway, for the same reason the transitions are: so that "how fast does a
   skeleton sweep" has one answer rather than one per file. Every loop below
   is `opacity`, `transform` or `background-position` only, and every one is
   suppressed under reduced motion by `animation()` and by the global rule in
   `index.css`.
   ─────────────────────────────────────────────────────────────────────────── */

/** The skeleton's highlight sweep. */
export const SHIMMER_MS = 1600;

/** One turn of a spinner. Paired with `LINEAR`, never with `STANDARD`. */
export const SPIN_MS = 1000;

/** Every duration this system knows, by name. */
export const DURATION = {
  fast: FAST,
  base: BASE,
  reveal: REVEAL,
  themeSwitch: THEME_SWITCH,
} as const;

export type DurationName = keyof typeof DURATION;

/* ── Easing ───────────────────────────────────────────────────────────────────
   Two curves. `standard` is fast out of the gate and settles — the shape of a
   control that has already heard you. `linear` exists for continuous rotation
   only, where any easing would make a spinner visibly stutter once per turn.

   There is no `ease-in` and no exit curve, because the theme forbids the first
   on UI and this product has no exit that is not a fade.
   ─────────────────────────────────────────────────────────────────────────── */

/** The product's one curve. Never `ease-in`: see the header. */
export const STANDARD = "cubic-bezier(.2,.6,.35,1)";

/** Continuous rotation only — spinners. Never for a transition with two ends. */
export const LINEAR = "linear";

export const EASING = {
  standard: STANDARD,
  linear: LINEAR,
} as const;

export type EasingName = keyof typeof EASING;

/* ── The properties that may be transitioned ──────────────────────────────────
   A closed list, so that `transition: all` cannot be reintroduced by spelling
   it differently. `box-shadow` is absent and so is every layout property; the
   type makes reaching for one a build error rather than a review comment.
   ─────────────────────────────────────────────────────────────────────────── */

export type MotionProperty =
  | "background-color"
  | "border-color"
  | "color"
  | "opacity"
  | "transform"
  | "fill"
  | "stroke"
  | "text-decoration-color"
  | "text-decoration-thickness"
  | "outline-color";

/** What a control changes when it is hovered, focused or pressed. */
const FEEDBACK_PROPERTIES: readonly MotionProperty[] = [
  "background-color",
  "border-color",
  "color",
  "opacity",
  "transform",
];

/* ── Media queries ────────────────────────────────────────────────────────────
   One MediaQueryList per query for the whole app rather than one per caller.
   `.matches` is live, so a cached list stays current without a listener, and a
   component that re-renders for any other reason reads the new value.
   ─────────────────────────────────────────────────────────────────────────── */

export const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const lists = new Map<string, MediaQueryList | null>();

function matchesMedia(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  if (!lists.has(query)) {
    try {
      lists.set(query, window.matchMedia(query));
    } catch {
      lists.set(query, null);
    }
  }
  return lists.get(query)?.matches ?? false;
}

/** Test seam. Nothing in `src/` outside the motion tests calls this. */
export function __resetMotionMediaCache(): void {
  lists.clear();
}

/**
 * True where a hover state is worth showing at all.
 *
 * The CSS half of this gate is Tailwind's `hoverOnlyWhenSupported` flag, which
 * compiles every `hover:` utility into this same media query. This is the half
 * for hover carried in a style object, where there is no selector to gate.
 */
export const hoverIsFine = (): boolean => matchesMedia(HOVER_QUERY);

/** True when the visitor has asked for less motion. Honoured in CSS *and* here. */
export const prefersReducedMotion = (): boolean => matchesMedia(REDUCED_MOTION_QUERY);

/* ── The four patterns ────────────────────────────────────────────────────────
   Every transition in the product is one of these. Each returns "none" under
   reduced motion: the end state is identical, it simply arrives at once.
   Nothing here is load-bearing for comprehension, so nothing is lost by
   skipping it.
   ─────────────────────────────────────────────────────────────────────────── */

function compose(properties: readonly MotionProperty[], ms: number, delayMs = 0): string {
  const suffix = delayMs > 0 ? ` ${delayMs}ms` : "";
  return properties.map((property) => `${property} ${ms}ms ${STANDARD}${suffix}`).join(", ");
}

/**
 * PATTERN 1 — UI feedback. Hover, focus, press, selection, disabled.
 *
 * Defaults to the five properties a control actually changes. Pass a narrower
 * list where a surface only changes one: a transition that names three
 * properties it never touches costs nothing at runtime but tells the next
 * reader the wrong thing about what moves.
 */
export function feedback(...properties: readonly MotionProperty[]): string {
  if (prefersReducedMotion()) return "none";
  return compose(properties.length > 0 ? properties : FEEDBACK_PROPERTIES, FAST);
}

/**
 * PATTERN 2 — a cross-fade. Opacity alone, for something appearing in place:
 * an overlay control, a shadow on a pseudo-element, a hint that fades in.
 */
export function fade(ms: number = FAST): string {
  if (prefersReducedMotion()) return "none";
  return compose(["opacity"], ms);
}

/**
 * PATTERN 3 — travel. Transform alone, at the 200ms ceiling: a sheet sliding,
 * a chevron rotating, a drawer arriving. Never paired with a layout property.
 */
export function move(ms: number = BASE): string {
  if (prefersReducedMotion()) return "none";
  return compose(["transform"], ms);
}

/**
 * PATTERN 4 — scroll entry. 450ms opacity plus transform, optionally staggered.
 *
 * Permitted on exactly two surfaces (`buildgallery-theme` §Motion): the gallery
 * grid's list entrance and the build page's section reveals. App surfaces get
 * list entrances and skeletons, never scroll storytelling — if you are reaching
 * for this on a third surface, the answer is that the surface does not get one.
 */
export function reveal(delayMs = 0): string {
  if (prefersReducedMotion()) return "none";
  return compose(["opacity", "transform"], REVEAL, delayMs);
}

/**
 * The hidden half of a reveal: what the element looks like before it arrives.
 *
 * AFTER THE REVEAL THE TRANSFORM IS `none` RATHER THAN `translateY(0)`. A
 * lingering transform makes the element a containing block, and a card inside
 * it carrying `backdrop-filter` would then sample that element rather than the
 * page — quietly changing what the glass is made of. `none` interpolates from a
 * translate exactly as `translateY(0)` does and leaves nothing behind.
 */
export function revealFrom(): CSSProperties {
  return { opacity: 0, transform: `translateY(${REVEAL_SHIFT}px)` };
}

/** The arrived half of a reveal. */
export function revealTo(delayMs = 0): CSSProperties {
  return { opacity: 1, transform: "none", transition: reveal(delayMs) };
}

/**
 * Whether a scroll reveal can run at all.
 *
 * False under reduced motion, and false without IntersectionObserver — a
 * surface that started at opacity 0 with nothing to bring it back is a blank
 * page, which is a worse failure than no animation.
 */
export const canReveal = (): boolean =>
  !prefersReducedMotion() && typeof IntersectionObserver !== "undefined";

/** The 1px lift a control takes on hover. Suppressed for reduced motion. */
export function hoverLift(active: boolean): CSSProperties {
  if (!active || prefersReducedMotion()) return {};
  return { transform: "translateY(-1px)" };
}

/**
 * A named keyframe animation, or `undefined` under reduced motion.
 *
 * Keyframes live in `index.css` and are referenced by name from an inline
 * `animation` — the theme's one sanctioned exception to inline styling. This
 * wrapper is how a component spends one without re-deciding what reduced motion
 * means. Pair it with `data-bg-animated` on the same element so the CSS half of
 * the guarantee reaches it too.
 */
export function animation(
  name: string,
  ms: number,
  { easing = STANDARD, delayMs = 0, iterations = 1 as number | "infinite" } = {},
): string | undefined {
  if (prefersReducedMotion()) return undefined;
  const count = iterations === "infinite" ? "infinite" : String(iterations);
  return `${name} ${ms}ms ${easing}${delayMs > 0 ? ` ${delayMs}ms` : ""} ${count}`;
}
