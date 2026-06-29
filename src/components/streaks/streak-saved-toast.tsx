import { Snowflake, X } from "lucide-react"
import { BORDER, COLORS, FONT, RADIUS } from "./tokens"

export interface StreakSavedToastProps {
  /** The streak length that was preserved. */
  streak?: number
  /** Freeze passes remaining after this save. */
  freezesLeft?: number
  /** Dismiss handler. */
  onDismiss?: () => void
}

/**
 * StreakSavedToast — fires the morning after a freeze pass is used, at ALL
 * layers. Pure reassurance, not complexity: "we caught you, you're fine."
 */
export default function StreakSavedToast({
  streak = 14,
  freezesLeft = 2,
  onDismiss,
}: StreakSavedToastProps) {
  return (
    <div
      role="status"
      className="flex items-start gap-3"
      style={{
        width: 340,
        background: COLORS.shell,
        border: BORDER.hairlineStrong,
        borderRadius: RADIUS.panel,
        padding: 16,
        fontFamily: FONT.sans,
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 38,
          height: 38,
          borderRadius: RADIUS.card,
          background: "rgba(46,196,182,0.16)",
          border: "0.5px solid rgba(46,196,182,0.4)",
          color: COLORS.reputationTeal,
        }}
      >
        <Snowflake size={20} strokeWidth={2} aria-hidden="true" />
      </div>

      <div className="flex-1" style={{ minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          We saved your{" "}
          <span style={{ fontFamily: FONT.mono, color: COLORS.streakAmber }}>
            {streak}
          </span>
          -day streak
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 12.5,
            lineHeight: 1.45,
            color: COLORS.textMuted,
          }}
        >
          You missed yesterday, so we used a freeze pass. {freezesLeft} left this
          month — no need to do anything.
        </p>
      </div>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="inline-flex shrink-0 items-center justify-center transition-opacity hover:opacity-70"
        style={{
          width: 24,
          height: 24,
          borderRadius: RADIUS.pill,
          background: "transparent",
          border: "none",
          color: COLORS.textFaint,
          cursor: "pointer",
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
