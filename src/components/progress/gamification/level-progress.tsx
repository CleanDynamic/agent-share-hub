import { Zap, ChevronUp } from "lucide-react"
import { colors, radius, glass, monoFont, withAlpha } from "./tokens"

export interface LevelProgressProps {
  level: number
  /** XP earned within the current level. */
  currentXp: number
  /** XP required to reach the next level. */
  nextLevelXp: number
  /** Optional title shown above the bar. */
  title?: string
}

export default function LevelProgress({
  level,
  currentXp,
  nextLevelXp,
  title = "Level Progress",
}: LevelProgressProps) {
  const pct = Math.max(0, Math.min(100, (currentXp / nextLevelXp) * 100))

  return (
    <section
      className="flex flex-col gap-4 p-5"
      style={{
        background: colors.card,
        border: `0.5px solid ${colors.borderStrong}`,
        borderRadius: radius.card,
        ...glass,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex size-11 items-center justify-center"
            style={{
              background: colors.brandGradient,
              borderRadius: radius.card,
              boxShadow: `0 6px 18px ${withAlpha(colors.brand, 0.35)}`,
            }}
          >
            <Zap size={20} color="#fff" fill="#fff" />
          </span>
          <div className="flex flex-col">
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: colors.textMuted }}
            >
              {title}
            </span>
            <span
              className="text-lg font-semibold"
              style={{ color: colors.textPrimary }}
            >
              Level {level}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span
            className="text-sm font-semibold"
            style={{ fontFamily: monoFont, color: colors.brand }}
          >
            {currentXp.toLocaleString()} / {nextLevelXp.toLocaleString()}
          </span>
          <span className="text-xs" style={{ color: colors.textFaint }}>
            XP to Level {level + 1}
          </span>
        </div>
      </div>

      {/* Track */}
      <div
        className="relative h-3 w-full overflow-hidden"
        style={{
          background: withAlpha("#000000", 0.25),
          borderRadius: radius.pill,
        }}
      >
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: colors.brandGradient,
            borderRadius: radius.pill,
            boxShadow: `0 0 12px ${withAlpha(colors.brand, 0.6)}`,
            transition: "width 600ms ease",
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: colors.green }}
        >
          <ChevronUp size={14} />
          {Math.round(pct)}% complete
        </span>
        <span
          className="text-xs"
          style={{ fontFamily: monoFont, color: colors.textFaint }}
        >
          {(nextLevelXp - currentXp).toLocaleString()} XP remaining
        </span>
      </div>
    </section>
  )
}
