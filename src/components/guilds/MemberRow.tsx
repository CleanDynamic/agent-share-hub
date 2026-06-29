import { Crown, Zap } from "lucide-react"
import { tokens, trackColors } from "./tokens"
import type { GuildMember } from "./types"
import LevelRingMini from "./LevelRingMini"

interface MemberRowProps {
  member: GuildMember
}

export default function MemberRow({ member }: MemberRowProps) {
  const trackColor = trackColors[member.track]
  const isFounder = member.role === "Founder"

  return (
    <div
      className="flex items-center gap-3 p-3"
      style={{
        background: tokens.card,
        border: tokens.border,
        borderRadius: tokens.radiusCard,
        fontFamily: tokens.fontSans,
        color: tokens.text,
      }}
    >
      <LevelRingMini
        level={member.level}
        name={member.name}
        avatarUrl={member.avatarUrl}
        color={tokens.xp}
        size={40}
        progress={0.55}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="truncate"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            {member.name}
          </span>
          {isFounder && (
            <span
              className="flex items-center gap-1 shrink-0"
              style={{
                padding: "1px 7px",
                borderRadius: tokens.radiusPill,
                background: `${tokens.amber}1F`,
                border: `0.5px solid ${tokens.amber}66`,
                color: tokens.amber,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              <Crown size={10} fill={tokens.amber} />
              Founder
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span
            className="inline-flex items-center shrink-0"
            style={{
              padding: "1px 8px",
              borderRadius: tokens.radiusPill,
              background: `${trackColor}1F`,
              border: `0.5px solid ${trackColor}66`,
              color: trackColor,
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            {member.track}
          </span>
          {!isFounder && (
            <span style={{ fontSize: 11, color: tokens.textFaint }}>
              Member
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0">
        <span
          className="flex items-center gap-1"
          style={{
            fontFamily: tokens.fontMono,
            fontSize: 14,
            fontWeight: 600,
            color: tokens.xp,
          }}
        >
          <Zap size={13} color={tokens.xp} fill={tokens.xp} />
          {member.weeklyXp.toLocaleString()}
        </span>
        <span style={{ fontSize: 10, color: tokens.textFaint }}>
          XP this week
        </span>
      </div>
    </div>
  )
}
