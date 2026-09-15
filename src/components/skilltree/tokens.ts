// Shared design tokens + types for the Skill Tree kit.
//
// REPOINTED, NOT REWRITTEN — BG-P29, following BG-P21's pattern in
// `src/components/build/tokens.ts` and BG-P25's in
// `src/components/profile-game/tokens.ts`. Every value here used to be a
// literal struck for one dark room: three lavender-grey surfaces, two
// white-alpha hairlines, three white-alpha ink steps and six brand hexes. None
// read `<html data-theme>`, so a skill node drawn on Exhibition was a dark-room
// object sitting in a lit one.
//
// THIS FOLDER IS LIVE, WHICH IS WHY IT IS REPOINTED RATHER THAN LEFT. It has no
// route of its own, but `src/components/progress/SkillTreeTab.tsx` imports
// `trackMeta` and `TrackId` from here and that tab renders on `/analytics`. The
// three folders BG-P29 leaves untouched — `guilds`, `reputation`,
// `leaderboards` — have no such path to a mounted tree; this one does.
//
// The KEYS are untouched. Nine components in this folder spend them and this is
// a repaint rather than a rewrite; only the values move, and they move to
// `var(--token)` references so the surface follows the theme switch with no
// re-render.
//
// THE BRAND MAPPING IS BG-P25'S, applied unchanged so the four gamification
// surfaces do not answer the same question four ways:
//   brandOrange #E8571A → --action     the one primary fill
//   teal        #2EC4B6 → --evidence   reputation is "somebody else vouched"
//   amber       #F59E0B → --lit        progress is light, per the theme
//   purple      #7C3AED → --lit        it marked a track, not a part category
//   green       #22C55E → --evidence   the theme has no green; "live" and "it
//                                      worked" are one claim
//
// THE INK RAMP LOSES ITS THIRD AND FOURTH RUNGS. `textFaint` was
// `rgba(255,255,255,0.35)` and `locked` `rgba(255,255,255,0.25)` — below the
// 4.5:1 text floor in both of the rooms that replaced the old ground. Both keys
// survive and resolve to `--text2`.
//
// THE GRADIENT IS FLAT NOW. `brandGradient` was `#E8571A → #C44514`. A gradient
// is decoration and there is no second stop legal in both rooms.

import { GLASS_BLUR } from "@/lib/theme/controls"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { DM_MONO, FIGTREE } from "@/lib/theme/type"

export type TrackId = "architect" | "curator" | "mentor" | "explorer"

export type NodeState = "locked" | "available" | "unlocked"

export const tokens = {
  /** The panel tier. Was `rgba(52,52,66,0.55)`. */
  shell: t.glass,
  /** The inset tier. Was `rgba(68,68,84,0.60)`. */
  card: t.glass2,
  /** A field or a well. Was `rgba(82,82,100,0.60)`. */
  input: t.recess,
  // Two white-alpha steps — 0.10 and 0.14 — were one hairline at two strengths.
  // `--line` is a hairline, not a surface.
  borderSoft: `0.5px solid ${t.line}`,
  border: `0.5px solid ${t.line}`,
  brandOrange: t.action,
  brandGradient: t.action,
  teal: t.evidence,
  amber: t.lit,
  purple: t.lit,
  green: t.evidence,
  /** See THE INK RAMP above. Was `rgba(255,255,255,0.25)`. */
  locked: t.text2,
  // THE one blur value. It was `blur(28px) saturate(160%)`, a second blur value
  // in a system that has exactly one.
  glass: GLASS_BLUR,
  // The radius scale. The old `radiusPill` was 100 — the capsule the shape
  // language dropped by decision — and is the chip step now.
  radiusPanel: r.panel,
  radiusCard: r.card,
  radiusPill: r.chip,
  text: t.text,
  textDim: t.text2,
  /** See THE INK RAMP above. Was `rgba(255,255,255,0.35)`. */
  textFaint: t.text2,
} as const

// The four tracks' identity colours collapse to one light. Four hues were four
// chances to read a track as a part category; nine hues in this system mean part
// categories and may not be borrowed, and the theme's own answer for tier and
// rarity is weight and fill rather than a rainbow. The NAME is what distinguishes
// a track, and the philosophy line under it.
export const trackMeta: Record<
  TrackId,
  { name: string; color: string; philosophy: string }
> = {
  architect: {
    name: "Architect",
    color: t.lit,
    philosophy: "Design the systems others build on.",
  },
  curator: {
    name: "Curator",
    color: t.lit,
    philosophy: "Shape signal out of the noise.",
  },
  mentor: {
    name: "Mentor",
    color: t.lit,
    philosophy: "Multiply yourself through others.",
  },
  explorer: {
    name: "Explorer",
    color: t.lit,
    philosophy: "Go where the map runs out.",
  },
}

// BG-P03 retired the old stacks: DM Mono leads the data face and Figtree is the
// body face.
export const mono = DM_MONO
export const sans = FIGTREE

export function fmt(n: number): string {
  return n.toLocaleString("en-US")
}
