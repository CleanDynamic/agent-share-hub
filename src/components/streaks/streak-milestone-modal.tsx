import { Flame, Share2, X } from "lucide-react"
import { BORDER, COLORS, FONT, ORANGE_GRADIENT, RADIUS } from "./tokens"

export interface StreakMilestoneModalProps {
  /** Milestone streak count reached, e.g. 30. */
  milestone?: number
  /** Headline label for the milestone. */
  title?: string
  /** Whether the modal is open. */
  open?: boolean
  /** Show the share button. Omitted at L1 to reduce chrome. */
  showShare?: boolean
  onClose?: () => void
  onShare?: () => void
}

/**
 * StreakMilestoneModal — celebrates hitting a streak milestone. Warm, reward-y.
 * At L1 the share button is hidden (showShare=false) to keep chrome minimal.
 */
export default function StreakMilestoneModal({
  milestone = 30,
  title = "One month strong",
  open = true,
  showShare = true,
  onClose,
  onShare,
}: StreakMilestoneModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,20,28,0.6)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${milestone} day streak milestone`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 360,
          background: COLORS.shell,
          border: BORDER.hairlineStrong,
          borderRadius: RADIUS.panel,
          padding: 28,
          fontFamily: FONT.sans,
          textAlign: "center",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          position: "relative",
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute inline-flex items-center justify-center transition-opacity hover:opacity-70"
          style={{
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            borderRadius: RADIUS.pill,
            background: "transparent",
            border: "none",
            color: COLORS.textFaint,
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>

        <div
          className="mx-auto flex items-center justify-center"
          style={{
            width: 76,
            height: 76,
            borderRadius: RADIUS.pill,
            background: "rgba(245,158,11,0.14)",
            border: "0.5px solid rgba(245,158,11,0.4)",
            color: COLORS.streakAmber,
            marginBottom: 18,
          }}
        >
          <Flame size={38} strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} />
        </div>

        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1,
            color: COLORS.streakAmber,
            letterSpacing: "-0.03em",
          }}
        >
          {milestone}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: COLORS.textMuted }}>
          day streak
        </p>

        <h2
          style={{
            margin: "16px 0 6px",
            fontSize: 20,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            lineHeight: 1.5,
            color: COLORS.textMuted,
          }}
        >
          {milestone} days of showing up. Momentum like this is rare — keep going.
        </p>

        <div className="flex flex-col gap-2.5" style={{ marginTop: 22 }}>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center transition-opacity hover:opacity-90"
            style={{
              height: 44,
              borderRadius: RADIUS.pill,
              background: ORANGE_GRADIENT,
              border: "none",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Keep the momentum
          </button>

          {showShare && (
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
              style={{
                height: 44,
                borderRadius: RADIUS.pill,
                background: COLORS.input,
                border: BORDER.hairline,
                color: COLORS.text,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Share2 size={16} />
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
