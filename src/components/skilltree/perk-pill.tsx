import { trackMeta, tokens, type TrackId } from "./tokens"

export interface PerkPillProps {
  track: TrackId
  tier: number
}

export default function PerkPill({ track, tier }: PerkPillProps) {
  const color = trackMeta[track].color
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 4,
        padding: "2px 7px",
        borderRadius: tokens.radiusPill,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `0.5px solid color-mix(in srgb, ${color} 45%, transparent)`,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {trackMeta[track].name} T{tier}
    </span>
  )
}
