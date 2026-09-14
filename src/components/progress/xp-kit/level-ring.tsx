import { useEffect, useState } from "react"

import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { progressFill, progressTrack, tierFill } from "@/lib/theme/progress"
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
 *
 * REPAINTED ONTO THE LADDER (BG-P28b). The arc was `tokens.orange`, which is
 * `--action` — "the primary thing to do" — spent on a reading of how far along
 * you are, which is not an action. An arc IS a light, so it is `--lit`, and the
 * groove behind it is `--line` rather than the white-alpha that vanished on
 * Exhibition.
 *
 * THE LEVEL CHIP WAS THE ILLEGAL PART: an orange gradient with `#fff` on it,
 * ringed by a 1.5px border of `#25252F` — the OLD PAGE GROUND, hard-coded, so
 * on Exhibition the chip wore a dark ring that matched nothing on the page. It
 * is the ladder's top rung now (an amber fill with `--on-lit` on it) and the
 * ring is `--bg`, which is what that border was always trying to be: the page
 * showing through, so the chip reads as docked rather than stuck on.
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
          stroke={progressTrack().background as string}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressFill().background as string}
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
          background: tierFill("highest").background,
          color: tierFill("highest").color,
          fontFamily: tokens.fontMono,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
          fontSize: chipFont,
          lineHeight: 1,
          padding: chipPad,
          borderRadius: r.chip,
          // Was `1.5px solid #25252F` — the old page ground, hard-coded. The
          // border's job is to let the page show through so the chip reads as
          // docked against the avatar rather than pasted onto it, which is
          // `--bg` by definition and follows the theme.
          border: `1.5px solid ${t.bg}`,
        }}
        aria-label={`Level ${level}`}
      >
        {level}
      </div>
    </div>
  )
}
