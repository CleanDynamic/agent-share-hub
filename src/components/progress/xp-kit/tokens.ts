// The XP display kit's paint.
//
// REPOINTED, NOT REWRITTEN — BG-P29, following BG-P21's pattern in
// `src/components/build/tokens.ts` and BG-P25's in
// `src/components/profile-game/tokens.ts`. Every value here used to be a
// literal struck for one dark room: three lavender-grey surfaces, three
// white-alpha ink steps, three white-alpha hairlines, and seven brand hexes
// headed by `#E8571A`. None read `<html data-theme>`, so an XP bar drawn on
// Exhibition was a dark-room object sitting in a lit one.
//
// The KEYS are untouched. Thirteen components in this folder spend them and
// this is a repaint rather than a rewrite; only the values move, and they move
// to `var(--token)` references so the surface follows the theme switch with no
// re-render.
//
// THE NAMES LIE NOW, WHICH IS THE PRICE OF THE ALIAS. `orange` is the action
// token — burnt orange on Exhibition, salmon on Dusk. Read every name below as
// the JOB it does rather than as the colour it was.
//
// THE BRAND MAPPING IS BG-P25'S, applied unchanged so the four gamification
// surfaces do not answer the same question four ways:
//   orange  #E8571A → --action      the one primary fill
//   teal    #2EC4B6 → --evidence    reputation is "somebody else vouched"
//   amber   #F59E0B → --lit         progress is light, per the theme
//   purple  #7C3AED → --lit         it marked a track, not a part category
//   green   #22C55E → --evidence    the theme has no green; "live" and "it
//                                   worked" are one claim and take one token
//   red     #EF4444 → --text2       SEE THE DOWN-DELTA below
//
// THE DOWN-DELTA IS NOT BREAKAGE. `red` has exactly one consumer —
// `xp-stat-card.tsx`, colouring a falling percentage. `--cat-breakage` is the
// part-category hue for a gap or a break, and the theme forbids borrowing a
// category hue for anything that is not a part category; a declining XP trend
// is not one. So it takes `--text2`, and the direction is carried by the ▲/▼
// glyph and the sign that were already there rather than by colour alone —
// which is what the card should have been doing regardless.
//
// THE INK RAMP LOSES ITS THIRD RUNG. `textFaint` was
// `rgba(255,255,255,0.35)` and `locked` `rgba(255,255,255,0.25)` — below the
// 4.5:1 text floor in both of the rooms that replaced the old ground. The
// system publishes two text tokens because the lower rungs were never legal
// ones. Both keys survive and resolve to `--text2`.
//
// THE GRADIENT IS FLAT NOW. `orangeGradient` was `#E8571A → #C44514`. A
// gradient is decoration, the theme's primary is a fill with a measured label
// colour on it, and there is no second stop legal in both rooms.

import { GLASS_BLUR } from "@/lib/theme/controls"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { DM_MONO, FIGTREE } from "@/lib/theme/type"

export const tokens = {
  // Surfaces
  /** The panel tier. Was `rgba(52,52,66,0.55)`. */
  shell: t.glass,
  /** The inset tier. Was `rgba(68,68,84,0.60)`. */
  card: t.glass2,
  /** A field or a well. Was `rgba(82,82,100,0.60)`. */
  input: t.recess,

  // Borders. Three white-alpha steps — 0.10, 0.12, 0.14 — were one hairline at
  // three strengths rather than three objects. `--line` is the token for one.
  borderSoft: `0.5px solid ${t.line}`,
  borderMid: `0.5px solid ${t.line}`,
  borderStrong: `0.5px solid ${t.line}`,

  // Brand + semantic colours
  orange: t.action,
  orangeGradient: t.action,
  teal: t.evidence,
  amber: t.lit,
  purple: t.lit,
  green: t.evidence,
  /** See THE DOWN-DELTA above. Was `#EF4444`. */
  red: t.text2,
  /** See THE INK RAMP above. Was `rgba(255,255,255,0.25)`. */
  locked: t.text2,

  // Track colours. Four tracks were four hues; the nine hues in this system
  // mean part categories and may not be borrowed, and the theme's answer for
  // tier and rarity is weight and fill rather than a rainbow. One light, four
  // names.
  trackArchitect: t.lit,
  trackCurator: t.lit,
  trackMentor: t.lit,
  trackExplorer: t.lit,

  // Text
  text: t.text,
  textMuted: t.text2,
  /** See THE INK RAMP above. Was `rgba(255,255,255,0.35)`. */
  textFaint: t.text2,

  // Radii — the scale, not three numbers picked per component. The old `pill`
  // was 100, the capsule the shape language dropped by decision; it is the chip
  // step now. The keys keep their names so their call sites do not change in a
  // prompt that is not allowed to reshape them.
  radiusPanel: r.panel,
  radiusCard: r.card,
  radiusPill: r.chip,

  // Glass — THE one blur value. It was `blur(28px) saturate(160%)`, a second
  // blur value in a system that has exactly one.
  glass: {
    backdropFilter: GLASS_BLUR,
    WebkitBackdropFilter: GLASS_BLUR,
  } as const,

  // Fonts. BG-P03 retired the old stacks: Figtree is the body face and DM Mono
  // leads the data face, with JetBrains Mono kept behind it as the fallback
  // this kit already assumed.
  fontSans: FIGTREE,
  fontMono: DM_MONO,
} as const

export type Tokens = typeof tokens
