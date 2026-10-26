/* CA-22 P5: folding and unfolding a session or a part.

   FOLD. The tiles rise `FOLD_RISE` (24) behind the head and fade over `FOLD`, and the space they took closes in the same time, with
   everything below sliding up. To do both at once the tiles are kept on screen while the space is already gone: the run's box is
   drawn at no height for the length of the fold (`FOLD_SHUT`: its tiles overflow, painted, and are lifting away), then the page is
   drawn folded. SV-06: that is a style the List draws, not one set by hand afterwards, so the animator's pass round the commit
   measures the closed space and slides what stood below, over `FOLD`.
   UNFOLD. The space opens (the session grows, revealed by clip-path as every grown thing is) and the tiles come down from 24 above,
   top first, `UNFOLD_STAGGER` (40) apart; from the 8th on they come together.
   The arrow turns over `SLIDE`. Collapse all and Expand all fold every session and part at once: no stagger between sessions.
   Folded sessions' counts ("3 tiles") fade in with the fold.

   WHEN it happens is read from the page's own folded sets: a change in them is a fold, whoever made it (the arrow, Collapse all, a
   tile dropped on a folded head). Under reduced motion nothing here runs: the page is drawn folded or open at once. */

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { FOLD, FOLD_RISE, SLIDE, UNFOLD_STAGGER, UNFOLD_STAGGERED } from "@/lib/build/buildMotion";

import { dropIn, fadeIn, liftOut, motionOn, type MotionRun } from "./buildMotion";
import { animateOn, runOf } from "./listMotion";

export interface FoldHold {
  /** Sessions being folded: their tiles stay drawn until the fold ends. */
  sessions: ReadonlySet<string>;
  /** Parts being folded: their sessions stay drawn until the fold ends. */
  parts: ReadonlySet<string>;
  /** This render folds or unfolds something: what slides, slides over `FOLD`. */
  moving: boolean;
}

const NONE: FoldHold = { sessions: new Set(), parts: new Set(), moving: false };

/**
 * A run being folded, drawn at no height while its children stay painted. Folded, the run is not drawn at all, so neither is its
 * margin nor the gap before it: both are cancelled (`gap`, the gap of what holds it: 4 in a session, 8 in a part).
 */
export const foldShut = (gap: number): CSSProperties => ({ height: 0, overflow: "visible", marginTop: -gap });

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((key) => b.has(key));

/** What a folded session hides: its tiles, and the lines and rows around them. */
const tilesIn = (container: HTMLElement): HTMLElement[] => [...container.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
const sessionContainer = (root: HTMLElement, key: string) => root.querySelector<HTMLElement>(`[id="session-tiles-${key}"]`);
const partContainer = (root: HTMLElement, key: string) => root.querySelector<HTMLElement>(`[id="workstream-body-${key}"]`);
const sessionsIn = (container: HTMLElement): HTMLElement[] => [...container.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
const arrowOf = (root: HTMLElement, controls: string) => root.querySelector(`[aria-controls="${controls}"]`);

/** The arrow turns: the glyph is already the new one, so it starts as the old one (a quarter turn) and settles. */
function turnArrow(toggle: Element | null, folding: boolean): MotionRun | null {
  if (!toggle) return null;
  const animation = animateOn(toggle, "arrow", [{ transform: `rotate(${folding ? 90 : -90}deg)` }, { transform: "none" }], { duration: SLIDE });
  return animation ? runOf([animation]) : null;
}

export function useFoldMotion({ sessions, parts, getRoot }: { sessions: ReadonlySet<string> | undefined; parts: ReadonlySet<string>; getRoot: () => HTMLElement | null }): FoldHold {
  const last = useRef<{ sessions: ReadonlySet<string>; parts: ReadonlySet<string> } | null>(null);
  const held = useRef<FoldHold>(NONE);
  const pending = useRef<{ closing: { sessions: string[]; parts: string[] }; opening: { sessions: string[]; parts: string[] } } | null>(null);
  const timers = useRef<number[]>([]);
  const [, redraw] = useState(0);
  const now = { sessions: sessions ?? (NONE.sessions as ReadonlySet<string>), parts };

  // A change in the folded sets is a fold, whoever made it; worked out from the sets alone, nothing is measured here.
  let moving = false;
  if (last.current === null) last.current = now;
  else if (!sameSet(last.current.sessions, now.sessions) || !sameSet(last.current.parts, now.parts)) {
    const closing = { sessions: [...now.sessions].filter((key) => !last.current?.sessions.has(key)), parts: [...now.parts].filter((key) => !last.current?.parts.has(key)) };
    const opening = { sessions: [...last.current.sessions].filter((key) => !now.sessions.has(key)), parts: [...last.current.parts].filter((key) => !now.parts.has(key)) };
    last.current = now;
    if (motionOn()) {
      // A fold while another is running: that one's steps stop; what is still folding stays held, and this one is added to it.
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
      const keep = (set: ReadonlySet<string>, open: string[], add: string[]) => new Set([...[...set].filter((key) => !open.includes(key)), ...add]);
      held.current = { sessions: keep(held.current.sessions, opening.sessions, closing.sessions), parts: keep(held.current.parts, opening.parts, closing.parts), moving: true };
      pending.current = { closing, opening };
      moving = true;
    }
  }

  useLayoutEffect(() => {
    const work = pending.current;
    const root = getRoot();
    if (!work || !root) return;
    pending.current = null;
    // The space has closed or opened in this commit, and what stood below is already sliding; the tiles move in the same time.
    for (const key of work.closing.sessions) {
      const container = sessionContainer(root, key);
      if (!container) continue;
      liftOut(tilesIn(container), { rise: FOLD_RISE, ms: FOLD });
      fadeIn([...root.querySelectorAll(`[data-session-key="${key}"] [data-testid="session-count"]`)], { ms: FOLD });
      turnArrow(arrowOf(root, `session-tiles-${key}`), true);
    }
    for (const key of work.closing.parts) {
      const container = partContainer(root, key);
      if (!container) continue;
      liftOut(sessionsIn(container), { rise: FOLD_RISE, ms: FOLD });
      turnArrow(arrowOf(root, `workstream-body-${key}`), true);
    }
    for (const key of work.opening.sessions) {
      const container = sessionContainer(root, key);
      if (!container) continue;
      dropIn(tilesIn(container), { stagger: UNFOLD_STAGGER, cap: UNFOLD_STAGGERED, from: FOLD_RISE, ms: FOLD });
      turnArrow(arrowOf(root, `session-tiles-${key}`), false);
    }
    for (const key of work.opening.parts) {
      const container = partContainer(root, key);
      if (!container) continue;
      dropIn(sessionsIn(container), { stagger: 0, from: FOLD_RISE, ms: FOLD });
      turnArrow(arrowOf(root, `workstream-body-${key}`), false);
    }
    if (held.current.sessions.size + held.current.parts.size > 0) {
      timers.current.push(
        window.setTimeout(() => {
          held.current = NONE;
          redraw((value) => value + 1);
        }, FOLD),
      );
    } else held.current = NONE;
  });

  useLayoutEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  return { ...held.current, moving };
}
