// The profile gamification surface's paint — BG-P25.
//
// WHAT CHANGED. Every value here used to be a literal: three greys struck for a
// panel that only ever rendered on a dark ground, four accent hexes, and a
// brand orange repeated in five places. None of them read <html data-theme>, so
// a level ring drawn on Exhibition was a dark-room object sitting in a lit one.
// The KEYS are untouched, because ten components spend them and this prompt is
// a repaint rather than a rewrite; only the values move, and they move to
// `var(--token)` references so the whole surface follows the theme switch with
// no re-render.
//
// --lit CARRIES PROGRESS, AND THAT IS THE WHOLE POINT OF THE MAPPING. The theme
// says levels, XP, streaks and badges are light and never type, and it says so
// because the alternative is a second accent competing with `--action` for the
// reader's eye on a page whose primary action is a follow button. So `xp`,
// `streak` and the level ring's arc are all `--lit`: an arc is a light, a chip
// fill takes `--on-lit` on it, and no word on this surface is ever amber.
//
// WHAT THE FOUR ACCENTS BECAME, and why each is not just "the nearest hue":
//   teal / reputation  → --evidence   reputation is the "somebody else vouched
//                                     for this" signal, which is what evidence
//                                     names.
//   amber / streak     → --lit        light, per the rule above.
//   green / live       → --evidence   the theme has no green; "live" and "it
//                                     worked" are one claim and take one token.
//   purple             → --lit        it marked a track, not a part category,
//                                     and the nine category hues are spoken for.
//   orange / brand     → --action     the one primary fill, with --on-action.
//
// THE GRADIENT IS GONE. `brand.orangeGradient` is now a flat `--action`: a
// gradient is decoration, the theme's primary is a fill with a measured label
// colour on it, and a two-stop ramp has no second stop that is legal in both
// rooms. The key survives so `FounderMark` keeps compiling.
//
// TRACK COLOURS COLLAPSE TO ONE. Four identity tracks used to be four hues.
// Nine hues in this system mean part categories and may not be borrowed, and
// the theme's own answer for tier and rarity is weight and fill rather than a
// rainbow — so a track is named by its name and lit by `--lit` like every other
// progress marker. Nothing on the routes BG-P25 touches renders these.
//
// BG-P28b: THIS MODULE NOW DEFERS RATHER THAN ARGUES. Everything above was
// decided here first, and then six sibling modules had to be talked into the
// same answer one at a time. `src/lib/theme/progress.ts` is that answer written
// down once — the three-rung ladder, the lamp, and the rule that amber is light
// and never type — and this module's `tier`, `lamp` and `xpText` are re-exports
// of it rather than a seventh private copy. The keys below are unchanged; what
// changed is where their meaning is defined.

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import {
  legacyTier,
  levelLamp,
  lockedFill,
  progressFill,
  progressGlow,
  progressTrack,
  tierFill,
  xpText,
  type ProgressTier,
} from "@/lib/theme/progress";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export const tokens = {
  surface: {
    shell: t.glass,
    card: t.glass2,
    input: t.recess,
    /** A media well with nothing in it. `--porthole` is the token for one. */
    well: t.porthole,
  },
  border: {
    // The widths are untouched: a hairline that grew half a pixel would move
    // every fixed-height chip on the surface, and this is a repaint.
    soft: `0.5px solid ${t.line}`,
    strong: `0.5px solid ${t.line}`,
  },
  radius: {
    // The radius scale, not three numbers picked per component. The old `pill`
    // was 100 — a capsule, which the shape language dropped by decision — and
    // is now the chip step. The key keeps its name so its nine call sites do
    // not have to change in a prompt that is not allowed to reshape them.
    panel: r.panel,
    card: r.card,
    pill: r.chip,
  },
  glass: {
    // THE one blur value. It was blur(28px) saturate(160%), which is a second
    // blur value in a system that has exactly one, and 28px of backdrop on a
    // shell-tier surface is the cost the theme's budget exists to stop.
    backdropFilter: "blur(16px) saturate(1.15)",
    WebkitBackdropFilter: "blur(16px) saturate(1.15)",
  },
  brand: {
    orange: t.action,
    orangeGradient: t.action,
    /** The measured label colour for anything filled `brand.orange`. */
    onOrange: t.onAction,
  },
  accent: {
    teal: t.evidence,
    amber: t.lit,
    purple: t.lit,
    green: t.evidence, // live / positive deltas
  },
  /**
   * The unfilled remainder of a progress ring. A hairline rather than a
   * ground: the arc is the light and the track is the groove it sits in, and
   * on Exhibition a white-alpha track simply vanished.
   */
  ringTrack: t.line,
  // Gamification colour language
  xp: t.lit,
  reputation: t.evidence,
  streak: t.lit,
  locked: t.text2,
  text: {
    primary: t.text,
    secondary: t.text2,
    // The system has two text tokens, so "muted" and "secondary" resolve to
    // one. A third step would be a value nobody measured.
    muted: t.text2,
  },
  font: {
    sans: FIGTREE,
    mono: DM_MONO,
  },
} as const

// Track identity colours. See the note above: one light, four names.
export type TrackName = "Architect" | "Curator" | "Mentor" | "Explorer"

export const trackColors: Record<TrackName, string> = {
  Architect: t.lit,
  Curator: t.lit,
  Mentor: t.lit,
  Explorer: t.lit,
}

/**
 * The shared ladder, re-exported so a profile mark and a level marker on
 * `/analytics` cannot drift apart. These are not copies — they are the same
 * functions the progress surfaces spend, and `src/lib/theme/progress.ts` is
 * where their argument lives.
 */
export {
  legacyTier,
  levelLamp,
  lockedFill,
  progressFill,
  progressGlow,
  progressTrack,
  tierFill,
  xpText,
  type ProgressTier,
}
