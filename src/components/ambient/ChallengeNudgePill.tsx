import { useState } from "react"
import { Target, X } from "lucide-react"
import { tokens } from "./tokens"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { elevation, SCRIM } from "@/lib/theme/elevation"
import { tierFill, xpText } from "@/lib/theme/progress"

export interface ChallengeNudgePillProps {
  /** Short challenge prompt, e.g. "Publish a blueprint today". */
  label: string
  /** XP reward for completing the challenge. */
  xpReward: number
  /** Accent colour. Defaults to streak amber. */
  accent?: string
  /** Fired when the user accepts the challenge. */
  onAccept?: () => void
  /** Fired when the user dismisses (max 1 nudge/day). */
  onDismiss?: () => void
}

/**
 * ChallengeNudgePill — a single, low-pressure daily nudge toward a challenge.
 * Capped at 1/day. L2.
 */
export default function ChallengeNudgePill({
  label,
  xpReward,
  accent = undefined,
  onAccept,
  onDismiss,
}: ChallengeNudgePillProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div
      className="inline-flex items-center gap-2.5"
      style={{
        fontFamily: tokens.fontSans,
        padding: "7px 8px 7px 14px",
        /**
         * BG-P28b. The border was `${accent}4D` and the medallion `${accent}26`
         * — an alpha suffix glued onto what is now `var(--lit)`, producing
         * `var(--lit)4D`, which is not a colour, so the pill rendered with no
         * border and no medallion ground. It takes the glass pairing every
         * other ambient surface takes, which works over a light page, a dark
         * page and the composer's flat ground alike.
         */
        borderRadius: r.control,
        background: t.glass,
        border: `0.5px solid ${t.glassBorder}`,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        ...elevation.raised,
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 26,
          height: 26,
          borderRadius: r.full,
          background: t.glass2,
          border: `0.5px solid ${t.line}`,
        }}
      >
        <Target size={15} color={accent ?? t.text2} />
      </span>

      <span className="flex items-center gap-2">
        <span style={{ fontSize: 13, fontWeight: 500, color: tokens.text }}>
          {label}
        </span>
        <span
          style={{
            ...xpText("onLit"),
            background: tierFill("highest").background,
            borderRadius: r.chip,
            padding: "1px 6px",
            fontSize: 11.5,
            fontWeight: 500,
          }}
        >
          +{xpReward} XP
        </span>
      </span>

      <button
        type="button"
        onClick={onAccept}
        className="ml-1 shrink-0 transition-opacity hover:opacity-90"
        style={{
          padding: "6px 14px",
          borderRadius: r.control,
          background: t.action,
          color: t.onAction,
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        Accept
      </button>

      <button
        type="button"
        aria-label="Dismiss challenge"
        onClick={() => {
          setDismissed(true)
          onDismiss?.()
        }}
        className="shrink-0 transition-opacity hover:opacity-100"
        style={{ color: tokens.textFaint, opacity: 0.65, padding: 4 }}
      >
        <X size={15} />
      </button>
    </div>
  )
}
