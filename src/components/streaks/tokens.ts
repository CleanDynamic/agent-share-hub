// Shared visual tokens for the streak surface. Values are applied via inline
// style={{}} per the design system (Tailwind handles layout only).
//
// REPOINTING FINISHED — BG-P29. An earlier pass moved the easy half of this
// module onto tokens and left the rest, so it shipped as a mixture: `xpOrange`
// was already `var(--action)` while `orangeDeep` beside it was still `#C44514`,
// and the three surfaces were still the lavender-greys struck for one dark
// room. A module half on tokens is worse than one wholly off them — it reads as
// finished. The remaining literals are repointed here, and two mappings the
// earlier pass got wrong are corrected:
//
// 1. `--recess` WAS BEING USED AS AN INK. `textMuted`, `textFaint` and `locked`
//    all pointed at it. `--recess` is the token for an inset SURFACE — a
//    screen, a well, a field — and text set in it measures 1.1:1 on the
//    Exhibition ground it is nearly the same value as. The system publishes two
//    text tokens; the lower rungs of the old white-alpha ramp were never legal
//    ones, so all three keys resolve to `--text2`.
//
// 2. TWO CATEGORY HUES WERE BORROWED. `purple` pointed at `--cat-agents` and
//    `greenPositive` at `--cat-configuration`. The nine `--cat-*` hues encode
//    part categories and the theme forbids borrowing one for anything that is
//    not a part category — a streak is not an agent config. They take the
//    mapping BG-P25 set for the profile surface instead: purple is progress, so
//    `--lit`; "positive" and "it worked" are one claim, so `--evidence`.
//
// THE GRADIENT IS FLAT NOW. `ORANGE_GRADIENT` was `var(--action) → #C44514`. A
// gradient is decoration, the theme's primary is a fill with a measured label
// colour on it, and there is no second stop legal in both rooms. The export
// survives so its call sites keep compiling.

import { GLASS_BLUR } from "@/lib/theme/controls"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { DM_MONO, FIGTREE } from "@/lib/theme/type"

export const COLORS = {
  // brand / gamification language
  xpOrange: t.action,
  /** Was `#C44514`. See THE GRADIENT above. */
  orangeDeep: t.action,
  reputationTeal: t.evidence,
  streakAmber: t.lit,
  /** Was `--cat-agents`. See note 2 above. */
  purple: t.lit,
  /** Was `--cat-configuration`. See note 2 above. */
  greenPositive: t.evidence,
  // surfaces
  /** The panel tier. Was `rgba(52,52,66,0.55)`. */
  shell: t.glass,
  /** The inset tier. Was `rgba(68,68,84,0.60)`. */
  card: t.glass2,
  /** A field or a well. Was `rgba(82,82,100,0.60)`. */
  input: t.recess,
  // text — see note 1 above.
  text: t.text,
  textMuted: t.text2,
  textFaint: t.text2,
  locked: t.text2,
} as const

export const BORDER = {
  hairline: `0.5px solid ${t.line}`,
  hairlineStrong: `0.5px solid ${t.line}`,
} as const

export const RADIUS = {
  // The radius scale, not three numbers picked per component. The old `pill` was
  // 100 — the capsule the shape language dropped by decision — and is the chip
  // step now. The keys keep their names so their call sites do not change in a
  // prompt that is not allowed to reshape them.
  panel: r.panel,
  card: r.card,
  pill: r.chip,
} as const

export const FONT = {
  // BG-P03 retired the old stacks: Figtree is the body face and DM Mono leads
  // the data face, with JetBrains Mono kept behind it as the fallback this
  // surface already assumed.
  sans: FIGTREE,
  mono: DM_MONO,
} as const

// THE one blur value. It was `blur(28px) saturate(160%)`, a second blur value in
// a system that has exactly one, and 28px of backdrop on a shell-tier surface is
// the cost the theme's budget exists to stop.
export const GLASS = {
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
} as const

export const ORANGE_GRADIENT = t.action

// Heatmap intensity ramp (low -> high activity), struck from `--action` by
// `color-mix` so the browser resolves the blend after the theme has decided what
// `--action` is. A value computed in JavaScript never could.
export const HEAT_RAMP = [
  t.recess, // 0 — empty cell
  "color-mix(in srgb, var(--action) 28%, transparent)",
  "color-mix(in srgb, var(--action) 50%, transparent)",
  "color-mix(in srgb, var(--action) 72%, transparent)",
  "color-mix(in srgb, var(--action) 95%, transparent)",
] as const
