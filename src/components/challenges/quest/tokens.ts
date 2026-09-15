// The quest / weekly-challenge surface's paint.
//
// REPOINTED, NOT REWRITTEN — BG-P29, following the pattern BG-P21 set in
// `src/components/build/tokens.ts` and BG-P25 set in
// `src/components/profile-game/tokens.ts`. Every value here used to be a
// literal struck for one dark room: three lavender-grey surfaces, four
// white-alpha ink steps, and six brand hexes headed by `#E8571A`. None of them
// read `<html data-theme>`, so a challenge card drawn on Exhibition was a
// dark-room object sitting in a lit one.
//
// The KEYS are untouched. Eleven components in this folder spend them, and this
// is a repaint rather than a rewrite; only the values move, and they move to
// `var(--token)` references so the whole surface follows the theme switch with
// no re-render.
//
// THE NAMES LIE NOW, WHICH IS THE PRICE OF THE ALIAS. `orange` is the action
// token — burnt orange on Exhibition, salmon on Dusk. `teal` is evidence, which
// is teal in the light room and sky in the dark one. Read every name below as
// the JOB it does rather than as the colour it was.
//
// WHAT THE SIX BRAND HEXES BECAME. The mapping is BG-P25's, arrived at for the
// profile surface and applied here unchanged so two gamification surfaces do
// not answer the same question two ways:
//   orange      #E8571A  → --action           the one primary fill
//   orangeDeep  #C44514  → --action           see THE GRADIENT below
//   teal        #2EC4B6  → --evidence         reputation is "somebody vouched"
//   amber       #F59E0B  → --lit              progress is light, per the theme
//   purple      #7C3AED  → --lit              it marks a weekly challenge, which
//                                             is progress; the nine category
//                                             hues mean part categories and may
//                                             not be borrowed for anything else
//   green       #22C55E  → --evidence         the theme has no green; "live" and
//                                             "it worked" are one claim
//
// THE GRADIENT IS FLAT NOW. `orangeGradient` was a two-stop ramp from `#E8571A`
// to `#C44514`. A gradient is decoration, the theme's primary is a fill with a
// measured label colour on it, and there is no second stop that is legal in
// both rooms. The key survives so its call sites keep compiling.
//
// THE INK RAMP LOSES ITS THIRD AND FOURTH RUNGS. `textMuted` was
// `rgba(255,255,255,0.40)` and `locked` `rgba(255,255,255,0.25)` — 3.0:1 at
// best on the old ground and below the 4.5:1 text floor in both of the rooms
// that replaced it. The system publishes two text tokens because the lower
// rungs were never legal ones: a label nobody can read is not a quieter label.
// Both keys survive and resolve to `--text2`.

import type { CSSProperties } from "react"

import { GLASS_BLUR } from "@/lib/theme/controls"
import { r } from "@/lib/theme/radius"
import { colourAlpha, t } from "@/lib/theme/tokens"

export const colors = {
  /** The panel tier. Was `rgba(52,52,66,0.55)`. */
  shell: t.glass,
  /** The inset tier — a card, a row, a group. Was `rgba(68,68,84,0.60)`. */
  card: t.glass2,
  /** A field or a well. Was `rgba(82,82,100,0.60)`. */
  input: t.recess,

  // Both border steps were white-alpha hairlines — 0.10 and 0.14 — which is one
  // hairline at two strengths rather than two objects. `--line` is the token for
  // one, and it is a hairline rather than a surface.
  borderSoft: t.line,
  borderStrong: t.line,

  textPrimary: t.text,
  textSecondary: t.text2,
  /** See THE INK RAMP above. Was `rgba(255,255,255,0.40)`. */
  textMuted: t.text2,
  /** See THE INK RAMP above. Was `rgba(255,255,255,0.25)`. */
  locked: t.text2,

  // brand
  orange: t.action,
  orangeDeep: t.action,
  teal: t.evidence,
  amber: t.lit,
  purple: t.lit,
  green: t.evidence,
} as const

// XP / level colour language
export const semantic = {
  xp: colors.orange,
  reputation: colors.teal,
  streak: colors.amber,
  locked: colors.locked,
} as const

// Track colours. Four identity tracks were four hues; nine hues in this system
// mean part categories and may not be borrowed, and the theme's own answer for
// tier and rarity is weight and fill rather than a rainbow. So a track is named
// by its name and lit by `--lit` like every other progress marker.
export const tracks = {
  Architect: t.lit,
  Curator: t.lit,
  Mentor: t.lit,
  Explorer: t.lit,
} as const

export const orangeGradient = t.action

export const radius = {
  // The radius scale, not three numbers picked per component. The old `pill` was
  // 100 — a capsule, which the shape language dropped by decision — and is now
  // the chip step. The key keeps its name so its call sites do not have to
  // change in a prompt that is not allowed to reshape them.
  panel: r.panel,
  card: r.card,
  pill: r.chip,
} as const

// THE one blur value. It was `blur(28px) saturate(160%)`, which is a second blur
// value in a system that has exactly one, and 28px of backdrop on a shell-tier
// surface is the cost the theme's budget exists to stop.
export const glass: CSSProperties = {
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
}

/**
 * A colour at an alpha.
 *
 * Delegates to `colourAlpha`, which is where the `var()` branch lives. The
 * exports above are `var(--token)` strings now, so the old `parseInt` body
 * could not take them apart and every one of this folder's twenty-odd call
 * sites would have got `rgba(NaN,NaN,NaN,α)`. A hex still in a call site is
 * unaffected — that branch is byte-identical to what this emitted before.
 */
export function withAlpha(colour: string, alpha: number): string {
  return colourAlpha(colour, alpha)
}

// Detect reduced-motion preference (safe on server: defaults to false).
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export const shellSurface: CSSProperties = {
  background: colors.shell,
  border: `0.5px solid ${colors.borderStrong}`,
  borderRadius: radius.panel,
  ...glass,
}

export const cardSurface: CSSProperties = {
  background: colors.card,
  border: `0.5px solid ${colors.borderSoft}`,
  borderRadius: radius.card,
}
