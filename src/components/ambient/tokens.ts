// Shared design tokens for the ambient XP / gamification toasts.
// Plain TS module — visuals are applied via inline style={{}} in each component.
//
// REPOINTING FINISHED — BG-P29. An earlier pass moved the easy half of this
// module onto tokens and left the rest, so it shipped as a mixture: `orange`
// was already `var(--action)` while the gradient beside it still ended in
// `#C44514`, and the three surfaces were still the lavender-greys struck for
// one dark room. A module half on tokens is worse than one wholly off them — it
// reads as finished. The remaining literals are repointed here, and two
// mappings the earlier pass got wrong are corrected:
//
// 1. `--recess` WAS BEING USED AS AN INK. `textMuted`, `textFaint` and `locked`
//    all pointed at it. `--recess` is the token for an inset SURFACE — a
//    screen, a well, a field — and text set in it measures 1.1:1 on the
//    Exhibition ground it is nearly the same value as. The system publishes two
//    text tokens; the lower rungs of the old white-alpha ramp were never legal
//    ones, so all three keys resolve to `--text2`.
//
// 2. TWO CATEGORY HUES WERE BORROWED. `purple` pointed at `--cat-agents` and
//    `green` at `--cat-configuration`. The nine `--cat-*` hues encode part
//    categories and the theme forbids borrowing one for anything that is not a
//    part category — an XP toast is not an agent config. They take the mapping
//    BG-P25 set for the profile surface instead: purple is progress, so
//    `--lit`; "live" and "it worked" are one claim, so `--evidence`.
//
// THESE TOASTS ARE APPLICATION CHROME, which is why the module is repointed
// rather than left: `XpToast` and `BadgeEarnedToast` mount from
// `src/components/shell/ProfileDrawer.tsx` and `src/pages/Upload.tsx`, so they
// can appear over any route in either theme.
//
// TRACK COLOURS COLLAPSE TO ONE LIGHT. Four identity tracks were four hues —
// and three of the four were category hues borrowed outside their role. A track
// is named by its name and lit by `--lit` like every other progress marker.

import { GLASS_BLUR } from "@/lib/theme/controls"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { DM_MONO, FIGTREE } from "@/lib/theme/type"

export const tokens = {
  // Surfaces
  pageBg: t.bg,
  /** The panel tier. Was `rgba(52,52,66,0.55)`. */
  shell: t.glass,
  /** The inset tier. Was `rgba(68,68,84,0.60)`. */
  card: t.glass2,
  /** A field or a well. Was `rgba(82,82,100,0.60)`. */
  input: t.recess,

  // Borders. Three steps were one hairline at three strengths; `--line` is a
  // hairline, not a surface.
  borderSoft: `0.5px solid ${t.line}`,
  borderMid: `0.5px solid ${t.line}`,
  borderStrong: `0.5px solid ${t.line}`,

  // Brand / semantic
  orange: t.action,
  /** Was `linear-gradient(135deg, var(--action) 0%, #C44514 100%)`. */
  orangeGradient: t.action,
  teal: t.evidence,
  amber: t.lit,
  /** Was `--cat-agents`. See note 2 above. */
  purple: t.lit,
  /** Was `--cat-configuration`. See note 2 above. ONLY for live / positive deltas. */
  green: t.evidence,
  /** See note 1 above. */
  locked: t.text2,

  // Text — see note 1 above.
  text: t.text,
  textMuted: t.text2,
  textFaint: t.text2,

  // Radii — the scale. The old `radiusPill` was 100, the capsule the shape
  // language dropped by decision; it is the chip step now.
  radiusPanel: r.panel,
  radiusCard: r.card,
  radiusPill: r.chip,

  // Effects — THE one blur value. It was `blur(28px) saturate(160%)`, a second
  // blur value in a system that has exactly one.
  glass: GLASS_BLUR,

  // Type. BG-P03 retired the old stacks: Figtree is the body face and DM Mono
  // leads the data face.
  fontSans: FIGTREE,
  fontMono: DM_MONO,
} as const

// Gamification colour language
export const xpColor = tokens.orange // XP = the primary action fill
export const reputationColor = tokens.teal // Reputation = evidence
export const streakColor = tokens.amber // Streaks = light

// Track colours. One light, four names — see the note above.
export const trackColors = {
  Architect: t.lit,
  Curator: t.lit,
  Mentor: t.lit,
  Explorer: t.lit,
} as const

export type TrackName = keyof typeof trackColors
