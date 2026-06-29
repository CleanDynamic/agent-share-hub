import type { CSSProperties } from "react"
import { tokens, fontMono, fontSans } from "./tokens"

export interface RepPart {
  /** Contribution name, e.g. "Saves". */
  label: string
  /** Share of total reputation, in percent (parts should sum to ~100). */
  share: number
}

export interface RepBreakdownPanelProps {
  parts: RepPart[]
}

export default function RepBreakdownPanel({ parts }: RepBreakdownPanelProps) {
  const total = parts.reduce((sum, p) => sum + p.share, 0) || 1
  const shades = tokens.tealShades

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
      <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600 }}>
        What builds your reputation
      </h3>

      {/* Stacked bar */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 14,
          borderRadius: tokens.radiusPill,
          overflow: "hidden",
          border: tokens.borderSoft,
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {parts.map((p, i) => {
          const pct = (p.share / total) * 100
          const segStyle = {
            width: `${pct}%`,
            background: shades[i % shades.length],
            transformOrigin: "left center",
            animation: `rep-bar-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${
              i * 0.08
            }s both`,
          } as CSSProperties
          return <span key={p.label} style={segStyle} aria-hidden="true" />
        })}
      </div>

      {/* Legend */}
      <ul
        style={{
          listStyle: "none",
          margin: "16px 0 0",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {parts.map((p, i) => (
          <li
            key={p.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                flexShrink: 0,
                background: shades[i % shades.length],
              }}
            />
            <span style={{ flex: 1, color: tokens.text }}>{p.label}</span>
            <span
              style={{
                fontFamily: fontMono,
                fontSize: 13,
                fontWeight: 700,
                color: tokens.teal,
              }}
            >
              {Math.round((p.share / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>

      <p
        style={{
          margin: "16px 0 0",
          fontSize: 11,
          lineHeight: 1.5,
          color: tokens.textFaint,
        }}
      >
        Recalculated weekly from your last 90 days.
      </p>
    </section>
  )
}
