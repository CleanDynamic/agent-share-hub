import { tokens } from "./tokens"

export interface DiminishingMeterProps {
  /** e.g. "like", "download", "comment" */
  actionType: string
  /** Current XP multiplier, 0–1 (1 = full rate) */
  currentMultiplier: number
}

const SEGMENTS = 4

/**
 * Tiny inline fairness widget. Renders a 4-segment pill indicating the current
 * diminishing-returns bracket for an action type. Intended to live quietly in
 * the XpLedger header behind an info icon — not a foreground dashboard element.
 */
export default function DiminishingMeter({
  actionType,
  currentMultiplier,
}: DiminishingMeterProps) {
  const pct = Math.max(0, Math.min(1, currentMultiplier))
  // How many of the 4 segments are "active" at the current rate.
  const activeSegments = Math.ceil(pct * SEGMENTS)

  const color = pct > 0.66 ? tokens.green : pct > 0.33 ? tokens.amber : tokens.orange

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: tokens.fontSans,
        fontSize: 11,
        color: tokens.textMuted,
        whiteSpace: "nowrap",
      }}
    >
      <span>
        {`Today's ${actionType} XP: `}
        <span style={{ color, fontWeight: 600 }}>{`${Math.round(pct * 100)}% rate`}</span>
      </span>
      <span style={{ display: "inline-flex", gap: 3 }} aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            style={{
              width: 14,
              height: 5,
              borderRadius: tokens.radiusPill,
              background: i < activeSegments ? color : "rgba(255,255,255,0.12)",
              transition: "background 200ms ease-out",
            }}
          />
        ))}
      </span>
    </div>
  )
}
