// RC-P26 — one badge, drawn one way.
//
// TIER IS WEIGHT AND FILL, NEVER A HUE ⟦buildgallery-theme › Progress and
// achievement⟧. The nine category hues are taken and mean something else, so a
// system that told five tiers apart by five colours collapses to this ladder,
// which is STATES.md row 18:
//
//   common    a 1px --line outline, nothing inside
//   rare      a --recess fill
//   highest   a --lit fill, with the icon and the label in --on-lit
//   not yet   the outline, whatever the tier, a --text2 icon and "Not yet" beneath
//
// Amber is light, never type: --lit is only ever a ground, and the ink on it is
// --on-lit. On Noon it is a solid mark with no glow, because a glow needs
// darkness to glow against; Dusk gets the same solid mark, so the two rooms draw
// one badge.
//
// EVERY BADGE OF A TIER LOOKS IDENTICAL APART FROM ITS ICON ⟦law-of-similarity⟧.
// That is why the treatment is one function, badgePaint, and not a style written
// where each badge is drawn: the tile, the profile's showcase strip, the reveal
// strip, the showcase editor and the detail modal all spend it, so a tier cannot
// drift on one surface. All four paints use the same 1px border, so the box is
// the same size in every tier and earning a badge moves nothing.
//
// A TIER IS NOT CARRIED BY COLOUR ALONE ⟦color-system › Accessibility
// Requirements⟧. A common and a rare badge are a fill apart, which is faint in
// grayscale by the theme's own choice, so the tier is also written in words,
// "<name>, <tier> badge", in the accessible name of every mark. A test reads it.
//
// MEASURED (Noon / Dusk, from the declared tokens): --text on --bg
// 13.10 / 14.17; --text on --recess 11.33 / 10.62; --on-lit on --lit 7.29 /
// 7.49; --text2 on --bg 5.26 / 7.65. Every label clears the 4.5 text floor. The
// two edges do not clear the 3.0 floor for UI: the outline is --line on --bg,
// 1.30 / 1.82, and the amber fill on Noon's ground is 1.80 (Dusk 7.47),
// the same figure the focus ring was escalated for (BG-P30). Neither edge is the
// only carrier of anything: the ink inside is what is read, and the tier is in
// the words. Reported, not repainted.
//
// RADIUS is --r-chip, the theme's radius for badges; --r-full is for avatars.

import type { CSSProperties } from "react"

import { r } from "@/lib/theme/radius"
import { SPACE } from "@/lib/theme/space"
import { t } from "@/lib/theme/tokens"
import { data as dataText, label as labelText } from "@/lib/theme/type"

import type { Badge, Tier } from "./badge-data"

/** The colours of a badge: its fill, its 1px edge, and the ink of its icon and label. */
export interface BadgePaint {
  background: string
  border: string
  color: string
}

/** STATES.md row 18. The edge is 1px in every case, so the four boxes are one size. */
export function badgePaint(tier: Tier, earned: boolean): BadgePaint {
  if (!earned) {
    return { background: "transparent", border: `1px solid ${t.line}`, color: t.text2 }
  }
  switch (tier) {
    case "rare":
      return { background: t.recess, border: `1px solid ${t.recess}`, color: t.text }
    case "highest":
      return { background: t.lit, border: `1px solid ${t.lit}`, color: t.onLit }
    case "common":
      return { background: "transparent", border: `1px solid ${t.line}`, color: t.text }
  }
}

/**
 * The accessible name of a badge: "<name>, <tier> badge", with ", not yet
 * earned" on the end for one the person has not earned. The tier in words is
 * what makes the mark readable without its colour.
 */
export function badgeLabel(badge: Pick<Badge, "name" | "tier">, earned: boolean): string {
  const words = `${badge.name}, ${badge.tier} badge`
  return earned ? words : `${words}, not yet earned`
}

export interface BadgeMarkProps {
  badge: Badge
  /** Defaults to badge.earned; pass it when the person's rows decide. */
  earned?: boolean
}

/** The badge as a labelled tile: the icon above its name, filled for its tier. */
export function BadgeMark({ badge, earned = badge.earned }: BadgeMarkProps) {
  const Icon = badge.icon

  const tile: CSSProperties = {
    ...badgePaint(badge.tier, earned),
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    width: "100%",
    aspectRatio: "1 / 1",
    padding: SPACE.xs,
    borderRadius: r.chip,
    textAlign: "center",
  }

  return (
    <div
      role="img"
      aria-label={badgeLabel(badge, earned)}
      data-testid={`badge-mark-${badge.id}`}
      data-tier={badge.tier}
      data-earned={earned ? "true" : "false"}
      style={tile}
    >
      <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
      <span style={{ ...labelText, textWrap: "balance" }}>{badge.name}</span>
      {earned ? null : <span style={dataText}>Not yet</span>}
    </div>
  )
}

export default BadgeMark
