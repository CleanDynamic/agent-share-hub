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

/* ── CA-22: motion across the build page ──

   One language for sixteen moments: sockets and lanes for structure, a slide to open or close a gap, a drop for anything arriving,
   a lift for anything leaving, a crossfade for words that change, and an outline once for what just moved or was found.

   `motion.ts` keeps its three durations and its 200 ms ceiling for feedback. Three timings below are longer BECAUSE they carry
   something to a new place and are not feedback: `DROP` (240), `MAP_MORPH` (300) and `SCROLL_TO` (450). Everything else is
   `FAST` or `BASE`, or a pause between two of them. */

/** Opening or closing a gap, moving, undo and redo, a part or lane resizing. */
export const SLIDE = FAST;
/** Anything leaving fades out and rises `LIFT_RISE`. */
export const LIFT = BASE;
export const LIFT_RISE = 8;
/** Anything arriving fades in and falls `DROP_FALL` from above. Longer than the ceiling: it carries the thing to its place. */
export const DROP = FALL_MS;
export const DROP_FALL = FALL_SHIFT;
/** Between items when several leave or arrive together. */
export const STAGGER = 60;
/** Items past this go together with the 12th, so nothing takes more than about a second. */
export const STAGGER_CAP = 12;
/** Words and labels that change, Details, counts. */
export const CROSSFADE = FAST;
/** The outline once: in, hold, out. */
export const OUTLINE_IN = 150;
export const OUTLINE_HOLD = 500;
export const OUTLINE_OUT = 300;
/** Go to it: the same ring, held longer so the eye has time to arrive. */
export const GOTO_HOLD = 800;
export const GOTO_OUT = 600;
/** Folding: the tiles rise `FOLD_RISE` behind the head. */
export const FOLD = BASE;
export const FOLD_RISE = 24;
/** Between tiles coming down when a session unfolds; from the 8th on they come together. */
export const UNFOLD_STAGGER = 40;
export const UNFOLD_STAGGERED = 8;
/** The selection bar rises this far and fades in. */
export const BAR_RISE = 16;
/** Selection rings fade in and out. */
export const RING_IN = 100;
export const RING_OUT = 150;
/* ── CA-28: a window's Optional fields, on demand ──
   Opening: the frame grows over `BASE` about its fixed centre; `OPTIONAL_DROP_AFTER` after the press each field falls `DROP_FALL` and
   fades in over `DROP`, `STAGGER` apart, the 12th and the rest together. Closing: the fields lift (`LIFT_RISE`, `OPTIONAL_LIFT`),
   last first, `OPTIONAL_LIFT_STAGGER` apart; then the frame closes over `BASE`. */
export const OPTIONAL_LIFT = 160;
export const OPTIONAL_LIFT_STAGGER = 40;
/** The first field starts to fall this long after the press, while the frame is still opening. */
export const OPTIONAL_DROP_AFTER = 100;
/** The notice rises this far and fades in. */
export const NOTICE_RISE = 8;
/** Scrolling to something off screen. Longer than the ceiling: it carries the eye to a new place. */
export const SCROLL_TO = 450;
/** List to Map: the tiles fold behind their heads, each head morphs into its box, the lines draw in. */
export const MAP_FOLD = 180;
/** Longer than the ceiling: a head travels to a new place. */
export const MAP_MORPH = 300;
export const MAP_LINES = 200;
/** Map to List: the lines retract first. */
export const MAP_LINES_BACK = 100;
/** With more sessions than this, or boxes that do not fit on screen, the two views crossfade instead of morphing. */
export const MAP_MORPH_MAX = 30;
