// The ambient surfaces' paint — REPOINTED BY BG-P28b.
//
// THESE SURFACES MOUNT APP-WIDE, which is what makes this module different from
// the other six. `GamificationToasts` hangs off `Layout.tsx` and `NavProgressChip`
// off `AppShell.tsx`, so an XP toast can appear over the gallery, over a build
// page, over the composer's flat working ground, and over both themes. Every
// value here therefore has to be legal on a light page AND a dark one — which a
// white-alpha ink struck for a `#25252F` room never was. On Exhibition the old
// `rgba(255,255,255,0.92)` body text was white on near-white: a toast that
// announced XP nobody could read.
//
// THE KEYS ARE UNTOUCHED — nine components in this folder spend them — so only
// the values move, to `var(--token)` references that follow the theme switch
// with no re-render.
//
// WHERE THE ACCENTS WENT (the full argument is in the gamification module and
// in `src/lib/theme/progress.ts`):
//
//   orange  `#E8571A` → `--action`    the one primary fill.
//   teal    `#2EC4B6` → `--evidence`  "somebody vouched for this".
//   amber   `#F59E0B` → `--lit`       progress is light.
//   purple  `#7C3AED` → the ladder    a track is not a part category.
//   green   `#22C55E` → `--evidence`  the theme publishes no green.
//   ground  `#25252F` → `--bg`        there is no void in a lit room.
//
// `xpColor` IS THE ONE THAT CHANGED MEANING, and it is the point of the prompt.
// It was the brand orange, which made every XP figure in the app a second
// accent competing with the primary action for the reader's eye. XP is
// PROGRESS, so it is `--lit` — spent as a FILL behind the figure, never as the
// figure's own colour. `progress.ts` exports `xpText()` for the figure itself,
// and it is `--text` in DM Mono like every other number in the product.

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export const tokens = {
  // Surfaces
  pageBg: t.bg,
  shell: t.glass,
  card: t.glass2,
  input: t.recess,

  // Borders. The widths are untouched: a hairline that grew half a pixel would
  // move every fixed-height chip on these surfaces, and this is a repaint.
  borderSoft: `0.5px solid ${t.line}`,
  borderMid: `0.5px solid ${t.line}`,
  borderStrong: `0.5px solid ${t.line}`,

  // Brand / semantic
  orange: t.action,
  orangeGradient: t.action,
  /** The measured label colour for anything filled `orange`. */
  onOrange: t.onAction,
  teal: t.evidence,
  amber: t.lit,
  purple: t.lit,
  green: t.evidence,
  locked: t.text2,

  // Text. Two tokens, not three — the faint rung was white at 0.38, which is
  // below the text floor in both rooms rather than merely quiet.
  text: t.text,
  textMuted: t.text2,
  textFaint: t.text2,

  // Radii. `radiusPill` was 100; the capsule rule was dropped by decision, so
  // it is the chip step now under the name its call sites already spell.
  radiusPanel: r.panel,
  radiusCard: r.card,
  radiusPill: r.chip,

  // Effects. THE one blur value, replacing blur(28px) saturate(160%).
  glass: "blur(16px) saturate(1.15)",

  // Type
  fontSans: FIGTREE,
  fontMono: DM_MONO,
} as const

// Gamification colour language.
/** XP = the light, spent as a fill. The FIGURE takes `xpText()` from progress.ts. */
export const xpColor = tokens.amber
/** Reputation = "somebody else vouched for this". */
export const reputationColor = tokens.teal
/** Streaks = the light. Same token as XP: one idea, one colour. */
export const streakColor = tokens.amber

/** Four names, one light. See the ladder in `src/lib/theme/progress.ts`. */
export const trackColors = {
  Architect: t.lit,
  Curator: t.lit,
  Mentor: t.lit,
  Explorer: t.lit,
} as const

export type TrackName = keyof typeof trackColors
