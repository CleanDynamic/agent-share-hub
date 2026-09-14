import { Flame, Snowflake } from "lucide-react"

import { useTheme } from "@/contexts/ThemeContext"
import { t } from "@/lib/theme/tokens"
import { progressGlow } from "@/lib/theme/progress"
import { COLORS, FONT } from "./tokens"

export type StreakFlameState = "active" | "frozen-today" | "at-risk" | "zero"

export interface StreakFlameProps {
  /** Current streak length in days. */
  streak: number
  /** Visual state of the flame. */
  state?: StreakFlameState
  /** Pixel size of the icon. */
  size?: number
  /**
   * The at-risk pulse only activates when streak >= this value, so we never
   * pressure someone on day one. Defaults to 3.
   */
  minPressureStreak?: number
}

/**
 * StreakFlame — the L1 streak glyph. A number that quietly grows, with a small
 * flame whose colour and animation reflect the streak's health. Warm, never
 * punishing.
 *
 * ── TWO TREATMENTS, ONE COMPONENT (BG-P28b) ────────────────────────────────
 *
 * This is the hardest object in the repaint, because a glow is the one effect
 * that does not survive translation to a light ground. A flame with an amber
 * halo reads as a light source on near-black; the identical halo on a luminous
 * grey wall reads as a sticker someone adhered to it, because there is nothing
 * for it to glow AGAINST — the ground is already brighter than the glow.
 *
 * So the treatment is chosen by the RESOLVED theme from `useTheme()`:
 *
 *   Dusk        a low-alpha amber radial sits BEHIND a solid amber mark. The
 *               halo is a separate absolutely-positioned layer, so it cannot
 *               alter the glyph's own box.
 *   Exhibition  no halo at all. The mark is solid amber and carries itself;
 *               the flame's fill opacity is the only depth it gets.
 *
 * `useTheme()` rather than a `prefers-color-scheme` media query, because the
 * room is a choice the visitor makes and stores — the OS preference is only the
 * default when they have not made one.
 *
 * ── WHAT THE COLOURS BECAME ────────────────────────────────────────────────
 *
 * The flame was `#F59E0B` amber, the frozen state `#2EC4B6` teal, the at-risk
 * state `#E8571A` orange and the zero state a white alpha. Amber was already
 * doing the right job and is `--lit` by its proper name now. At-risk keeps
 * `--action`, which is correct for a different reason than the one it was
 * picked for: a streak about to lapse IS the primary thing to do about it.
 *
 * ── THE KEYFRAMES MOVED TO index.css ───────────────────────────────────────
 *
 * They were an inline `<style>` block, which the delivery rules disallow, and
 * the at-risk pulse hard-coded `rgba(232,87,26,…)` into a drop-shadow — a raw
 * brand orange that no theme switch could reach. `bgStreakAtRisk` uses
 * `--action` instead. Both names carry `[data-bg-animated]`, which is the
 * attribute BG-P07's reduced-motion guard already keys on.
 */
export default function StreakFlame({
  streak,
  state = "active",
  size = 28,
  minPressureStreak = 3,
}: StreakFlameProps) {
  const { resolved } = useTheme()

  const isFrozen = state === "frozen-today"
  const isZero = state === "zero"
  const isAtRisk = state === "at-risk"

  // Don't pulse for very short streaks — no pressure on day one.
  const shouldPulse = isAtRisk && streak >= minPressureStreak

  let glyphColor: string = COLORS.streakAmber // active flame = the light
  if (isFrozen) glyphColor = COLORS.reputationTeal
  else if (isZero) glyphColor = COLORS.locked
  else if (isAtRisk) glyphColor = COLORS.xpOrange

  const numberColor = isZero ? COLORS.textFaint : COLORS.text

  // The halo is Dusk-only, and only under a flame that is actually burning.
  const halo = !isZero && !isFrozen && !isAtRisk ? progressGlow(resolved, { radius: size * 0.75, alpha: 0.28 }) : undefined

  const animation = shouldPulse
    ? "bgStreakAtRisk 1.4s ease-in-out infinite"
    : !isZero && !isFrozen
      ? "bgStreakFlicker 2.6s ease-in-out infinite"
      : undefined

  return (
    <div className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT.sans }}>
      <span
        aria-hidden="true"
        className="inline-flex"
        style={{ position: "relative", alignItems: "center", justifyContent: "center" }}
      >
        {halo && (
          <span
            aria-hidden="true"
            style={{
              ...halo,
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
        )}
        <span
          className="inline-flex"
          data-bg-animated={animation ? "" : undefined}
          style={{
            position: "relative",
            color: glyphColor,
            animation,
          }}
        >
          {isFrozen ? (
            <Snowflake size={size} strokeWidth={1.75} />
          ) : (
            <Flame
              size={size}
              strokeWidth={1.75}
              fill={isZero ? "none" : "currentColor"}
              fillOpacity={isZero ? 0 : 0.18}
            />
          )}
        </span>
      </span>

      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: size * 0.66,
          fontWeight: 500,
          lineHeight: 1,
          color: numberColor,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {streak}
      </span>

      <span className="sr-only">
        {isZero
          ? "No active streak"
          : isFrozen
            ? `${streak} day streak, frozen today`
            : isAtRisk
              ? `${streak} day streak, at risk`
              : `${streak} day streak`}
      </span>
    </div>
  )
}
