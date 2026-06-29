import { RotateCcw } from "lucide-react"
import { BORDER, COLORS, FONT, ORANGE_GRADIENT, RADIUS } from "./tokens"

export interface StreakLostCardProps {
  /** Length of the streak that ended. */
  previousStreak?: number
  /** Best streak ever, kept as a quiet reassurance. */
  bestStreak?: number
  /** Start-again handler. */
  onRestart?: () => void
}

/**
 * StreakLostCard — shown after a streak resets. Copy is intentionally warm and
 * forward-looking, never punishing. Headline is fixed by design.
 */
export default function StreakLostCard({
  previousStreak = 14,
  bestStreak = 41,
  onRestart,
}: StreakLostCardProps) {
  return (
    <section
      style={{
        width: 340,
        background: COLORS.card,
        border: BORDER.hairline,
        borderRadius: RADIUS.panel,
        padding: 24,
        fontFamily: FONT.sans,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: "-0.01em",
        }}
      >
        Streaks reset, momentum doesn&apos;t
      </h2>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 13.5,
          lineHeight: 1.55,
          color: COLORS.textMuted,
        }}
      >
        Your {previousStreak}-day streak ended, but everything you built is still
        yours. Pick it back up whenever you&apos;re ready.
      </p>

      <div
        className="flex items-center justify-between"
        style={{
          marginTop: 18,
          padding: "12px 14px",
          background: COLORS.input,
          border: BORDER.hairline,
          borderRadius: RADIUS.card,
        }}
      >
        <span style={{ fontSize: 12.5, color: COLORS.textMuted }}>
          Your best streak
        </span>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 16,
            fontWeight: 600,
            color: COLORS.streakAmber,
          }}
        >
          {bestStreak} days
        </span>
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="inline-flex w-full items-center justify-center gap-2 transition-opacity hover:opacity-90"
        style={{
          marginTop: 18,
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
        <RotateCcw size={16} />
        Start a new streak
      </button>
    </section>
  )
}
