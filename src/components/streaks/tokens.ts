// The streak surface's paint — REPOINTED BY BG-P28b.
//
// Seven components in this folder spend these keys, so the KEYS ARE UNTOUCHED
// and only the values move, to `var(--token)` references that follow
// `<html data-theme>` with no re-render.
//
// STREAKS ARE PROGRESS, so the whole surface is carried by `--lit` as LIGHT —
// a flame, a filled calendar cell, a freeze pip — and never as type. The amber
// that used to be `#F59E0B` here was doing that job already; what it was not
// doing was reading the theme, or staying off the words.
//
//   xpOrange     `#E8571A` → `--action`        the one primary fill.
//   orangeDeep   `#C44514` → `--action`        the gradient's second stop, and
//                                              a gradient is decoration.
//   reputation   `#2EC4B6` → `--evidence`      "somebody vouched for this".
//   streakAmber  `#F59E0B` → `--lit`           the light, by its proper name.
//   purple       `#7C3AED` → the ladder        a track is not a part category.
//   greenPositive`#22C55E` → `--evidence`      the theme publishes no green.
//
// THE HEAT RAMP IS A CHART, and `data-visualization` applies to it. It was five
// steps of `rgba(232,87,26,…)` — the brand orange at rising alpha, with a
// white-alpha empty cell that vanished on Exhibition. Three things changed and
// each is an encoding decision rather than a recolour:
//
//   · The ramp is `--lit`, because the quantity it encodes is progress and the
//     ramp must not read as the primary action tiled 365 times.
//   · The empty cell is `--recess`, an inset ground rather than a tint of the
//     data colour. Zero is not "a little bit of the thing"; it is the absence
//     of it, and a sequential ramp whose bottom step is the same hue as its top
//     makes an empty year look like a faint streak.
//   · The alphas rise 18 / 32 / 50 / 100 rather than 28 / 50 / 72 / 95. The top
//     step is the token at full strength, so the busiest day is the same amber
//     as the flame above it — one light, one meaning.
//
// WHY THE MIDDLE STEPS ARE QUIETER THAN THE RAMP'S OWN LOGIC WOULD SUGGEST.
// `Analytics.tsx` hard-codes `level: d.kind === "frozen" ? 0 : 3` — every
// active day resolves to index 3, whatever the person actually did. So in
// production this is not a five-step ramp at all: it is a BINARY rendered on
// one, and a sixty-day streak paints ~55 cells of the same value. At the 72%
// the old ramp used, that field carried more amber AREA than the level ring,
// the flame and the quest bar combined, and the page's entry point became a
// calendar rather than "what level am I". Pulling the middle steps down keeps
// the ramp monotonic and keeps the eye on the level marker, where it belongs.
//
// The encoding itself is BG-P29-or-later work and is out of this prompt's
// scope, which is appearance only: either feed the calendar real activity
// counts so the ramp earns its five steps, or collapse it to two.

import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export const COLORS = {
  // brand / gamification language
  xpOrange: t.action,
  orangeDeep: t.action,
  /** The measured label colour for anything filled `xpOrange`. */
  onOrange: t.onAction,
  reputationTeal: t.evidence,
  streakAmber: t.lit,
  /** The measured label colour for anything filled `streakAmber`. */
  onStreakAmber: t.onLit,
  purple: t.lit,
  greenPositive: t.evidence,
  // surfaces
  shell: t.glass,
  card: t.glass2,
  input: t.recess,
  // text — two tokens, not four. `textFaint` and `locked` were white at 0.35
  // and 0.25, both below the 4.5:1 floor in either room.
  text: t.text,
  textMuted: t.text2,
  textFaint: t.text2,
  locked: t.text2,
} as const

export const BORDER = {
  // Widths untouched: half a pixel moves every fixed-height cell in the
  // calendar, and this is a repaint.
  hairline: `0.5px solid ${t.line}`,
  hairlineStrong: `0.5px solid ${t.line}`,
} as const

export const RADIUS = {
  // `pill` was 100 — a capsule, dropped by decision — and is the chip step now.
  panel: r.panel,
  card: r.card,
  pill: r.chip,
} as const

export const FONT = {
  sans: FIGTREE,
  // Was 'JetBrains Mono', which this app does not load, so every streak count
  // fell through to a system monospace. DM Mono is the system's data face.
  mono: DM_MONO,
} as const

export const GLASS = {
  // THE one blur value, replacing blur(28px) saturate(160%).
  backdropFilter: "blur(16px) saturate(1.15)",
  WebkitBackdropFilter: "blur(16px) saturate(1.15)",
} as const

/** Was a two-stop ramp. The theme's primary is a flat fill with a measured label. */
export const ORANGE_GRADIENT = t.action

/**
 * Heatmap intensity ramp for the streak calendar: index 0 is an empty day, 4 a
 * full one. See the header for why zero is a ground rather than a tint.
 */
export const HEAT_RAMP = [
  t.recess,
  tokenAlpha("lit", 0.18),
  tokenAlpha("lit", 0.32),
  tokenAlpha("lit", 0.5),
  t.lit,
] as const
