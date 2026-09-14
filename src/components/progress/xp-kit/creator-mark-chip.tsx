import type { LucideIcon } from "lucide-react"

import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { tierFill, type ProgressTier } from "@/lib/theme/progress"
import { tokens } from "./tokens"

export interface CreatorMark {
  icon: LucideIcon
  name: string
}

export interface CreatorMarkChipProps {
  mark: CreatorMark
  /** 'full' shows icon + name; 'minimal' shows icon only with a tooltip */
  variant?: "full" | "minimal"
  /**
   * Which rung of the ladder this mark sits on. Defaults to `rare` — an earned
   * mark is not a common one, and reserving `highest` keeps the amber scarce.
   */
  tier?: ProgressTier
}

/**
 * A small identity chip used beside names and on profiles. Repainted onto the
 * ladder by BG-P28b.
 *
 * THIS COMPONENT WAS THE PROMPT'S CLEAREST RULE VIOLATION. Its label was
 * `color: tokens.amber` — literally amber TYPE, which measures 3.01:1 on the
 * Exhibition ground and is the one thing the theme forbids outright. The chip
 * behind it was a two-stop gradient of `rgba(245,158,11,.20)` into
 * `rgba(232,87,26,.22)` over a `rgba(232,87,26,.45)` border: an amber-to-orange
 * wash that also mixed the progress light with the primary action.
 *
 * It is a rung now. The default is `rare` — a `--recess` ground with `--text`
 * on it — because a creator mark is an earned thing but not the page's
 * headline, and because a hero that already carries an amber level ring, an
 * amber level chip and an amber XP bar does not need three more amber chips
 * beside them. Five lit things on one card is nothing memorable; one is
 * von-Restorff.
 *
 * A caller with a genuinely top-tier mark passes `tier="highest"` and gets the
 * amber fill with `--on-lit` on it — light, still never type.
 */
export default function CreatorMarkChip({
  mark,
  variant = "full",
  tier = "rare",
}: CreatorMarkChipProps) {
  const Icon = mark.icon
  const fill = tierFill(tier)
  const iconColour = tier === "highest" ? fill.color : t.text2

  if (variant === "minimal") {
    return (
      <span
        title={mark.name}
        aria-label={mark.name}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: r.full,
          background: fill.background,
          border: `0.5px solid ${fill.borderColor}`,
          color: iconColour,
          cursor: "help",
          verticalAlign: "middle",
        }}
      >
        <Icon size={16} />
      </span>
    )
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: r.chip,
        background: fill.background,
        border: `0.5px solid ${fill.borderColor}`,
        fontFamily: tokens.fontSans,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: fill.color,
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} color={iconColour} />
      <span>{mark.name}</span>
    </span>
  )
}
