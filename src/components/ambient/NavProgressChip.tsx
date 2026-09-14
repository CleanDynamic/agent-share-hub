import { useState } from "react"
import { ChevronRight, Sparkles, Flame, Shield } from "lucide-react"
import { tokens, reputationColor } from "./tokens"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { elevation } from "@/lib/theme/elevation"
import { progressFill, progressTrack, tierFill, xpText } from "@/lib/theme/progress"

export interface NavProgressChipProps {
  /** Current level number. */
  level: number
  /** Display name for the current level/rank. */
  levelName?: string
  /** XP earned inside the current level band. */
  xpIntoLevel: number
  /** XP required to complete the current level band. */
  xpForLevel: number
  /** Lifetime XP total (shown in the flyout). */
  totalXp?: number
  /** Current daily streak in days. */
  streakDays?: number
  /** Reputation score (teal). */
  reputation?: number
}

/**
 * NavProgressChip — compact level + mini XP bar for the left rail.
 * Hover reveals a flyout with the full breakdown. Ambient, L1.
 *
 * THIS IS MOUNTED IN AppShell, so it is on screen on EVERY route in the
 * product — which made it the most-seen thing this prompt touches and the one
 * with the most to lose from getting progress colour wrong. It was an orange
 * gradient level disc over an orange mini-bar: `--action`, the primary-action
 * colour, sitting permanently in the rail directly above the real primary
 * actions, competing with them on every page.
 *
 * It is the ladder now. The level disc is the top rung (an amber fill with
 * `--on-lit` on it), the bar is `--lit` in a `--line` groove, and every figure
 * — the fraction, the percentage, the lifetime total — is `xpText()`, never
 * amber type.
 */
export default function NavProgressChip({
  level,
  levelName = "Builder",
  xpIntoLevel,
  xpForLevel,
  totalXp,
  streakDays,
  reputation,
}: NavProgressChipProps) {
  const [open, setOpen] = useState(false)
  const pct = Math.max(0, Math.min(100, (xpIntoLevel / xpForLevel) * 100))
  const remaining = Math.max(0, xpForLevel - xpIntoLevel)

  return (
    <div
      className="relative"
      style={{ fontFamily: tokens.fontSans }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Level ${level}, ${Math.round(pct)} percent to next level`}
        className="flex w-full items-center gap-3 text-left transition-colors"
        style={{
          padding: "10px 12px",
          borderRadius: tokens.radiusCard,
          background: tokens.card,
          border: tokens.borderSoft,
        }}
      >
        <span
          className="flex shrink-0 items-center justify-center"
          style={{
            width: 34,
            height: 34,
            borderRadius: r.full,
            background: tierFill("highest").background,
            ...xpText("onLit"),
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {level}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span style={{ fontSize: 12.5, fontWeight: 600, color: tokens.text }}>
              {levelName}
            </span>
            <span style={{ ...xpText("secondary"), fontSize: 10.5 }}>
              {xpIntoLevel}/{xpForLevel}
            </span>
          </span>

          <span
            className="mt-1.5 block w-full overflow-hidden"
            style={{
              height: 5,
              borderRadius: r.chip,
              background: progressTrack().background,
            }}
          >
            <span
              className="block h-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                borderRadius: r.chip,
                background: progressFill().background,
              }}
            />
          </span>
        </span>
      </button>

      {/* Flyout */}
      <div
        role="tooltip"
        className="absolute left-full top-0 z-50 ml-3 transition-all duration-150"
        style={{
          width: 232,
          opacity: open ? 1 : 0,
          transform: open ? "translateX(0)" : "translateX(-6px)",
          pointerEvents: open ? "auto" : "none",
          padding: 14,
          borderRadius: tokens.radiusPanel,
          background: t.glass,
          border: `0.5px solid ${t.glassBorder}`,
          backdropFilter: tokens.glass,
          WebkitBackdropFilter: tokens.glass,
          ...elevation.raised,
        }}
      >
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>
            Level {level} · {levelName}
          </span>
          <Sparkles size={14} color={t.text2} />
        </div>

        <div className="mt-3">
          <div
            className="w-full overflow-hidden"
            style={{
              height: 6,
              borderRadius: r.chip,
              background: progressTrack().background,
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: r.chip,
                background: progressFill().background,
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span style={{ fontSize: 11, color: tokens.textMuted }}>
              {remaining} XP to Level {level + 1}
            </span>
            <span
              style={{ ...xpText(), fontSize: 11, fontWeight: 500 }}
            >
              {Math.round(pct)}%
            </span>
          </div>
        </div>

        <div
          className="mt-3 grid grid-cols-1 gap-2 pt-3"
          style={{ borderTop: tokens.borderSoft }}
        >
          {typeof totalXp === "number" && (
            <FlyoutStat
              icon={<Sparkles size={13} color={t.text2} />}
              label="Lifetime XP"
              value={totalXp.toLocaleString()}
              color={t.text}
            />
          )}
          {typeof streakDays === "number" && (
            <FlyoutStat
              icon={<Flame size={13} color={t.text2} />}
              label="Streak"
              value={`${streakDays} day${streakDays === 1 ? "" : "s"}`}
              color={t.text}
            />
          )}
          {typeof reputation === "number" && (
            <FlyoutStat
              icon={<Shield size={13} color={reputationColor} />}
              label="Reputation"
              value={reputation.toLocaleString()}
              color={reputationColor}
            />
          )}
        </div>

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1 transition-opacity hover:opacity-90"
          style={{
            padding: "8px 12px",
            borderRadius: r.control,
            background: t.action,
            color: t.onAction,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          View profile
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

function FlyoutStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2" style={{ color: tokens.textMuted, fontSize: 11.5 }}>
        {icon}
        {label}
      </span>
      <span style={{ fontFamily: tokens.fontMono, fontSize: 11.5, color, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}
