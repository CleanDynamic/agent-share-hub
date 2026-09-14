import { useEffect, useState } from "react"

import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { progressFill, progressTrack } from "@/lib/theme/progress"
import { tokens } from "./tokens"

export interface XpBarProps {
  level: number
  /** XP accumulated within the current level */
  xpInLevel: number
  /** XP required to reach the next level */
  xpForNext: number
}

const fmt = (n: number) => n.toLocaleString("en-US")

/**
 * Horizontal level-progress bar for the dashboard, with a moving sheen and a
 * centred XP overlay revealed on hover.
 *
 * REPAINTED ONTO THE LADDER (BG-P28b). The fill was an orange gradient —
 * `--action`, the primary-action colour, spent on a quantity rather than an
 * action — and the same quantity the level ring beside it draws as an arc. One
 * idea takes one colour, so both are `--lit` now and they agree.
 *
 * THE HOVER OVERLAY WAS `#fff` WITH A BLACK TEXT-SHADOW, a pair chosen for a
 * dark room. It sits ON the amber fill, so it takes `--on-lit` — the measured
 * label for that fill in both rooms — and drops the shadow, which was only ever
 * propping up a colour that did not belong there.
 *
 * THE SHEEN keyframes moved to index.css (the delivery rules put keyframes
 * there), and the element carries [data-bg-animated] so BG-P07's
 * reduced-motion guard switches it off.
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
          borderRadius: r.chip,
          background: progressTrack().background,
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
            background: progressFill().background,
            borderRadius: r.chip,
            transition: "width 700ms cubic-bezier(0.16,1,0.3,1)",
            overflow: "hidden",
          }}
        >
          <div
            data-bg-animated=""
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "40%",
              background: `linear-gradient(90deg, transparent, ${t.glassHi}, transparent)`,
              animation: "bgXpBarSheen 2.4s ease-in-out infinite",
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
            fontVariantNumeric: "tabular-nums",
            fontSize: 11,
            color: t.onLit,
            opacity: hover ? 1 : 0,
            transition: "opacity 150ms ease-out",
            pointerEvents: "none",
          }}
        >
          {`${fmt(xpInLevel)} / ${fmt(xpForNext)} XP`}
        </div>
      </div>
    </div>
  )
}
