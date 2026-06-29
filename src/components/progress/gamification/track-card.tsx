import {
  Compass,
  Hammer,
  Library,
  GraduationCap,
  Lock,
  type LucideIcon,
} from "lucide-react"
import {
  colors,
  radius,
  glass,
  monoFont,
  tracks,
  withAlpha,
  type TrackName,
} from "./tokens"

const trackIcons: Record<TrackName, LucideIcon> = {
  Architect: Hammer,
  Curator: Library,
  Mentor: GraduationCap,
  Explorer: Compass,
}

export interface TrackCardProps {
  track: TrackName
  /** Current tier within the track. */
  tier: number
  /** XP earned in the current tier. */
  currentXp: number
  /** XP required for the next tier. */
  nextTierXp: number
  /** Locks the card and dims it; hides progress detail. */
  locked?: boolean
}

export default function TrackCard({
  track,
  tier,
  currentXp,
  nextTierXp,
  locked = false,
}: TrackCardProps) {
  const accent = tracks[track]
  const Icon = trackIcons[track]
  const pct = Math.max(0, Math.min(100, (currentXp / nextTierXp) * 100))

  return (
    <article
      className="flex flex-col gap-4 p-5"
      style={{
        background: colors.card,
        border: `0.5px solid ${
          locked ? colors.borderSoft : withAlpha(accent, 0.35)
        }`,
        borderRadius: radius.card,
        opacity: locked ? 0.7 : 1,
        ...glass,
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="flex size-11 items-center justify-center"
          style={{
            background: locked
              ? withAlpha("#ffffff", 0.06)
              : withAlpha(accent, 0.16),
            border: `0.5px solid ${
              locked ? colors.borderSoft : withAlpha(accent, 0.4)
            }`,
            borderRadius: radius.card,
          }}
        >
          <Icon size={20} color={locked ? colors.locked : accent} />
        </span>

        {locked ? (
          <Lock size={16} color={colors.locked} />
        ) : (
          <span
            className="px-2.5 py-0.5 text-xs font-medium"
            style={{
              background: withAlpha(accent, 0.14),
              color: accent,
              borderRadius: radius.pill,
            }}
          >
            Tier {tier}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span
          className="text-base font-semibold"
          style={{ color: locked ? colors.locked : colors.textPrimary }}
        >
          {track}
        </span>
        <span className="text-xs" style={{ color: colors.textMuted }}>
          {locked ? "Locked — reach Level 10 to unlock" : `${track} track`}
        </span>
      </div>

      {!locked && (
        <>
          <div
            className="relative h-2 w-full overflow-hidden"
            style={{
              background: withAlpha("#000000", 0.25),
              borderRadius: radius.pill,
            }}
          >
            <div
              className="h-full"
              style={{
                width: `${pct}%`,
                background: accent,
                borderRadius: radius.pill,
                boxShadow: `0 0 10px ${withAlpha(accent, 0.55)}`,
                transition: "width 600ms ease",
              }}
            />
          </div>
          <span
            className="text-xs"
            style={{ fontFamily: monoFont, color: colors.textFaint }}
          >
            {currentXp.toLocaleString()} / {nextTierXp.toLocaleString()} XP
          </span>
        </>
      )}
    </article>
  )
}
