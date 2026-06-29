import { useState } from "react"
import { Lock } from "lucide-react"
import { tokens, xpColor } from "./tokens"

export interface PerkGateTooltipProps {
  /** Name of the gated perk. */
  perkName: string
  /** Level at which the perk unlocks. */
  unlockLevel: number
  /** The viewer's current level. */
  currentLevel: number
  /** XP still needed to reach the unlock level (optional). */
  xpRemaining?: number
  /** The locked element this tooltip wraps. */
  children: React.ReactNode
}

/**
 * PerkGateTooltip — wraps a locked perk and explains how to unlock it on
 * hover/focus. Perks don't exist before reveal, so L2.
 */
export default function PerkGateTooltip({
  perkName,
  unlockLevel,
  currentLevel,
  xpRemaining,
  children,
}: PerkGateTooltipProps) {
  const [open, setOpen] = useState(false)
  const levelsAway = Math.max(0, unlockLevel - currentLevel)

  return (
    <span
      className="relative inline-flex"
      style={{ fontFamily: tokens.fontSans }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span style={{ opacity: 0.55, filter: "grayscale(0.4)" }}>{children}</span>

      {/* Lock badge */}
      <span
        className="pointer-events-none absolute -right-1.5 -top-1.5 flex items-center justify-center"
        style={{
          width: 20,
          height: 20,
          borderRadius: tokens.radiusPill,
          background: tokens.pageBg,
          border: tokens.borderStrong,
        }}
      >
        <Lock size={11} color={tokens.locked} />
      </span>

      <span
        role="tooltip"
        className="absolute bottom-full left-1/2 z-50 mb-2 transition-all duration-150"
        style={{
          width: 214,
          transform: open ? "translate(-50%, 0)" : "translate(-50%, 4px)",
          opacity: open ? 1 : 0,
          pointerEvents: "none",
          padding: 13,
          borderRadius: tokens.radiusCard,
          background: tokens.shell,
          border: tokens.borderStrong,
          backdropFilter: tokens.glass,
          WebkitBackdropFilter: tokens.glass,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        }}
      >
        <span className="flex items-center gap-2">
          <Lock size={13} color={tokens.locked} />
          <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>
            {perkName}
          </span>
        </span>
        <span
          className="mt-1.5 block"
          style={{ fontSize: 11.5, color: tokens.textMuted, lineHeight: 1.45 }}
        >
          Unlocks at{" "}
          <span style={{ color: xpColor, fontWeight: 600 }}>Level {unlockLevel}</span>
          {levelsAway > 0
            ? ` — ${levelsAway} level${levelsAway === 1 ? "" : "s"} away`
            : " — ready to claim"}
          {typeof xpRemaining === "number" && xpRemaining > 0 && (
            <>
              {" · "}
              <span style={{ fontFamily: tokens.fontMono, color: tokens.text }}>
                {xpRemaining} XP
              </span>{" "}
              to go
            </>
          )}
          .
        </span>
      </span>
    </span>
  )
}
