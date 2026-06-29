import type { ReactNode } from "react"
import { BadgeCheck } from "lucide-react"
import { tokens, trackColors, type TrackName } from "./tokens"
import LevelRing from "./LevelRing"
import CreatorMarkChip, { type CreatorMark } from "./CreatorMarkChip"

export interface ProfileUser {
  name: string
  handle?: string
  avatarUrl?: string
  verified?: boolean
}

export interface ProfileLevelHeaderProps {
  user: ProfileUser
  level: number
  progressPct: number
  /** Up to 3 are rendered (Session A). */
  creatorMarks: CreatorMark[]
  /** Post-reveal track name; when present the ribbon REPLACES the marks row. */
  track?: TrackName
  /** Tier number paired with the track ribbon. */
  tier?: number
  /** Optional slot rendered beside the handle (e.g. FounderMark crown chip). */
  handleAccessory?: ReactNode
}

/**
 * Revised R1 profile header. LevelRing (80px) + name. Directly under the name:
 * a CreatorMarks row (≤3 chips) OR — once a track exists post-reveal — the
 * track ribbon ("THE ARCHITECT · TIER 2") shown INSTEAD of the marks.
 */
export default function ProfileLevelHeader({
  user,
  level,
  progressPct,
  creatorMarks,
  track,
  tier,
  handleAccessory,
}: ProfileLevelHeaderProps) {
  const trackColor = track ? trackColors[track] : tokens.xp
  const marks = creatorMarks.slice(0, 3)

  return (
    <header
      className="flex items-center gap-4"
      style={{
        padding: 20,
        borderRadius: tokens.radius.panel,
        background: tokens.surface.shell,
        border: tokens.border.strong,
        ...tokens.glass,
      }}
    >
      <LevelRing level={level} progressPct={progressPct} size={80} color={trackColor} />

      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h1
            className="truncate"
            style={{
              fontFamily: tokens.font.sans,
              fontSize: 22,
              fontWeight: 700,
              color: tokens.text.primary,
              margin: 0,
            }}
          >
            {user.name}
          </h1>
          {user.verified && (
            <BadgeCheck size={18} color={tokens.accent.teal} strokeWidth={2.25} aria-label="Verified" />
          )}
          {user.handle && (
            <span style={{ fontFamily: tokens.font.sans, fontSize: 14, color: tokens.text.muted }}>
              {user.handle}
            </span>
          )}
          {handleAccessory}
        </div>

        {track ? (
          <TrackRibbon track={track} tier={tier} color={trackColor} />
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {marks.map((mark) => (
              <CreatorMarkChip key={mark.id} mark={mark} />
            ))}
          </div>
        )}
      </div>
    </header>
  )
}

function TrackRibbon({ track, tier, color }: { track: TrackName; tier?: number; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 self-start"
      style={{
        height: 26,
        padding: "0 14px",
        borderRadius: tokens.radius.pill,
        background: `linear-gradient(135deg, ${color}33 0%, ${color}14 100%)`,
        border: `0.5px solid ${color}66`,
        fontFamily: tokens.font.sans,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: color,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 100, background: color }} aria-hidden />
      {`The ${track}`}
      {tier != null && (
        <span style={{ color: tokens.text.secondary, fontWeight: 600 }}>· Tier {tier}</span>
      )}
    </span>
  )
}
