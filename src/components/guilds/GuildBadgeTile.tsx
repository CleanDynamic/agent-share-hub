import { Lock } from "lucide-react"
import { tokens } from "./tokens"
import type { GuildBadge, GuildEmblem } from "./types"

interface GuildBadgeTileProps {
  badge: GuildBadge
  /** Guild emblem embedded into the badge medallion */
  emblem: GuildEmblem
}

/**
 * Session-D-compatible badge tile variant: a circular medallion with the
 * guild emblem embedded, name + description below, locked state dimmed.
 */
export default function GuildBadgeTile({ badge, emblem }: GuildBadgeTileProps) {
  const Emblem = emblem.icon
  const earned = badge.earned
  const accent = badge.tint

  return (
    <div
      className="flex flex-col items-center gap-3 p-4 text-center"
      style={{
        background: tokens.card,
        border: earned ? `0.5px solid ${accent}55` : tokens.border,
        borderRadius: tokens.radiusCard,
        fontFamily: tokens.fontSans,
        color: tokens.text,
        opacity: earned ? 1 : 0.78,
      }}
    >
      <div className="relative" style={{ width: 76, height: 76 }}>
        {/* Outer medallion ring */}
        <div
          className="flex items-center justify-center"
          style={{
            width: 76,
            height: 76,
            borderRadius: "50%",
            background: earned
              ? `radial-gradient(circle at 35% 25%, ${accent}40, ${accent}14)`
              : "rgba(255,255,255,0.05)",
            border: earned
              ? `1px solid ${accent}80`
              : `1px solid ${tokens.locked}`,
            boxShadow: earned ? `0 0 18px ${accent}33` : "none",
          }}
        >
          {/* Inner emblem disc */}
          <div
            className="flex items-center justify-center"
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: earned ? `${emblem.color}24` : "rgba(255,255,255,0.04)",
              border: earned
                ? `0.5px solid ${emblem.color}80`
                : `0.5px solid ${tokens.locked}`,
            }}
          >
            <Emblem
              size={24}
              color={earned ? emblem.color : tokens.locked}
              strokeWidth={2}
            />
          </div>
        </div>

        {!earned && (
          <span
            className="absolute flex items-center justify-center"
            style={{
              right: -2,
              bottom: -2,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#25252F",
              border: tokens.border,
            }}
          >
            <Lock size={12} color={tokens.locked} />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: earned ? tokens.text : tokens.textMuted,
          }}
        >
          {badge.name}
        </span>
        <span style={{ fontSize: 12, color: tokens.textFaint, maxWidth: "22ch" }}>
          {badge.description}
        </span>
      </div>

      <span
        style={{
          padding: "2px 10px",
          borderRadius: tokens.radiusPill,
          background: earned ? `${accent}1F` : "rgba(255,255,255,0.06)",
          color: earned ? accent : tokens.locked,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        {earned ? "Earned" : "Locked"}
      </span>
    </div>
  )
}
