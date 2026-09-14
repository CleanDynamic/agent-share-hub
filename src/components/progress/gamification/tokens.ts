// The gamification kit's paint — REPOINTED BY BG-P28b.
//
// Every value below used to be a literal struck for one dark room: a `#25252F`
// page ground, three stone surfaces at fixed alpha, a ramp of white-alpha inks,
// and six accent hexes. None of them read `<html data-theme>`, so a level bar
// drawn on Exhibition was a dark-room object sitting in a lit one.
//
// THE KEYS ARE UNTOUCHED. Six components in this folder spend them and BG-P28b
// is a repaint rather than a rewrite, so only the values move — to
// `var(--token)` references, which follow the theme switch with no re-render.
// Read every name below as the JOB it does rather than as the colour it was.
//
// WHERE THE SIX ACCENTS WENT, and why none of them is "the nearest hue":
//
//   brand / XP   `#E8571A`  → `--action`   as a FILL. The orange was the one
//                                          primary fill on this surface, and
//                                          that is what `--action` names.
//   teal / rep   `#2EC4B6`  → `--evidence` reputation is "somebody else vouched
//                                          for this", which is what evidence
//                                          names.
//   amber        `#F59E0B`  → `--lit`      progress is light. See progress.ts.
//   purple       `#7C3AED`  → the ladder   it marked a TRACK, not a part
//                                          category, and the nine category hues
//                                          may not be borrowed.
//   green        `#22C55E`  → `--evidence` the theme publishes no green, and
//                                          "live" and "it worked" are one claim.
//   page ground  `#25252F`  → `--bg`       there is no void in a lit room.
//
// THE XP ROLE AND THE BRAND FILL ARE NOT THE SAME TOKEN, which is the one
// subtlety here. `colors.brand` is the primary FILL and resolves to `--action`;
// the XP figure it used to colour is progress and resolves to `--lit` through
// `progress.ts`. A caller wanting a lit XP chip spends `tierFill("highest")`,
// never `colors.brand`.
//
// THE GRADIENT IS GONE. `brandGradient` is a flat `--action` now: a gradient is
// decoration, the theme's primary is a fill with a measured label colour on it,
// and a two-stop ramp has no second stop that is legal in both rooms. The key
// survives so its callers keep compiling.

import { r } from "@/lib/theme/radius";
import { colourAlpha, t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

export const colors = {
  /** Was `#25252F`. The page ground, which is luminous grey in the light room. */
  pageBg: t.bg,
  shell: t.glass,
  card: t.glass2,
  input: t.recess,
  borderSoft: t.line,
  borderStrong: t.line,
  textPrimary: t.text,
  textMuted: t.text2,
  // The system publishes two text tokens, not three. The third rung here was
  // white at 0.35 — below the 4.5:1 floor in both rooms, so it was never a
  // quieter label, only an unreadable one. It resolves to the second.
  textFaint: t.text2,
  locked: t.text2,

  // Brand / semantic. See the header for why each lands where it does.
  brand: t.action,
  brandGradient: t.action,
  /** The measured label colour for anything filled `brand`. */
  onBrand: t.onAction,
  teal: t.evidence,
  amber: t.lit,
  purple: t.lit,
  green: t.evidence,
} as const

/**
 * Track identity colours. Four names, one light.
 *
 * Four hues for four tracks is the rainbow the ladder exists to replace: a
 * track is not a part category, so it takes no category hue, and the theme's
 * answer for identity-by-rank is weight and fill. The names still name them.
 */
export const tracks = {
  Architect: t.lit,
  Curator: t.lit,
  Mentor: t.lit,
  Explorer: t.lit,
} as const

export type TrackName = keyof typeof tracks

export const radius = {
  // The radius scale, not three numbers picked per component. `pill` was 100 —
  // a capsule, which the shape language dropped by decision — and is the chip
  // step now. The key keeps its name so its call sites need not be reshaped in
  // a prompt that is not allowed to reshape them.
  panel: r.panel,
  card: r.card,
  pill: r.chip,
} as const

export const glass = {
  // THE one blur value. It was blur(28px) saturate(160%) — a second blur value
  // in a system that has exactly one, and 28px of backdrop on a shell-tier
  // surface is the cost the theme's budget exists to stop.
  backdropFilter: "blur(16px) saturate(1.15)",
  WebkitBackdropFilter: "blur(16px) saturate(1.15)",
} as const

/**
 * A tint of one of the constants above.
 *
 * It used to parse a hex by hand, which every value in this module has stopped
 * being. Delegating keeps the name its callers already spell while the blend
 * moves to `color-mix`, where the browser resolves the token after the theme
 * has decided what it is.
 */
export function withAlpha(colour: string, alpha: number): string {
  return colourAlpha(colour, alpha)
}

/** BG-P03 moved the data face to DM Mono; this is that stack, by its own name. */
export const monoFont = DM_MONO
