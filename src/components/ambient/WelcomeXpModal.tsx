import { Hammer, TrendingUp, Flame, X } from "lucide-react"
import { tokens, xpColor, reputationColor, streakColor } from "./tokens"

export interface WelcomeXpModalProps {
  /** Fired when the user clicks "Start your quest". */
  onStart: () => void
  /** Whether the modal is shown. Defaults to true. */
  open?: boolean
  /** Optional close handler (backdrop / X). */
  onClose?: () => void
}

const ROWS = [
  {
    icon: Hammer,
    color: xpColor,
    title: "Create",
    body: "Earn XP for publishing and contributing.",
  },
  {
    icon: TrendingUp,
    color: reputationColor,
    title: "Progress",
    body: "Levels and marks show on your profile.",
  },
  {
    icon: Flame,
    color: streakColor,
    title: "Return",
    body: "Streaks reward showing up.",
  },
]

/**
 * WelcomeXpModal — creator-framed onboarding. Sets the emotional frame:
 * make things, get recognized. L1.
 */
export default function WelcomeXpModal({
  onStart,
  open = true,
  onClose,
}: WelcomeXpModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ fontFamily: tokens.fontSans, background: "rgba(15,15,20,0.62)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-xp-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 412,
          borderRadius: tokens.radiusPanel,
          background: tokens.shell,
          border: tokens.borderStrong,
          backdropFilter: tokens.glass,
          WebkitBackdropFilter: tokens.glass,
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          padding: 24,
        }}
      >
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 top-4 transition-opacity hover:opacity-100"
            style={{ color: tokens.textFaint, opacity: 0.7 }}
          >
            <X size={18} />
          </button>
        )}

        <h2
          id="welcome-xp-title"
          className="text-balance"
          style={{
            fontSize: 23,
            fontWeight: 700,
            color: tokens.text,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          Make things. Get recognized.
        </h2>
        <p className="mt-2 text-pretty" style={{ fontSize: 13.5, color: tokens.textMuted, lineHeight: 1.5 }}>
          Every contribution moves you forward. Here&apos;s how it works.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {ROWS.map(({ icon: Icon, color, title, body }) => (
            <div
              key={title}
              className="flex items-start gap-3"
              style={{
                padding: 13,
                borderRadius: tokens.radiusCard,
                background: tokens.card,
                border: tokens.borderSoft,
              }}
            >
              <span
                className="flex shrink-0 items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: tokens.radiusCard,
                  background: `${color}1F`,
                  border: `0.5px solid ${color}55`,
                }}
              >
                <Icon size={18} color={color} />
              </span>
              <div className="min-w-0">
                <div style={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>
                  {title}
                </div>
                <div style={{ marginTop: 1, fontSize: 12.5, color: tokens.textMuted, lineHeight: 1.45 }}>
                  {body}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-5 flex w-full items-center justify-center transition-opacity hover:opacity-90"
          style={{
            padding: "13px 16px",
            borderRadius: tokens.radiusPill,
            background: tokens.orangeGradient,
            color: "#fff",
            fontSize: 14.5,
            fontWeight: 600,
            boxShadow: "0 6px 20px rgba(232,87,26,0.40)",
          }}
        >
          Start your quest
        </button>

        <p
          className="mt-3 text-center text-pretty"
          style={{ fontSize: 10.5, color: tokens.textFaint, lineHeight: 1.45 }}
        >
          XP earned during your first 7 days is banked and counts toward perk
          eligibility once your account is verified.
        </p>
      </div>
    </div>
  )
}
