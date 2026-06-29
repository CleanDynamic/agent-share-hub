import { tokens } from "./tokens"

export interface RankDeltaChipProps {
  /** Rank change vs last week. Positive = climbed, negative = fell, 0 = no move. */
  delta: number
}

/**
 * Tiny ▲/▼ indicator showing rank movement vs last week.
 * Green for gains, red for losses. 10px footprint.
 */
export default function RankDeltaChip({ delta }: RankDeltaChipProps) {
  if (delta === 0) {
    return (
      <span
        style={{
          fontFamily: tokens.fontMono,
          fontSize: 10,
          fontWeight: 600,
          color: tokens.textFaint,
          letterSpacing: 0.2,
        }}
        aria-label="No change vs last week"
      >
        –
      </span>
    )
  }

  const up = delta > 0
  const color = up ? tokens.green : tokens.red

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        fontFamily: tokens.fontMono,
        fontSize: 10,
        fontWeight: 700,
        color,
        letterSpacing: 0.2,
      }}
      aria-label={`${up ? "Up" : "Down"} ${Math.abs(delta)} vs last week`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  )
}
