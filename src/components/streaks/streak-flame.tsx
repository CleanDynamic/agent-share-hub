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

  let glyphColor: string = COLORS.streakAmber // active flame = amber
  if (isFrozen) glyphColor = COLORS.reputationTeal
  else if (isZero) glyphColor = COLORS.locked
  else if (isAtRisk) glyphColor = COLORS.xpOrange

  const numberColor = isZero ? COLORS.textFaint : COLORS.text

  return (
    <div className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT.sans }}>

      <span
        aria-hidden="true"
        className="inline-flex"
        style={{
          color: glyphColor,
          /* BG-P32: at-risk is carried by `glyphColor` and by the copy
             beside it. A 1.4s throb on a streak the reader cannot act on in
             the moment is the audit's pulsing indicator, and it sat in the
             persistent chrome where it never stopped. */
          animation: "none",
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
