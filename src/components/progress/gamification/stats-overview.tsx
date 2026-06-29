import {
  Trophy,
  Target,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { colors, radius, glass, monoFont, withAlpha } from "./tokens"

interface Stat {
  icon: LucideIcon
  label: string
  value: string
  accent: string
  /** Optional positive delta string, e.g. "+3 today". */
  delta?: string
}

export interface StatsOverviewProps {
  totalXp: number
  achievements: number
  rank: number
  followers: number
}

export default function StatsOverview({
  totalXp,
  achievements,
  rank,
  followers,
}: StatsOverviewProps) {
  const stats: Stat[] = [
    {
      icon: Sparkles,
      label: "Total XP",
      value: totalXp.toLocaleString(),
      accent: colors.brand,
      delta: "+1,240 today",
    },
    {
      icon: Trophy,
      label: "Achievements",
      value: achievements.toLocaleString(),
      accent: colors.amber,
    },
    {
      icon: Target,
      label: "Global Rank",
      value: `#${rank.toLocaleString()}`,
      accent: colors.teal,
      delta: "+12 this week",
    },
    {
      icon: Users,
      label: "Followers",
      value: followers.toLocaleString(),
      accent: colors.purple,
    },
  ]

  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="flex flex-col gap-3 p-4"
            style={{
              background: colors.card,
              border: `0.5px solid ${colors.borderStrong}`,
              borderRadius: radius.card,
              ...glass,
            }}
          >
            <span
              className="flex size-9 items-center justify-center"
              style={{
                background: withAlpha(stat.accent, 0.16),
                border: `0.5px solid ${withAlpha(stat.accent, 0.4)}`,
                borderRadius: radius.pill,
              }}
            >
              <Icon size={16} color={stat.accent} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span
                className="text-xl font-bold leading-none"
                style={{ fontFamily: monoFont, color: colors.textPrimary }}
              >
                {stat.value}
              </span>
              <span className="text-xs" style={{ color: colors.textMuted }}>
                {stat.label}
              </span>
            </div>
            {stat.delta && (
              <span
                className="text-xs font-medium"
                style={{ color: colors.green }}
              >
                {stat.delta}
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}
