import { useEffect, useState } from "react"
import { tokens } from "./tokens"

export interface LevelRingProps {
  avatarUrl?: string
  initials: string
  level: number
  /** 0–100 progress toward the next level */
  progressPct: number
  /** Outer diameter in px */
  size?: 32 | 48 | 80
}

/**
 * Avatar wrapper with a circular XP progress ring and a docked level chip.
 * The ring fill animates a sweep on mount (600ms ease-out).
 */
export default function LevelRing({
  avatarUrl,
  initials,
  level,
  progressPct,
  size = 48,
}: LevelRingProps) {
  const [sweep, setSweep] = useState(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setSweep(Math.max(0, Math.min(100, progressPct))))
    return () => cancelAnimationFrame(id)
  }, [progressPct])

  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (sweep / 100) * circumference

  // Chip + inner avatar scale with size
  const chipFont = size >= 80 ? 11 : 10
  const chipPad = size >= 80 ? "2px 7px" : "1px 5px"
  const initialsFont = size >= 80 ? 24 : size >= 48 ? 15 : 11
  const inset = stroke + 2

  return (
    <div
      style={{ width: size, height: size, position: "relative", flexShrink: 0 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)", display: "block" }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tokens.orange}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>

      {/* Avatar */}
      <div
        style={{
          position: "absolute",
          inset,
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: tokens.input,
          border: tokens.borderSoft,
          color: tokens.text,
          fontFamily: tokens.fontSans,
          fontWeight: 600,
          fontSize: initialsFont,
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl || "/placeholder.svg"}
            alt=""
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {/* Level chip */}
      <div
        style={{
          position: "absolute",
          bottom: -2,
          right: -2,
          background: tokens.orangeGradient,
          color: "#fff",
          fontFamily: tokens.fontSans,
          fontWeight: 700,
          fontSize: chipFont,
          lineHeight: 1,
          padding: chipPad,
          borderRadius: tokens.radiusPill,
          border: "1.5px solid #25252F",
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
        }}
        aria-label={`Level ${level}`}
      >
        {level}
      </div>
    </div>
  )
}
