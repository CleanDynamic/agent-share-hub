import { tokens } from "./tokens"

export interface XpStatCardProps {
  label: string
  value: string | number
  /** Percent change vs previous period; positive = up (green), negative = down (red) */
  deltaPct: number
  /** Recent values (e.g. last 14 days) for the sparkline */
  sparkline: number[]
}

function Sparkline({ data }: { data: number[] }) {
  const w = 100
  const h = 40
  if (data.length < 2) return <svg width={w} height={h} aria-hidden="true" />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = w / (data.length - 1)
  const pts = data
    .map((v, i) => `${(i * step).toFixed(2)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(2)}`)
    .join(" ")

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={tokens.orange}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Dashboard stat card: label, big mono number, delta chip and a 40px sparkline. */
export default function XpStatCard({ label, value, deltaPct, sparkline }: XpStatCardProps) {
  const up = deltaPct >= 0
  const deltaColor = up ? tokens.green : tokens.red

  return (
    <div
      style={{
        fontFamily: tokens.fontSans,
        background: tokens.card,
        border: tokens.borderMid,
        borderRadius: tokens.radiusCard,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 180,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: tokens.textMuted,
        }}
      >
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: tokens.fontMono, fontSize: 26, fontWeight: 600, color: tokens.text, lineHeight: 1 }}>
            {typeof value === "number" ? value.toLocaleString("en-US") : value}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 11,
              fontWeight: 600,
              color: deltaColor,
            }}
          >
            {up ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
          </span>
        </div>
        <div style={{ width: 100, height: 40, flexShrink: 0 }}>
          <Sparkline data={sparkline} />
        </div>
      </div>
    </div>
  )
}
