import { Flame, Snowflake } from "lucide-react"
import { COLORS, FONT } from "./tokens"

export type StreakFlameState = "active" | "frozen-today" | "at-risk" | "zero"

export interface StreakFlameProps {
  /** Current streak length in days. */
  streak: number
  /** Visual state of the flame. */
  state?: StreakFlameState
  /** Pixel size of the icon. */
  size?: number
  /**
   * The at-risk pulse only activates when streak >= this value, so we never
   * pressure someone on day one. Defaults to 3.
   */
  minPressureStreak?: number
}

/**
 * StreakFlame — the L1 streak glyph. A number that quietly grows, with a small
 * flame whose color/animation reflects the streak's health. Warm, never punishing.
 */
export default function StreakFlame({
  streak,
  state = "active",
  size = 28,
  minPressureStreak = 3,
}: StreakFlameProps) {
  const isFrozen = state === "frozen-today"
  const isZero = state === "zero"
  const isAtRisk = state === "at-risk"

  // Don't pulse for very short streaks — no pressure on day one.
  const shouldPulse = isAtRisk && streak >= minPressureStreak

  let glyphColor = COLORS.streakAmber // active flame = amber
  if (isFrozen) glyphColor = COLORS.reputationTeal
  else if (isZero) glyphColor = COLORS.locked
  else if (isAtRisk) glyphColor = COLORS.xpOrange

  const numberColor = isZero ? COLORS.textFaint : COLORS.text

  return (
    <div className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT.sans }}>
      <style>{`
        @keyframes streakFlameFlicker {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.92; }
        }
        @keyframes streakAtRiskPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(232,87,26,0)); }
          50% { transform: scale(1.12); filter: drop-shadow(0 0 6px rgba(232,87,26,0.65)); }
        }
      `}</style>

      <span
        aria-hidden="true"
        className="inline-flex"
        style={{
          color: glyphColor,
          animation: shouldPulse
            ? "streakAtRiskPulse 1.4s ease-in-out infinite"
            : !isZero && !isFrozen
              ? "streakFlameFlicker 2.6s ease-in-out infinite"
              : "none",
        }}
      >
        {isFrozen ? (
          <Snowflake size={size} strokeWidth={1.75} />
        ) : (
          <Flame
            size={size}
            strokeWidth={1.75}
            fill={isZero ? "none" : "currentColor"}
            fillOpacity={isZero ? 0 : 0.18}
          />
        )}
      </span>

      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: size * 0.66,
          fontWeight: 600,
          lineHeight: 1,
          color: numberColor,
          letterSpacing: "-0.02em",
        }}
      >
        {streak}
      </span>

      <span className="sr-only">
        {isZero
          ? "No active streak"
          : isFrozen
            ? `${streak} day streak, frozen today`
            : isAtRisk
              ? `${streak} day streak, at risk`
              : `${streak} day streak`}
      </span>
    </div>
  )
}
