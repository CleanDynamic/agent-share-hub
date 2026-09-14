// The XP kit's paint — REPOINTED BY BG-P28b.
//
// Nine components in this folder spend these keys — the ledger, the bar, the
// ring, the toast, the level-up modal, the meter, the stat card, the mark chip
// and the eligibility notice — so the KEYS ARE UNTOUCHED and only the values
// move, to `var(--token)` references that follow `<html data-theme>` with no
// re-render. Read every name as the JOB it does rather than as the colour it was.
//
// WHERE THE ACCENTS WENT. The full argument lives in
// `src/lib/theme/progress.ts`; the short form:
//
//   orange  `#E8571A` → `--action`        the one primary fill.
//   teal    `#2EC4B6` → `--evidence`      "somebody vouched for this".
//   amber   `#F59E0B` → `--lit`           progress is light, never type.
//   purple  `#7C3AED` → the ladder        a track is not a part category.
//   green   `#22C55E` → `--evidence`      the theme publishes no green.
//   red     `#EF4444` → `--cat-breakage`  breakage is a category the system
//                                         already names, and a second red
//                                         would be a second meaning.
//
// THE LEDGER IS A DATA TABLE and `fontMono` is what sets it. It was
// `'JetBrains Mono'`, which this app does not load — so every XP figure in the
// ledger fell through to a system monospace and the column stopped aligning
// with the rest of the product. It is DM Mono now, the system's data face, and
// callers that align digits should pair it with `tabular` from `type.ts`.

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export const tokens = {
  // Surfaces
  shell: t.glass,
  card: t.glass2,
  input: t.recess,

  // Borders. Widths untouched — this is a repaint, and half a pixel moves every
  // fixed-height row in the ledger.
  borderSoft: `0.5px solid ${t.line}`,
  borderMid: `0.5px solid ${t.line}`,
  borderStrong: `0.5px solid ${t.line}`,

  // Brand + semantic colours
  orange: t.action,
  orangeGradient: t.action,
  /** The measured label colour for anything filled `orange`. */
  onOrange: t.onAction,
  teal: t.evidence,
  amber: t.lit,
  purple: t.lit,
  green: t.evidence,
  red: t.catBreakage,
  locked: t.text2,

  // Track colours. Four names, one light — see the ladder.
  trackArchitect: t.lit,
  trackCurator: t.lit,
  trackMentor: t.lit,
  trackExplorer: t.lit,

  // Text. Two tokens, not three: the faint rung was white at 0.35, below the
  // 4.5:1 floor in both rooms rather than merely quiet.
  text: t.text,
  textMuted: t.text2,
  textFaint: t.text2,
  /** For a figure sitting ON an amber fill. Still not amber type. */
  onLit: t.onLit,

  // Radii. `radiusPill` was 100; the capsule rule was dropped by decision.
  radiusPanel: r.panel,
  radiusCard: r.card,
  radiusPill: r.chip,

  // Glass — THE one blur value, replacing blur(28px) saturate(160%).
  glass: {
    backdropFilter: "blur(16px) saturate(1.15)",
    WebkitBackdropFilter: "blur(16px) saturate(1.15)",
  } as const,

  // Fonts
  fontSans: FIGTREE,
  fontMono: DM_MONO,
} as const

export type Tokens = typeof tokens
