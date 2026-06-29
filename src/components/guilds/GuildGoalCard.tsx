import { Target, Gift, Zap, Users } from "lucide-react"
import { tokens } from "./tokens"
import type { GuildGoal } from "./types"

interface GuildGoalCardProps {
  goal: GuildGoal
}

export default function GuildGoalCard({ goal }: GuildGoalCardProps) {
  const ratio = Math.min(Math.max(goal.current / goal.target, 0), 1)
  const pct = Math.round(ratio * 100)
  const perMemberAvg =
    goal.contributors > 0 ? Math.round(goal.current / goal.contributors) : 0
  // Where the per-member-average line sits relative to the collective target.
  const avgTargetShare =
    goal.contributors > 0 ? goal.target / goal.contributors : goal.target
  const avgMarker = Math.min(
    Math.max(perMemberAvg / avgTargetShare, 0),
    1,
  )

  return (
    <div
      className="flex flex-col gap-4 p-5"
      style={{
        background: tokens.card,
        border: tokens.border,
        borderRadius: tokens.radiusPanel,
        fontFamily: tokens.fontSans,
        color: tokens.text,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: tokens.radiusCard,
            background: `${tokens.xp}1F`,
            border: `0.5px solid ${tokens.xp}66`,
          }}
        >
          <Target size={20} color={tokens.xp} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{goal.title}</h3>
          <p style={{ fontSize: 12, color: tokens.textFaint, marginTop: 2 }}>
            Collective goal {goal.cadence ?? "this week"}
          </p>
        </div>
        <span
          style={{
            fontFamily: tokens.fontMono,
            fontSize: 20,
            fontWeight: 700,
            color: tokens.xp,
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Collective bar with per-member-average marker */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <div
            style={{
              height: 14,
              borderRadius: tokens.radiusPill,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: tokens.radiusPill,
                background: tokens.brandGradient,
              }}
            />
          </div>
          {/* per-member-average line */}
          <div
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${avgMarker * 100}%`, transform: "translateX(-50%)" }}
            title="Per-member average"
          >
            <div
              style={{
                width: 2,
                height: 14,
                background: tokens.teal,
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-1.5"
            style={{ fontFamily: tokens.fontMono, fontSize: 13 }}
          >
            <Zap size={13} color={tokens.xp} fill={tokens.xp} />
            <span style={{ color: tokens.xp, fontWeight: 600 }}>
              {goal.current.toLocaleString()}
            </span>
            <span style={{ color: tokens.textFaint }}>
              / {goal.target.toLocaleString()} XP
            </span>
          </span>
          <span
            className="flex items-center gap-1.5"
            style={{ fontSize: 12, color: tokens.teal }}
          >
            <Users size={12} />
            <span style={{ fontFamily: tokens.fontMono }}>
              {perMemberAvg.toLocaleString()}
            </span>
            avg / member
          </span>
        </div>
      </div>

      {/* Reward preview */}
      <div
        className="flex items-center gap-3 p-3"
        style={{
          background: tokens.input,
          border: tokens.border,
          borderRadius: tokens.radiusCard,
        }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 38,
            height: 38,
            borderRadius: tokens.radiusCard,
            background: `${tokens.purple}1F`,
            border: `0.5px solid ${tokens.purple}66`,
          }}
        >
          <Gift size={18} color={tokens.purple} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11, color: tokens.textFaint }}>
              Reward
            </span>
            <span
              style={{
                padding: "1px 6px",
                borderRadius: tokens.radiusPill,
                background: `${tokens.purple}1F`,
                color: tokens.purple,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              Guild badge
            </span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
            {goal.reward.name}
          </p>
          <p style={{ fontSize: 11, color: tokens.textMuted }}>
            {goal.reward.description}
          </p>
        </div>
      </div>
    </div>
  )
}
