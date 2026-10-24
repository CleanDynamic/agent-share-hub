// CA-21: the build page's timings, in one place. Moving, the skeleton and adding a session read these; `motion.ts` keeps its
// three durations (`FAST` 150, `BASE` 200 and the rest), and everything here that is not one of them is named for what it times.
//
// Everything moves with `transform` and `opacity` only, in `STANDARD` easing, and under reduced motion nothing moves at all:
// every builder in `motion.ts` answers "none", and the code that animates by hand asks `prefersReducedMotion()` first.

import { BASE, FAST } from "@/lib/theme/motion";

/** The skeleton fades in behind the build once something is held. */
export const SKELETON_IN = 120;

/** Things around the place slide to open room and close it again. */
export const SLIDE_MS = FAST;
/** The held copy settles into its place, and Esc puts everything back. */
export const SETTLE_MS = BASE;
/** The skeleton fades out after the drop, and after the last prompt lands. */
export const SKELETON_OUT = BASE;

/** Holding a tile over a folded session's head this long opens it. */
export const DWELL_OPEN_MS = 500;
/** Holding a tile over the middle third of a tile that can take it this long turns that tile into the target. */
export const DWELL_SEND_MS = 500;

/* ── adding a session: prompts fall into place ── */

/** The + in Sources fades out, and "In this draft" fades in. */
export const PLUS_OUT_MS = 120;
export const WORDS_IN_MS = 160;
/** The new session's lane opens, and everything below slides down by its height. */
export const LANE_OPEN_MS = BASE;
/** The empty sockets fade in, starting this long after the lane starts to open. */
export const SOCKETS_IN_MS = 160;
export const SOCKETS_AFTER_MS = 80;
/** The session's head falls into place this long after the lane starts to open, over `FALL_MS`. */
export const HEAD_AFTER_MS = 260;
/** A head or a prompt falls from this far above, fully see-through, to its place. */
export const FALL_SHIFT = 20;
export const FALL_MS = 240;
/** Each prompt starts this long after the one before. */
export const PROMPT_STEP_MS = 110;
/** From the 9th prompt on they land together with the 8th, so any session fills in under a second. */
export const STAGGERED_PROMPTS = 8;
/** The skeleton fades this long after the last prompt lands. */
export const FADE_AFTER_MS = 200;

/** When prompt `n` (from 0) starts falling, counted from when the head starts to fall. */
export const promptStart = (n: number): number => PROMPT_STEP_MS * (Math.min(n, STAGGERED_PROMPTS - 1) + 1);
