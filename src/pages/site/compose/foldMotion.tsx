/* CA-22 P5: folding and unfolding a session or a part.

   FOLD. The tiles rise `FOLD_RISE` (24) behind the head and fade over `FOLD`, and the space they took closes in the same time, with
   everything below sliding up. To do both at once the tiles are kept on screen while the space is already gone: the run's box is
   set to nothing for the length of the fold (its tiles overflow, painted, and are lifting away), then the page is drawn folded.
   UNFOLD. The space opens (the session grows, revealed by clip-path as every grown thing is) and the tiles come down from 24 above,
   top first, `UNFOLD_STAGGER` (40) apart; from the 8th on they come together.
   The arrow turns over `SLIDE`. Collapse all and Expand all fold every session and part at once: no stagger between sessions.
   Folded sessions' counts ("3 tiles") fade in with the fold.

   WHEN it happens is read from the page's own folded sets: a change in them is a fold, whoever made it (the arrow, Collapse all, a
   tile dropped on a folded head). Under reduced motion nothing here runs: the page is drawn folded or open at once. */

import { useLayoutEffect, useRef, useState } from "react";

import { FOLD, FOLD_RISE, SLIDE, UNFOLD_STAGGER, UNFOLD_STAGGERED } from "@/lib/build/buildMotion";
import { prefersReducedMotion, STANDARD } from "@/lib/theme/motion";

import { dropIn, fadeIn, finishRunning, liftOut, type MotionRun } from "./buildMotion";
import { finishSlides, play, snapshot, type Box } from "./flip";

export interface FoldHold {
  /** Sessions being folded: their tiles stay drawn until the fold ends. */
  sessions: ReadonlySet<string>;
  /** Parts being folded: their sessions stay drawn until the fold ends. */
  parts: ReadonlySet<string>;
}

const NONE: FoldHold = { sessions: new Set(), parts: new Set() };

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((key) => b.has(key));

/** What a folded session hides: its tiles, and the lines and rows around them. */
const tilesIn = (container: HTMLElement): HTMLElement[] => [...container.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
const sessionContainer = (root: HTMLElement, key: string) => root.querySelector<HTMLElement>(`[id="session-tiles-${key}"]`);
const partContainer = (root: HTMLElement, key: string) => root.querySelector<HTMLElement>(`[id="workstream-body-${key}"]`);
const sessionsIn = (container: HTMLElement): HTMLElement[] => [...container.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
const arrowOf = (root: HTMLElement, controls: string) => root.querySelector(`[aria-controls="${controls}"]`);

/** The run's box set to nothing while its children stay painted; returns the way back. */
function collapseInPlace(container: HTMLElement): () => void {
  const was = { height: container.style.height, marginTop: container.style.marginTop, overflow: container.style.overflow };
  const gap = Number.parseFloat(getComputedStyle(container.parentElement ?? container).rowGap) || 0;
  container.style.height = "0px";
  container.style.overflow = "visible";
  // Folded, the run is not drawn at all, so neither is its margin nor the gap before it: cancel both.
  container.style.marginTop = `${-gap}px`;
  return () => {
    container.style.height = was.height;
    container.style.marginTop = was.marginTop;
    container.style.overflow = was.overflow;
  };
}

/** The arrow turns: the glyph is already the new one, so it starts as the old one (a quarter turn) and settles. */
function turnArrow(toggle: Element | null, folding: boolean): MotionRun | null {
  if (!toggle || prefersReducedMotion() || typeof (toggle as HTMLElement).animate !== "function") return null;
  const animation = (toggle as HTMLElement).animate([{ transform: `rotate(${folding ? 90 : -90}deg)` }, { transform: "none" }], { duration: SLIDE, easing: STANDARD, id: "bm:arrow" });
  return { finished: Promise.resolve(animation.finished).then(() => undefined, () => undefined), finish: () => animation.finish?.(), cancel: () => animation.cancel?.() };
}

export function useFoldMotion({ sessions, parts, getRoot }: { sessions: ReadonlySet<string> | undefined; parts: ReadonlySet<string>; getRoot: () => HTMLElement | null }): FoldHold {
  const last = useRef<{ sessions: ReadonlySet<string>; parts: ReadonlySet<string> } | null>(null);
  const held = useRef<FoldHold>(NONE);
  const pending = useRef<{ closing: { sessions: string[]; parts: string[] }; opening: { sessions: string[]; parts: string[] }; before: Map<string, Box> } | null>(null);
  const timers = useRef<number[]>([]);
  const restores = useRef<(() => void)[]>([]);
  const runs = useRef<MotionRun[]>([]);
  const [, redraw] = useState(0);
  const now = { sessions: sessions ?? (NONE.sessions as ReadonlySet<string>), parts };

  if (last.current === null) last.current = now;
  else if (!sameSet(last.current.sessions, now.sessions) || !sameSet(last.current.parts, now.parts)) {
    const root = getRoot();
    const closing = { sessions: [...now.sessions].filter((key) => !last.current?.sessions.has(key)), parts: [...now.parts].filter((key) => !last.current?.parts.has(key)) };
    const opening = { sessions: [...last.current.sessions].filter((key) => !now.sessions.has(key)), parts: [...last.current.parts].filter((key) => !now.parts.has(key)) };
    last.current = now;
    if (root && !prefersReducedMotion()) {
      // A fold while another is running: that one ends now, then this one is measured.
      finishAll();
      pending.current = { closing, opening, before: snapshot(root) };
      held.current = { sessions: new Set(closing.sessions), parts: new Set(closing.parts) };
    }
  }

  function finishAll() {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
    for (const restore of restores.current) restore();
    restores.current = [];
    for (const run of runs.current) run.finish();
    runs.current = [];
    const root = getRoot();
    if (root) {
      finishSlides(root);
      for (const element of root.querySelectorAll<HTMLElement>("[data-skel-kind]")) finishRunning(element);
    }
    held.current = NONE;
  }

  useLayoutEffect(() => {
    const work = pending.current;
    const root = getRoot();
    if (!work || !root) return;
    pending.current = null;
    // The space closes and opens now, in the same time as the tiles move; what stood below slides from where it stood.
    for (const key of work.closing.sessions) {
      const container = sessionContainer(root, key);
      if (!container) continue;
      restores.current.push(collapseInPlace(container));
      runs.current.push(liftOut(tilesIn(container), { rise: FOLD_RISE, ms: FOLD }));
      runs.current.push(fadeIn([...root.querySelectorAll(`[data-session-key="${key}"] [data-testid="session-count"]`)], { ms: FOLD }));
      runs.current.push(...[turnArrow(arrowOf(root, `session-tiles-${key}`), true)].filter((run): run is MotionRun => run !== null));
    }
    for (const key of work.closing.parts) {
      const container = partContainer(root, key);
      if (!container) continue;
      restores.current.push(collapseInPlace(container));
      runs.current.push(liftOut(sessionsIn(container), { rise: FOLD_RISE, ms: FOLD }));
      runs.current.push(...[turnArrow(arrowOf(root, `workstream-body-${key}`), true)].filter((run): run is MotionRun => run !== null));
    }
    for (const key of work.opening.sessions) {
      const container = sessionContainer(root, key);
      if (!container) continue;
      runs.current.push(dropIn(tilesIn(container), { stagger: UNFOLD_STAGGER, cap: UNFOLD_STAGGERED, from: FOLD_RISE, ms: FOLD }));
      runs.current.push(...[turnArrow(arrowOf(root, `session-tiles-${key}`), false)].filter((run): run is MotionRun => run !== null));
    }
    for (const key of work.opening.parts) {
      const container = partContainer(root, key);
      if (!container) continue;
      runs.current.push(dropIn(sessionsIn(container), { stagger: 0, from: FOLD_RISE, ms: FOLD }));
      runs.current.push(...[turnArrow(arrowOf(root, `workstream-body-${key}`), false)].filter((run): run is MotionRun => run !== null));
    }
    play(root, work.before, FOLD);
    if (held.current.sessions.size + held.current.parts.size > 0) {
      timers.current.push(
        window.setTimeout(() => {
          for (const restore of restores.current) restore();
          restores.current = [];
          held.current = NONE;
          redraw((value) => value + 1);
        }, FOLD),
      );
    }
  });

  useLayoutEffect(() => finishAll, []); // eslint-disable-line react-hooks/exhaustive-deps

  return held.current;
}
