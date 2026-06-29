import type { CSSProperties, ReactNode } from "react"
import { tokens } from "./tokens"

export interface LevelRingProps {
  level: number
  progressPct: number
  size?: number
  color?: string
  style?: CSSProperties
  /** When provided, replaces the centre level number with custom content (used to wrap avatars). */
  children?: ReactNode
}

export default function LevelRing({
  level,
  progressPct,
  size = 80,
  color = tokens.xp,
  style,
  children,
}: LevelRingProps) {
  const stroke = Math.max(2, Math.round(size * 0.075))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, progressPct))
  const dash = (clamped / 100) * circumference
  const innerInset = stroke + 1

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size, ...style }}
      role="img"
      aria-label={`Level ${level}, ${Math.round(clamped)}% to next level`}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
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
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      {children ? (
        <div
          className="absolute rounded-full overflow-hidden"
          style={{ inset: innerInset }}
        >
          {children}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: size * 0.34,
              fontWeight: 700,
              lineHeight: 1,
              color: tokens.text.primary,
            }}
          >
            {level}
          </span>
          <span
            style={{
              fontFamily: tokens.font.sans,
              fontSize: size * 0.115,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: tokens.text.muted,
              marginTop: 2,
            }}
          >
            Lvl
          </span>
        </div>
      )}
    </div>
  )
}
