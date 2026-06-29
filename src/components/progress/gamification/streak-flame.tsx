import { Flame } from "lucide-react"
import { colors, radius, glass, monoFont, withAlpha } from "./tokens"

export interface StreakFlameProps {
  /** Current consecutive-day streak. */
  days: number
  /** Best streak ever achieved. */
  bestDays: number
  /** Whether the streak is active today (drives the live glow). */
  activeToday?: boolean
}

export default function StreakFlame({
  days,
  bestDays,
  activeToday = true,
}: StreakFlameProps) {
  return (
    <section
      className="flex items-center gap-4 p-5"
      style={{
        background: colors.card,
        border: `0.5px solid ${colors.borderStrong}`,
        borderRadius: radius.card,
        ...glass,
      }}
    >
      <span
        className="flex size-14 shrink-0 items-center justify-center"
        style={{
          background: withAlpha(colors.amber, 0.16),
          border: `0.5px solid ${withAlpha(colors.amber, 0.4)}`,
          borderRadius: radius.card,
          boxShadow: activeToday
            ? `0 0 20px ${withAlpha(colors.amber, 0.45)}`
            : "none",
        }}
      >
        <Flame
          size={28}
          color={colors.amber}
          fill={activeToday ? colors.amber : "none"}
        />
      </span>

      <div className="flex flex-1 flex-col">
        <span
          className="text-xs uppercase tracking-wider"
          style={{ color: colors.textMuted }}
        >
          Current Streak
        </span>
        <span className="flex items-baseline gap-2">
          <span
            className="text-3xl font-bold leading-none"
            style={{ fontFamily: monoFont, color: colors.amber }}
          >
            {days}
          </span>
          <span className="text-sm" style={{ color: colors.textPrimary }}>
            day{days === 1 ? "" : "s"}
          </span>
        </span>
        <span className="mt-1 text-xs" style={{ color: colors.textFaint }}>
          Best:{" "}
          <span style={{ fontFamily: monoFont }}>{bestDays}</span> days
        </span>
      </div>

      {activeToday && (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium"
          style={{
            background: withAlpha(colors.green, 0.14),
            color: colors.green,
            borderRadius: radius.pill,
          }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: colors.green }}
          />
          Live
        </span>
      )}
    </section>
  )
}
