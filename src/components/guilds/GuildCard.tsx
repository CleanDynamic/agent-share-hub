import { Users, Check, Clock } from "lucide-react"
import { tokens } from "./tokens"
import type { Guild, MembershipState } from "./types"

interface GuildCardProps {
  guild: Guild
  membership: MembershipState
  /** Optional shared-goal progress, 0–1 */
  goalProgress?: number
  onJoin?: (guildId: string) => void
}

export default function GuildCard({
  guild,
  membership,
  goalProgress = 0,
  onJoin,
}: GuildCardProps) {
  const { emblem } = guild
  const Emblem = emblem.icon
  const pct = Math.round(Math.min(Math.max(goalProgress, 0), 1) * 100)
  const full = guild.memberCount >= guild.capacity

  return (
    <div
      className="flex flex-col gap-4 p-4"
      style={{
        background: tokens.card,
        border: tokens.border,
        borderRadius: tokens.radiusCard,
        fontFamily: tokens.fontSans,
        color: tokens.text,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 44,
            height: 44,
            borderRadius: tokens.radiusCard,
            background: `${emblem.color}1F`,
            border: `0.5px solid ${emblem.color}66`,
          }}
        >
          <Emblem size={22} color={emblem.color} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              className="truncate"
              style={{ fontSize: 15, fontWeight: 600 }}
            >
              {guild.name}
            </h3>
            <span
              className="flex items-center gap-1 shrink-0"
              style={{
                color: tokens.textMuted,
                fontFamily: tokens.fontMono,
                fontSize: 12,
              }}
            >
              <Users size={12} />
              {guild.memberCount}/{guild.capacity}
            </span>
          </div>
          <p
            className="mt-1 line-clamp-1"
            style={{ fontSize: 13, color: tokens.textMuted }}
          >
            {guild.purpose}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          className="flex items-center justify-between"
          style={{ fontSize: 11, color: tokens.textFaint }}
        >
          <span>Shared goal</span>
          <span style={{ fontFamily: tokens.fontMono, color: tokens.xp }}>
            {pct}%
          </span>
        </div>
        <div
          style={{
            height: 6,
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
      </div>

      <JoinButton
        membership={membership}
        full={full}
        onClick={() => onJoin?.(guild.id)}
      />
    </div>
  )
}

function JoinButton({
  membership,
  full,
  onClick,
}: {
  membership: MembershipState
  full: boolean
  onClick: () => void
}) {
  if (membership === "member") {
    return (
      <button
        type="button"
        disabled
        className="flex items-center justify-center gap-1.5 w-full"
        style={{
          height: 38,
          borderRadius: tokens.radiusPill,
          background: "transparent",
          border: `0.5px solid ${tokens.teal}66`,
          color: tokens.teal,
          fontFamily: tokens.fontSans,
          fontSize: 13,
          fontWeight: 600,
          cursor: "default",
        }}
      >
        <Check size={15} /> Joined
      </button>
    )
  }

  if (membership === "requested") {
    return (
      <button
        type="button"
        disabled
        className="flex items-center justify-center gap-1.5 w-full"
        style={{
          height: 38,
          borderRadius: tokens.radiusPill,
          background: tokens.input,
          border: tokens.border,
          color: tokens.textMuted,
          fontFamily: tokens.fontSans,
          fontSize: 13,
          fontWeight: 600,
          cursor: "default",
        }}
      >
        <Clock size={15} /> Requested
      </button>
    )
  }

  const requesting = full
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center w-full transition-opacity hover:opacity-90"
      style={{
        height: 38,
        borderRadius: tokens.radiusPill,
        background: requesting ? "transparent" : tokens.brandGradient,
        border: requesting ? tokens.borderStrong : "none",
        color: requesting ? tokens.text : "#fff",
        fontFamily: tokens.fontSans,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {requesting ? "Request to join" : "Join guild"}
    </button>
  )
}
