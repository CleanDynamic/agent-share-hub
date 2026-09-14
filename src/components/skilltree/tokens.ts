// The skill tree's paint and types — REPOINTED BY BG-P28b.
//
// Nine components in this folder spend these keys, plus `SkillTreeTab` which
// reads `trackMeta` and `TrackId`, so the KEYS AND THE TYPES ARE UNTOUCHED and
// only the values move, to `var(--token)` references that follow
// `<html data-theme>` with no re-render.
//
// THE NODE STATES ARE THE LADDER, which is the whole reason this surface needed
// a shared module rather than a sixth private palette. A skill node has exactly
// three states and they map one-to-one onto the three rungs in
// `src/lib/theme/progress.ts`:
//
//   locked     `--text2` on `--recess`   present, legible, not yet yours.
//   available  a `--line` border          the invitation.
//   unlocked   a `--lit` fill, `--on-lit` the light. Scarce by design.
//
// Callers spend `nodeState[state]` rather than assembling those three from the
// keys below, so a node and a badge tile cannot drift apart.
//
// CONNECTORS ARE `--line` AND NEVER GLOW. A glowing connector on Dusk makes the
// tree look like a circuit board, and on Exhibition it has nothing to glow
// against; either way the line's job is to say "this follows from that", which
// is a hairline's job everywhere else in the product.
//
//   brandOrange `#E8571A` → `--action`   the one primary fill.
//   teal        `#2EC4B6` → `--evidence` "somebody vouched for this".
//   amber       `#F59E0B` → `--lit`      progress is light.
//   purple      `#7C3AED` → the ladder   a track is not a part category.
//   green       `#22C55E` → `--evidence` the theme publishes no green.
//
// THE FOUR TRACKS LOSE THEIR FOUR HUES. `trackMeta[x].color` was a private
// rainbow — orange, purple, teal, amber — for four identities that are not part
// categories and so may not borrow the nine. Each track keeps its NAME and its
// philosophy string, which is what actually distinguishes it, and takes `--lit`
// like every other progress marker.

import type { CSSProperties } from "react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { tierFill, lockedFill } from "@/lib/theme/progress";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export type TrackId = "architect" | "curator" | "mentor" | "explorer"

export type NodeState = "locked" | "available" | "unlocked"

export const tokens = {
  shell: t.glass,
  card: t.glass2,
  input: t.recess,
  // Widths untouched — this is a repaint, and the canvas positions nodes
  // against a fixed box.
  borderSoft: `0.5px solid ${t.line}`,
  border: `0.5px solid ${t.line}`,
  brandOrange: t.action,
  brandGradient: t.action,
  /** The measured label colour for anything filled `brandOrange`. */
  onBrandOrange: t.onAction,
  teal: t.evidence,
  amber: t.lit,
  /** The measured label colour for anything filled `amber`. */
  onAmber: t.onLit,
  purple: t.lit,
  green: t.evidence,
  locked: t.text2,
  /** The connector between two nodes. A hairline, and never a glow. */
  connector: t.line,
  // THE one blur value, replacing blur(28px) saturate(160%).
  glass: "blur(16px) saturate(1.15)",
  radiusPanel: r.panel,
  radiusCard: r.card,
  // `radiusPill` was 100 — a capsule, dropped by decision — now the chip step.
  radiusPill: r.chip,
  text: t.text,
  textDim: t.text2,
  // Two text tokens, not three: the faint rung was white at 0.35, below the
  // 4.5:1 floor in both rooms rather than merely quiet.
  textFaint: t.text2,
} as const

/**
 * The three node states, as the three rungs of the ladder.
 *
 * Spend the whole object on a node rather than picking one property off it:
 * `unlocked` is only legal because its label is `--on-lit`, and a caller that
 * takes the background without the colour gets amber on amber.
 */
export const nodeState: Record<NodeState, CSSProperties> = {
  locked: { ...lockedFill(), background: t.recess },
  available: tierFill("common"),
  unlocked: tierFill("highest"),
}

export const trackMeta: Record<
  TrackId,
  { name: string; color: string; philosophy: string }
> = {
  architect: {
    name: "Architect",
    color: t.lit,
    philosophy: "Design the systems others build on.",
  },
  curator: {
    name: "Curator",
    color: t.lit,
    philosophy: "Shape signal out of the noise.",
  },
  mentor: {
    name: "Mentor",
    color: t.lit,
    philosophy: "Multiply yourself through others.",
  },
  explorer: {
    name: "Explorer",
    color: t.lit,
    philosophy: "Go where the map runs out.",
  },
}

// Was `var(--font-geist-mono)`, a Next.js variable this app never defines, so
// every number on the tree fell through to a system monospace.
export const mono = DM_MONO
export const sans = FIGTREE

export function fmt(n: number): string {
  return n.toLocaleString("en-US")
}
