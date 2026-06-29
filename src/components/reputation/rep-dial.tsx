import type { CSSProperties } from "react"
import { tokens, fontMono, fontSans } from "./tokens"

export interface RepDialProps {
  /** Reputation score, 0–100. */
  score: number
}

/**
 * RepDial — semicircular 0–100 gauge with a teal arc.
 * Animated sweep on mount via pure CSS keyframes (no client JS).
 */
export default function RepDial({ score }: RepDialProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const fraction = clamped / 100

  // Geometry for the semicircle (top half).
  const w = 200
  const r = 80
  const cx = w / 2
  const cy = 100
  const stroke = 12
  const arcLen = Math.PI * r
  const offset = arcLen * (1 - fraction)

  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  const arcStyle = {
    "--rep-arc": `${arcLen}`,
    "--rep-offset": `${offset}`,
    strokeDashoffset: offset,
    animation: "rep-dial-sweep 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
  } as CSSProperties

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: fontSans,
      }}
    >
      <svg
        width={w}
        height={cy + stroke / 2}
        viewBox={`0 0 ${w} ${cy + stroke / 2}`}
        role="img"
        aria-label={`Reputation ${clamped} out of 100`}
      >
        <path
          d={path}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={path}
          fill="none"
          stroke={tokens.teal}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={arcLen}
          style={arcStyle}
        />
      </svg>

      <div
        style={{
          marginTop: -38,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <span
          style={{
            fontFamily: fontMono,
            fontSize: 22,
            fontWeight: 700,
            color: tokens.teal,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {clamped}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: tokens.textMuted,
          }}
        >
          Reputation
        </span>
      </div>
    </div>
  )
}
