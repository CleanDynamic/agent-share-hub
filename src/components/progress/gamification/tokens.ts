/**
 * The /analytics gamification surface's paint.
 *
 * REPOINTED, NOT REWRITTEN — BG-P29, following BG-P21's pattern in
 * `src/components/build/tokens.ts` and BG-P25's in
 * `src/components/profile-game/tokens.ts`. Every value here used to be a
 * literal struck for one dark room, headed by `pageBg: "#25252F"` — the legacy
 * ground BG-P18b deleted from `index.css` as dead, still spelled out here and
 * still painting a dark field behind a lit room's panels.
 *
 * The KEYS are untouched. Eight components in this folder spend them and this
 * is a repaint rather than a rewrite; only the values move, and they move to
 * `var(--token)` references so the surface follows the theme switch with no
 * re-render.
 *
 * THE NAMES LIE NOW, WHICH IS THE PRICE OF THE ALIAS. `brand` is the action
 * token — burnt orange on Exhibition, salmon on Dusk. Read every name below as
 * the JOB it does rather than as the colour it was.
 *
 * THE BRAND MAPPING IS BG-P25'S, applied unchanged so the four gamification
 * surfaces do not answer the same question four ways:
 *   brand   #E8571A → --action      the one primary fill
 *   teal    #2EC4B6 → --evidence    reputation is "somebody else vouched"
 *   amber   #F59E0B → --lit         progress is light, per the theme
 *   purple  #7C3AED → --lit         it marked a track, not a part category, and
 *                                   the nine category hues are spoken for
 *   green   #22C55E → --evidence    the theme has no green; "live" and "it
 *                                   worked" are one claim and take one token
 *
 * THE INK RAMP LOSES ITS THIRD AND FOURTH RUNGS. `textFaint` was
 * `rgba(255,255,255,0.35)` and `locked` `rgba(255,255,255,0.25)` — below the
 * 4.5:1 text floor in both of the rooms that replaced the old ground. The
 * system publishes two text tokens because the lower rungs were never legal
 * ones. Both keys survive and resolve to `--text2`.
 *
 * THE GRADIENT IS FLAT NOW. `brandGradient` was `#E8571A → #C44514`. A gradient
 * is decoration, the theme's primary is a fill with a measured label colour on
 * it, and there is no second stop legal in both rooms.
 */

import { GLASS_BLUR } from "@/lib/theme/controls"
import { r } from "@/lib/theme/radius"
import { colourAlpha, t } from "@/lib/theme/tokens"
import { DM_MONO } from "@/lib/theme/type"

export const colors = {
  /** The page ground. Was `#25252F`; a light room has no stone in it. */
  pageBg: t.bg,
  /** The panel tier. Was `rgba(52,52,66,0.55)`. */
  shell: t.glass,
  /** The inset tier. Was `rgba(68,68,84,0.60)`. */
  card: t.glass2,
  /** A field or a well. Was `rgba(82,82,100,0.60)`. */
  input: t.recess,
  // Both border steps were white-alpha hairlines — 0.10 and 0.14 — which is one
  // hairline at two strengths. `--line` is a hairline, not a surface.
  borderSoft: t.line,
  borderStrong: t.line,
  textPrimary: t.text,
  textMuted: t.text2,
  /** See THE INK RAMP above. Was `rgba(255,255,255,0.35)`. */
  textFaint: t.text2,
  /** See THE INK RAMP above. Was `rgba(255,255,255,0.25)`. */
  locked: t.text2,

  // Brand / semantic
  brand: t.action, // XP
  brandGradient: t.action,
  teal: t.evidence, // Reputation
  amber: t.lit, // Streaks
  purple: t.lit,
  green: t.evidence, // live / positive deltas ONLY
} as const

// One light, four names. See the note above: the nine category hues mean part
// categories and may not be borrowed, and the theme's answer for tier and
// rarity is weight and fill rather than a rainbow.
export const tracks = {
  Architect: t.lit,
  Curator: t.lit,
  Mentor: t.lit,
  Explorer: t.lit,
} as const

export type TrackName = keyof typeof tracks

export const radius = {
  // The radius scale, not three numbers picked per component. The old `pill` was
  // 100 — the capsule the shape language dropped by decision — and is the chip
  // step now. The keys keep their names so their call sites do not change.
  panel: r.panel,
  card: r.card,
  pill: r.chip,
} as const

// THE one blur value. It was `blur(28px) saturate(160%)`, a second blur value in
// a system that has exactly one, and 28px of backdrop on a shell-tier surface is
// the cost the theme's budget exists to stop.
export const glass = {
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
} as const

/**
 * A colour at an alpha.
 *
 * Delegates to `colourAlpha`, which is where the `var()` branch lives. The
 * exports above are `var(--token)` strings now, so the old `parseInt` body
 * could not take them apart and every one of this folder's seventeen call sites
 * would have got `rgba(NaN,NaN,NaN,α)`. A hex still in a call site is
 * unaffected — that branch is byte-identical to what this emitted before.
 */
export function withAlpha(colour: string, alpha: number): string {
  return colourAlpha(colour, alpha)
}

/** BG-P03 put DM Mono at the head of the data face's stack; this is that stack. */
export const monoFont = DM_MONO
