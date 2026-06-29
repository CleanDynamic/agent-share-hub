import type { CSSProperties } from "react"
import type { LucideIcon } from "lucide-react"
import { tokens } from "./tokens"

export interface ProfileStat {
  id: string
  label: string
  value: string | number
  icon?: LucideIcon
  /** Accent colour for the value + icon. */
  accent?: string
  /** Optional positive/live delta — rendered in green per colour language. */
  delta?: string
}

export interface ProfileStatsBarProps {
  /**
   * L1 passes Level / XP / Streak / Marks. L2/L3 just append more items
   * (Reputation, full badge counts) — the bar scales with the array.
   */
  stats: ProfileStat[]
  style?: CSSProperties
}

/**
 * Horizontal stat ledger. Numbers use JetBrains Mono. Designed to grow:
 * L1 ships 4 stats, higher levels pass a longer array.
 */
export default function ProfileStatsBar({ stats, style }: ProfileStatsBarProps) {
  return (
    <div
      className="grid gap-px overflow-hidden"
      style={{
        gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
        borderRadius: tokens.radius.panel,
        background: "rgba(255,255,255,0.06)",
        border: tokens.border.strong,
        ...style,
      }}
    >
      {stats.map((stat) => {
        const Icon = stat.icon
        const accent = stat.accent ?? tokens.text.primary
        return (
          <div
            key={stat.id}
            className="flex flex-col gap-1.5"
            style={{ padding: "14px 16px", background: tokens.surface.card }}
          >
            <span className="inline-flex items-center gap-1.5">
              {Icon && <Icon size={13} color={accent} strokeWidth={2.25} aria-hidden />}
              <span
                style={{
                  fontFamily: tokens.font.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color: tokens.text.muted,
                }}
              >
                {stat.label}
              </span>
            </span>
            <span className="inline-flex items-baseline gap-1.5">
              <span
                style={{
                  fontFamily: tokens.font.mono,
                  fontSize: 20,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: accent,
                }}
              >
                {stat.value}
              </span>
              {stat.delta && (
                <span
                  style={{
                    fontFamily: tokens.font.mono,
                    fontSize: 12,
                    fontWeight: 600,
                    color: tokens.accent.green,
                  }}
                >
                  {stat.delta}
                </span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
