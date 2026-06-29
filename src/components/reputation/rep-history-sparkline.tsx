import type { CSSProperties } from "react"
import { tokens, fontMono, fontSans } from "./tokens"

export interface RepHistorySparklineProps {
  /** Weekly reputation values; last entry is the current week. */
  points: number[]
}

export default function RepHistorySparkline({
  points,
}: RepHistorySparklineProps) {
  const w = 280
  const h = 56
  const padX = 6
  const padY = 8

  const data = points.length ? points : [0]
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = (w - padX * 2) / Math.max(data.length - 1, 1)

  const coords = data.map((v, i) => {
    const x = padX + i * stepX
    const y = padY + (1 - (v - min) / range) * (h - padY * 2)
    return { x, y }
  })

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ")

  const area = `${line} L ${coords[coords.length - 1].x.toFixed(2)} ${
    h - padY
  } L ${coords[0].x.toFixed(2)} ${h - padY} Z`

  // Exact polyline length so the CSS draw finishes precisely.
  let len = 0
  for (let i = 1; i < coords.length; i++) {
    len += Math.hypot(coords[i].x - coords[i - 1].x, coords[i].y - coords[i - 1].y)
  }

  const last = coords[coords.length - 1]
  const current = data[data.length - 1]

  const drawStyle = {
    "--rep-spark-len": `${len}`,
    strokeDasharray: len,
    strokeDashoffset: 0,
    animation: "rep-spark-draw 1.2s ease-out",
  } as CSSProperties

  return (
    <section
      style={{
        width: "100%",
        maxWidth: 420,
        padding: 20,
        borderRadius: tokens.radiusPanel,
        border: tokens.borderStrong,
        background: tokens.shell,
        ...tokens.glass,
        fontFamily: fontSans,
        color: tokens.text,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
          Reputation · 12 weeks
        </h3>
        <span
          style={{
            fontFamily: fontMono,
            fontSize: 16,
            fontWeight: 700,
            color: tokens.teal,
          }}
        >
          {current}
        </span>
      </div>

      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Reputation over the last ${data.length} weeks, currently ${current}`}
      >
        <defs>
          <linearGradient id="rep-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tokens.teal} stopOpacity="0.22" />
            <stop offset="100%" stopColor={tokens.teal} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill="url(#rep-spark-fill)" stroke="none" />
        <path
          d={line}
          fill="none"
          stroke={tokens.teal}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={drawStyle}
        />

        {/* current-week dot */}
        <circle cx={last.x} cy={last.y} r={5.5} fill={tokens.teal} fillOpacity={0.2} />
        <circle
          cx={last.x}
          cy={last.y}
          r={3}
          fill={tokens.teal}
          stroke="#25252F"
          strokeWidth={1.5}
        />
      </svg>
    </section>
  )
}
