import { Hammer, TrendingUp, Flame, X } from "lucide-react"
import { tokens } from "./tokens"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { elevation, SCRIM } from "@/lib/theme/elevation"
import { tierFill, xpText } from "@/lib/theme/progress"

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
    title: "Create",
    body: "Earn XP for publishing and contributing.",
  },
  {
    icon: TrendingUp,
    title: "Progress",
    body: "Levels and marks show on your profile.",
  },
  {
    icon: Flame,
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
      style={{ fontFamily: tokens.fontSans, ...SCRIM }}
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
          background: t.glass,
          border: `0.5px solid ${t.glassBorder}`,
          backdropFilter: tokens.glass,
          WebkitBackdropFilter: tokens.glass,
          ...elevation.overlay,
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
          {ROWS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex items-start gap-3"
              style={{
                padding: 13,
                borderRadius: tokens.radiusCard,
                background: t.glass2,
                border: `0.5px solid ${t.line}`,
              }}
            >
              <span
                className="flex shrink-0 items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: tokens.radiusCard,
                  /**
                   * BG-P28b. The three rows carried three hues — amber, teal,
                   * amber — for three equal items, applied as `${color}1F` and
                   * `${color}55`: alpha suffixes glued onto values that are now
                   * `var(--…)` references, so each produced a non-colour and
                   * these medallions rendered with no ground and no border at
                   * all. Three equal rows take one quiet treatment; they are
                   * distinguished by their icons and their words.
                   */
                  background: t.glass2,
                  border: `0.5px solid ${t.line}`,
                }}
              >
                <Icon size={18} color={t.text2} />
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
            borderRadius: r.control,
            background: t.action,
            color: t.onAction,
            fontSize: 14.5,
            fontWeight: 600,
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
