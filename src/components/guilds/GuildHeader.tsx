import { Zap } from "lucide-react"
import { tokens } from "./tokens"
import type { Guild, GuildMember } from "./types"

interface GuildHeaderProps {
  guild: Guild
  members: GuildMember[]
  goal: {
    /** Shared XP accumulated this week */
    current: number
    /** Weekly shared XP target */
    target: number
    cadence?: string
  }
}

export default function GuildHeader({ guild, members, goal }: GuildHeaderProps) {
  const Emblem = guild.emblem.icon
  const pct = Math.round(
    Math.min(Math.max(goal.current / goal.target, 0), 1) * 100,
  )
  const shown = members.slice(0, 8)
  const overflow = guild.memberCount - shown.length

  return (
    <header
      className="flex flex-col gap-5 p-5"
      style={{
        background: tokens.shell,
        ...tokens.glass,
        border: tokens.borderStrong,
        borderRadius: tokens.radiusPanel,
        fontFamily: tokens.fontSans,
        color: tokens.text,
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 64,
            height: 64,
            borderRadius: tokens.radiusPanel,
            background: `${guild.emblem.color}1F`,
            border: `0.5px solid ${guild.emblem.color}66`,
          }}
        >
          <Emblem size={32} color={guild.emblem.color} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.2 }}>
            {guild.name}
          </h1>
          <p
            className="mt-1"
            style={{ fontSize: 14, color: tokens.textMuted, maxWidth: "60ch" }}
          >
            {guild.purpose}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center">
              {shown.map((m, i) => (
                <Avatar key={m.id} member={m} index={i} />
              ))}
              {overflow > 0 && (
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 30,
                    height: 30,
                    marginLeft: -8,
                    borderRadius: "50%",
                    background: tokens.input,
                    border: "1.5px solid #25252F",
                    color: tokens.textMuted,
                    fontFamily: tokens.fontMono,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  +{overflow}
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: tokens.fontMono,
                fontSize: 12,
                color: tokens.textFaint,
              }}
            >
              {guild.memberCount}/{guild.capacity} members
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-1.5"
            style={{ fontSize: 13, color: tokens.textMuted }}
          >
            <Zap size={14} color={tokens.xp} fill={tokens.xp} />
            Weekly shared XP goal
          </span>
          <span style={{ fontFamily: tokens.fontMono, fontSize: 13 }}>
            <span style={{ color: tokens.xp, fontWeight: 600 }}>
              {goal.current.toLocaleString()}
            </span>
            <span style={{ color: tokens.textFaint }}>
              {" / "}
              {goal.target.toLocaleString()}
            </span>
            <span style={{ color: tokens.textFaint }}>
              {" "}
              guild XP {goal.cadence ?? "this week"}
            </span>
          </span>
        </div>
        <div
          style={{
            height: 10,
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
    </header>
  )
}

function Avatar({ member, index }: { member: GuildMember; index: number }) {
  const initials = member.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{
        width: 30,
        height: 30,
        marginLeft: index === 0 ? 0 : -8,
        borderRadius: "50%",
        background: tokens.input,
        border: "1.5px solid #25252F",
        color: tokens.text,
        fontFamily: tokens.fontSans,
        fontSize: 11,
        fontWeight: 600,
        zIndex: 8 - index,
      }}
      title={member.name}
    >
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.avatarUrl || "/placeholder.svg"}
          alt={member.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
