import { User } from "lucide-react"
import { tokens, trackColor, type Track } from "./tokens"

export interface LevelRingMiniProps {
  level: number
  /** 0–1 progress toward the next level. */
  progress: number
  track: Track
  avatarUrl?: string
  name?: string
  size?: number
}

/**
 * Compact avatar wrapped in a track-coloured progress ring with a
 * level badge. Used inside leaderboard rows.
 */
export default function LevelRingMini({
  level,
  progress,
  track,
  avatarUrl,
  name,
  size = 36,
}: LevelRingMiniProps) {
  const color = trackColor[track]
  const clamped = Math.max(0, Math.min(1, progress))
  const ring = `conic-gradient(${color} ${clamped * 360}deg, rgba(255,255,255,0.10) 0deg)`
  const inner = size - 6

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: tokens.radiusPill,
          background: ring,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: tokens.radiusPill,
            overflow: "hidden",
            background: tokens.input,
            border: tokens.borderSoft,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl || "/placeholder.svg"}
              alt={name ? `${name} avatar` : "avatar"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <User size={inner * 0.5} color={tokens.textMuted} aria-hidden />
          )}
        </div>
      </div>

      <span
        style={{
          position: "absolute",
          bottom: -3,
          right: -3,
          minWidth: 16,
          height: 16,
          padding: "0 4px",
          borderRadius: tokens.radiusPill,
          background: color,
          color: "#1A1A22",
          fontFamily: tokens.fontMono,
          fontSize: 9,
          fontWeight: 700,
          lineHeight: "16px",
          textAlign: "center",
          border: "1.5px solid #25252F",
        }}
        aria-label={`Level ${level}`}
      >
        {level}
      </span>
    </div>
  )
}
