// The quest and challenge kit's paint — REPOINTED BY BG-P28b.
//
// Seven components in this folder spend these keys, so the KEYS ARE UNTOUCHED
// and only the values move, to `var(--token)` references that follow
// `<html data-theme>` with no re-render.
//
// THE TWO STATES THIS SURFACE HAS TO GET RIGHT:
//
//   completed  `--evidence`. A finished step is a claim that something worked,
//              which is exactly what evidence names — and it is the same token
//              the plaque uses for a reproduction, so a completed quest step
//              and a reproduced build agree with each other.
//   claimable  `--action`, as the ONE primary button on the page. The theme
//              allows one primary action per view, so a claimable challenge
//              takes it and everything else on the surface steps down to a
//              glass secondary or a ghost.
//
// That pairing is why `semantic.xp` is NOT `--action` here even though
// `colors.orange` is: the orange was the primary FILL, and XP is PROGRESS,
// which is `--lit` as light. A claim button and the XP it awards are two
// different claims and take two different tokens.
//
//   orange     `#E8571A` → `--action`   the one primary fill.
//   orangeDeep `#C44514` → `--action`   the gradient's second stop; a gradient
//                                       is decoration and has no second stop
//                                       legal in both rooms.
//   teal       `#2EC4B6` → `--evidence` completed, reproduced, "it worked".
//   amber      `#F59E0B` → `--lit`      progress is light, never type.
//   purple     `#7C3AED` → the ladder   a track is not a part category.
//   green      `#22C55E` → `--evidence` the theme publishes no green, and
//                                       "done" and "it worked" are one claim.

import type { CSSProperties } from "react"

import { r } from "@/lib/theme/radius";
import { colourAlpha, t } from "@/lib/theme/tokens";

export const colors = {
  shell: t.glass,
  card: t.glass2,
  input: t.recess,

  borderSoft: t.line,
  borderStrong: t.line,

  textPrimary: t.text,
  textSecondary: t.text2,
  // The system publishes two text tokens. `textMuted` was white at 0.40 and
  // `locked` at 0.25 — both below the 4.5:1 floor in either room, so neither
  // was a quieter label, only an unreadable one.
  textMuted: t.text2,
  locked: t.text2,

  // brand
  orange: t.action,
  orangeDeep: t.action,
  /** The measured label colour for anything filled `orange`. */
  onOrange: t.onAction,
  teal: t.evidence,
  amber: t.lit,
  /** The measured label colour for anything filled `amber`. */
  onAmber: t.onLit,
  purple: t.lit,
  green: t.evidence,
} as const

/**
 * The colour language, by role. See the header: `xp` is the light and `claim`
 * is the primary action, and they are deliberately not the same token.
 */
export const semantic = {
  xp: colors.amber,
  reputation: colors.teal,
  streak: colors.amber,
  completed: colors.teal,
  claim: colors.orange,
  locked: colors.locked,
} as const

/** Four names, one light. See the ladder in `src/lib/theme/progress.ts`. */
export const tracks = {
  Architect: t.lit,
  Curator: t.lit,
  Mentor: t.lit,
  Explorer: t.lit,
} as const

/** Was a two-stop ramp. The theme's primary is a flat fill with a measured label. */
export const orangeGradient = t.action

export const radius = {
  // `pill` was 100 — a capsule, dropped by decision — now the chip step.
  panel: r.panel,
  card: r.card,
  pill: r.chip,
} as const

export const glass: CSSProperties = {
  // THE one blur value, replacing blur(28px) saturate(160%).
  backdropFilter: "blur(16px) saturate(1.15)",
  WebkitBackdropFilter: "blur(16px) saturate(1.15)",
}

/**
 * A tint of one of the constants above. It used to parse a hex by hand, which
 * every value in this module has stopped being; the blend moves to `color-mix`,
 * where the browser resolves the token after the theme has decided what it is.
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
