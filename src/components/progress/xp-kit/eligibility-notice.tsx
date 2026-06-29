import { useState } from "react"
import { PiggyBank, X } from "lucide-react"
import { tokens } from "./tokens"

export interface EligibilityNoticeProps {
  isVerified: boolean
  /** Hours remaining in the 48h banking window */
  hoursRemaining: number
  onVerifyClick: () => void
}

/**
 * Dismissible, warm onboarding banner explaining that XP is banked now and
 * switches on after email verification + the first 48 hours.
 */
export default function EligibilityNotice({
  isVerified,
  hoursRemaining,
  onVerifyClick,
}: EligibilityNoticeProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "16px 18px",
        borderRadius: tokens.radiusCard,
        background: "rgba(232,87,26,0.08)",
        border: "0.5px solid rgba(232,87,26,0.30)",
        fontFamily: tokens.fontSans,
      }}
      role="status"
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "rgba(232,87,26,0.16)",
          flexShrink: 0,
        }}
      >
        <PiggyBank size={20} color={tokens.orange} />
      </span>

      <div style={{ flex: 1, minWidth: 0, paddingRight: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>
          You&apos;re all set — XP starts soon
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5, color: tokens.textMuted }}>
          Verify your email and your XP switches on after your first 48 hours. Everything you do now
          is already banked.
          {!isVerified && hoursRemaining > 0 && (
            <span style={{ color: tokens.amber }}>{` ~${Math.round(hoursRemaining)}h to go.`}</span>
          )}
        </p>

        {!isVerified && (
          <button
            type="button"
            onClick={onVerifyClick}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: tokens.radiusPill,
              border: "none",
              cursor: "pointer",
              background: tokens.orangeGradient,
              color: "#fff",
              fontFamily: tokens.fontSans,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Verify email
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: tokens.textFaint,
          padding: 2,
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
