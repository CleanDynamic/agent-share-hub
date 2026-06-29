import { X, Check, type LucideIcon } from "lucide-react"
import { tokens, sans, type TrackId, trackMeta } from "./tokens"

export interface UnlockedPerk {
  name: string
  icon: LucideIcon
  blurb: string
}

export interface TierUnlockModalProps {
  track: TrackId
  tier: number
  perks: UnlockedPerk[]
  onClose: () => void
}

export default function TierUnlockModal({
  track,
  tier,
  perks,
  onClose,
}: TierUnlockModalProps) {
  const meta = trackMeta[track]
  const color = meta.color

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10,10,16,0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        fontFamily: sans,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 26,
          borderRadius: tokens.radiusPanel,
          background: tokens.shell,
          backdropFilter: tokens.glass,
          WebkitBackdropFilter: tokens.glass,
          border: `1px solid ${color}`,
          boxShadow: `0 0 40px color-mix(in srgb, ${color} 35%, transparent)`,
          color: tokens.text,
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(255,255,255,0.06)",
            border: tokens.borderSoft,
            borderRadius: 8,
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

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color,
            }}
          >
            {meta.name} · Tier {tier}
          </div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: "8px 0 0",
            }}
          >
            Tier {tier} unlocked
          </h2>
          <p
            style={{
              fontSize: 13,
              color: tokens.textDim,
              marginTop: 6,
            }}
          >
            New perks are now active on your {meta.name} path.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {perks.map((p) => {
            const Icon = p.icon
            return (
              <div
                key={p.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: tokens.radiusCard,
                  background: tokens.card,
                  border: tokens.borderSoft,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    borderRadius: tokens.radiusCard,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: color,
                    boxShadow: `0 0 14px color-mix(in srgb, ${color} 55%, transparent)`,
                  }}
                >
                  <Icon size={20} color="#fff" strokeWidth={2.25} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {p.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: tokens.textDim,
                      lineHeight: 1.4,
                    }}
                  >
                    {p.blurb}
                  </div>
                </div>
                <Check size={18} color={tokens.green} />
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 22,
            padding: "11px 0",
            borderRadius: tokens.radiusPill,
            border: "none",
            background: tokens.brandGradient,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: sans,
            cursor: "pointer",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
