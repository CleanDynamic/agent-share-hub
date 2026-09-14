import { X, type LucideIcon } from "lucide-react"
import { tokens, sans, mono, fmt, type TrackId } from "./tokens"
import { r } from "@/lib/theme/radius"
import { t as tok } from "@/lib/theme/tokens"
import { elevation, SCRIM } from "@/lib/theme/elevation"
import { tierFill, xpText } from "@/lib/theme/progress"

export interface Perk {
  name: string
  icon: LucideIcon
  track: TrackId
  trackName: string
  trackColor: string
  tier: number
  description: string
  unlocks: string
}

export interface PerkDetailPanelProps {
  perk: Perk
  trackXp: number
  requiredXp: number
  isUnlocked: boolean
  onClose: () => void
}

export default function PerkDetailPanel({
  perk,
  trackXp,
  requiredXp,
  isUnlocked,
  onClose,
}: PerkDetailPanelProps) {
  const remaining = Math.max(0, requiredXp - trackXp)
  const pct = Math.max(0, Math.min(100, (trackXp / requiredXp) * 100))
  const Icon = perk.icon

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 360,
        padding: 22,
        borderRadius: tokens.radiusPanel,
        background: tokens.shell,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        border: tokens.border,
        fontFamily: sans,
        color: tokens.text,
      }}
    >
      <div
        className="flex items-start justify-between"
        style={{ marginBottom: 16 }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: tokens.radiusCard,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isUnlocked
              ? tierFill("highest").background
              : tierFill("rare").background,
            border: `0.5px solid ${
              isUnlocked ? tierFill("highest").borderColor : tierFill("rare").borderColor
            }`,
          }}
        >
          <Icon
            size={24}
            color={isUnlocked ? tierFill("highest").color : tok.text2}
            strokeWidth={2}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: tok.glass2,
            border: tokens.borderSoft,
            borderRadius: r.chip,
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={16} color={tokens.textDim} />
        </button>
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
        {perk.name}
      </h3>

      <span
        style={{
          display: "inline-block",
          marginTop: 8,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          padding: "3px 9px",
          borderRadius: r.chip,
          // Was `color: perk.trackColor` — amber TYPE once the four track hues
          // collapsed onto one light. The rung carries the emphasis instead.
          color: tierFill("rare").color,
          background: tierFill("rare").background,
          border: `0.5px solid ${tierFill("rare").borderColor}`,
        }}
      >
        {perk.trackName} · Tier {perk.tier}
      </span>

      <p
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: tokens.textDim,
          marginTop: 16,
        }}
      >
        {perk.description}
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: tokens.radiusCard,
          background: tokens.card,
          border: tokens.borderSoft,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: tokens.textFaint,
            marginBottom: 8,
          }}
        >
          What this actually unlocks
        </div>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: tokens.text,
            margin: 0,
          }}
        >
          {perk.unlocks}
        </p>
      </div>

      {!isUnlocked && (
        <div style={{ marginTop: 18 }}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 8 }}
          >
            <span style={{ fontSize: 12, color: tokens.textDim }}>
              Reach Tier {perk.tier} —{" "}
              <span style={{ fontFamily: mono, ...xpText() }}>
                {fmt(remaining)}
              </span>{" "}
              track XP to go
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: r.chip,
              background: tok.line,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: r.chip,
                // The light as a fill; the 10px glow under it went with every
                // other glow on this surface.
                background: tok.lit,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      )}

      {isUnlocked && (
        <div
          style={{
            marginTop: 18,
            fontSize: 12,
            fontWeight: 600,
            color: tokens.green,
          }}
        >
          Unlocked · Active
        </div>
      )}
    </div>
  )
}
