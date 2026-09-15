import { useEffect, useState } from "react"
import { tokens } from "./tokens"
import { feedback } from "@/lib/theme/motion";

export interface XpBarProps {
  level: number
  /** XP accumulated within the current level */
  xpInLevel: number
  /** XP required to reach the next level */
  xpForNext: number
}

const fmt = (n: number) => n.toLocaleString("en-US")

/**
 * Horizontal level-progress bar for the dashboard, with a moving sheen and
 * a centred XP overlay revealed on hover.
 */
export default function XpBar({ level, xpInLevel, xpForNext }: XpBarProps) {
  const [hover, setHover] = useState(false)
  const [fill, setFill] = useState(0)
  const pct = xpForNext > 0 ? Math.max(0, Math.min(100, (xpInLevel / xpForNext) * 100)) : 0

  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <div
      style={{ fontFamily: tokens.fontSans, width: "100%" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <style>{`
        @keyframes xpbar-sheen {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <span style={{ color: tokens.text }}>{`Level ${level}`}</span>
        <span style={{ color: tokens.textMuted }}>{`Level ${level + 1}`}</span>
      </div>

      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: tokens.radiusPill,
          background: "var(--recess)",
          overflow: "hidden",
        }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${fmt(xpInLevel)} of ${fmt(xpForNext)} XP`}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${fill}%`,
            background: tokens.orangeGradient,
            borderRadius: tokens.radiusPill,
            transition: "none",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "40%",
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, var(--chrome-hi) 45%, transparent), transparent)",
              animation: "xpbar-sheen 2.4s ease-in-out infinite",
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: tokens.fontMono,
            fontSize: 11,
            color: "var(--on-action)",
            textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            opacity: hover ? 1 : 0,
            transition: feedback("opacity"),
            pointerEvents: "none",
          }}
        >
          {`${fmt(xpInLevel)} / ${fmt(xpForNext)} XP`}
        </div>
      </div>
    </div>
  )
}
