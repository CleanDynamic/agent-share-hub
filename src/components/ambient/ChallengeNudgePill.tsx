import { useState } from "react"
import { Target, X } from "lucide-react"
import { tokens, xpColor, streakColor } from "./tokens"

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
  accent = streakColor,
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
        borderRadius: tokens.radiusPill,
        background: tokens.card,
        border: `0.5px solid ${accent}4D`,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        boxShadow: "0 6px 20px rgba(0,0,0,0.28)",
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 26,
          height: 26,
          borderRadius: tokens.radiusPill,
          background: `${accent}26`,
        }}
      >
        <Target size={15} color={accent} />
      </span>

      <span className="flex items-center gap-2">
        <span style={{ fontSize: 13, fontWeight: 500, color: tokens.text }}>
          {label}
        </span>
        <span
          style={{
            fontFamily: tokens.fontMono,
            fontSize: 11.5,
            fontWeight: 600,
            color: xpColor,
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
          borderRadius: tokens.radiusPill,
          background: tokens.orangeGradient,
          color: "#fff",
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
