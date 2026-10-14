// buildgallery.ai — the scroll reveal, once, on two surfaces.
//
// BG-P32. `buildgallery-theme` §Motion permits a scroll entry on exactly two
// surfaces: the gallery grid's list entrance and the build page's section
// reveals. Everywhere else the rule is explicit — "App surfaces get list
// entrances and skeletons, never scroll storytelling" — and the reason is that
// a working surface that withholds its content until you scroll to it is a
// surface arguing with the person trying to use it.
//
// So there is one implementation, here, and it is imported by those two. A
// third caller is not a reason to generalise this hook; it is a sign the third
// surface is asking for something the theme does not give it.
//
// WHAT IT DOES, AND WHAT IT REFUSES TO DO. 450ms of opacity and a 14px rise —
// the theme's own two figures, held in `motion.ts` — fired once by an
// IntersectionObserver that disconnects on the first intersection. Nothing is
// still observing after the page settles. `transform` and `opacity` are the
// only two properties that composite, so a reveal never touches layout.
//
// IT FAILS TOWARDS VISIBLE. Under reduced motion, without IntersectionObserver,
// or before the effect has run, the element is already in its final state. An
// element that starts at `opacity: 0` and waits for JavaScript to bring it back
// is a blank page whenever that JavaScript does not arrive — which is a far
// worse failure than no animation, and the one this shape rules out.
//
// THE REFINED LOOK HAS NO REVEAL (UI-P81). Under it the hook answers "already
// revealed" — `shown` is true, there is no style, and no observer is created —
// whatever the options say, so a surface that adopts it never fades in on scroll
// there. That is the same final state the cases above reach, so it is the same
// failure-free shape; the look is read on every render, so it holds if the look
// changes while the element is mounted.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { useLook } from "./look";
import { canReveal, revealFrom, revealTo } from "./motion";

export interface RevealOptions {
  /**
   * Milliseconds to hold before this element's own transition starts.
   *
   * A grid spends this on a stagger across its first screen. A page reading
   * top to bottom leaves it at zero: its sections are already separated in
   * time by the reader's own scrolling, and adding a delay on top of that is
   * the page hesitating rather than the page arriving.
   */
  delayMs?: number;

  /**
   * Whether this element may animate at all.
   *
   * The gallery grid passes `false` on every render after the first, because a
   * filter change swaps the grid's contents four times in ten seconds and
   * re-animating on each of them would be movement as decoration.
   */
  enabled?: boolean;

  /**
   * How far beyond the viewport the observer starts watching. The default
   * brings an element in just before its top edge is reached, so the motion is
   * finishing as the reader arrives rather than starting.
   */
  rootMargin?: string;
}

export interface Reveal {
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties | undefined;
  /** True once the element has been revealed, or was never going to animate. */
  shown: boolean;
}

export function useReveal({
  delayMs = 0,
  enabled = true,
  rootMargin = "0px 0px -10% 0px",
}: RevealOptions = {}): Reveal {
  /* Decided once per mount rather than read per render: a reveal that changed
     its mind halfway through — because a media query flipped between the
     hidden state and the shown one — would leave the element stuck at
     opacity 0 with no transition to bring it back. */
  const [canAnimate] = useState(() => enabled && canReveal());
  /* The one thing read per render, and safe to: it only ever takes the element
     TOWARDS its final state, so it cannot strand one at opacity 0. */
  const refined = useLook() === "refined";
  const animate = canAnimate && !refined;
  const [shown, setShown] = useState(!animate);

  const node = useRef<HTMLElement | null>(null);
  const [, force] = useState(0);
  const setRef = useRef((next: HTMLElement | null) => {
    node.current = next;
    force((n) => n + 1);
  }).current;

  useEffect(() => {
    if (!animate || shown) return;
    const element = node.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [animate, shown, rootMargin]);

  return {
    ref: setRef,
    /* Not animating means already revealed, whatever the state says: it may
       still be false for an element that was mounted waiting under the current
       look and has since been switched to the refined one. */
    shown: shown || !animate,
    style: animate ? (shown ? revealTo(delayMs) : revealFrom()) : undefined,
  };
}
