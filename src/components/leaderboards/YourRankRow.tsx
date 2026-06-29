import { tokens } from "./tokens"

export interface YourRankRowProps {
  rank: number
  value: number
  /** Label for the metric. Defaults to "XP this week". */
  unitLabel?: string
}

/**
 * Sticky bottom row pinning the current user's standing — orange-tinted,
 * always visible even when the player is off the visible list.
 */
export default function YourRankRow({
  rank,
  value,
  unitLabel = "XP this week",
}: YourRankRowProps) {
  return (
    <div
      style={{
        ...tokens.glass,
        position: "sticky",
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 16px",
        borderRadius: tokens.radiusCard,
        background: `${tokens.brand}26`,
        border: `0.5px solid ${tokens.brand}73`,
        fontFamily: tokens.fontSans,
        color: tokens.textPrimary,
      }}
      aria-label={`Your rank ${rank}, ${value} ${unitLabel}`}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>
        Your rank{" "}
        <span
          style={{
            fontFamily: tokens.fontMono,
            fontWeight: 700,
            color: tokens.brand,
          }}
        >
          #{rank}
        </span>
      </span>

      <span style={{ fontSize: 13, color: tokens.textMuted }}>
        <span
          style={{
            fontFamily: tokens.fontMono,
            fontWeight: 700,
            color: tokens.textPrimary,
          }}
        >
          {value.toLocaleString()}
        </span>{" "}
        {unitLabel}
      </span>
    </div>
  )
}
