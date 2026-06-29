import { useState } from "react"
import {
  Compass,
  DraftingCompass,
  Library,
  Users,
  type LucideIcon,
} from "lucide-react"
import { tokens, sans, type TrackId } from "./tokens"

export interface TrackOption {
  id: TrackId
  name: string
  color: string
  philosophy: string
  perks: string[]
}

export interface TrackPickerProps {
  tracks: TrackOption[]
  onChoose: (track: TrackId) => void
  onDefer?: () => void
}

const icons: Record<TrackId, LucideIcon> = {
  architect: DraftingCompass,
  curator: Library,
  mentor: Users,
  explorer: Compass,
}

export default function TrackPicker({
  tracks,
  onChoose,
  onDefer,
}: TrackPickerProps) {
  const [selected, setSelected] = useState<TrackId | null>(null)

  return (
    <div style={{ fontFamily: sans, width: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: tokens.text,
            margin: 0,
          }}
        >
          Choose your path
        </h2>
        <p
          style={{
            fontSize: 13,
            color: tokens.textDim,
            marginTop: 6,
          }}
        >
          This shapes what you unlock next — and you can change it later.
        </p>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        style={{ gap: 14 }}
      >
        {tracks.map((t) => {
          const Icon = icons[t.id]
          const isSel = selected === t.id
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(t.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelected(t.id)
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 18,
                borderRadius: tokens.radiusCard,
                background: tokens.card,
                backdropFilter: tokens.glass,
                WebkitBackdropFilter: tokens.glass,
                border: isSel
                  ? `1px solid ${t.color}`
                  : tokens.border,
                boxShadow: isSel
                  ? `0 0 0 1px ${t.color}, 0 0 24px color-mix(in srgb, ${t.color} 35%, transparent)`
                  : "none",
                cursor: "pointer",
                transition: "box-shadow 0.2s ease, border-color 0.2s ease",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: tokens.radiusCard,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: `color-mix(in srgb, ${t.color} 16%, transparent)`,
                  border: `0.5px solid color-mix(in srgb, ${t.color} 40%, transparent)`,
                  marginBottom: 14,
                }}
              >
                <Icon size={32} color={t.color} strokeWidth={1.75} />
              </div>

              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: tokens.text,
                  margin: 0,
                }}
              >
                {t.name}
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: tokens.textDim,
                  margin: "6px 0 14px",
                  lineHeight: 1.5,
                  minHeight: 34,
                }}
              >
                {t.philosophy}
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                {t.perks.slice(0, 3).map((p) => (
                  <span
                    key={p}
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      padding: "3px 8px",
                      borderRadius: tokens.radiusPill,
                      color: tokens.textDim,
                      background: "rgba(255,255,255,0.06)",
                      border: tokens.borderSoft,
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChoose(t.id)
                }}
                style={{
                  marginTop: "auto",
                  width: "100%",
                  padding: "9px 0",
                  borderRadius: tokens.radiusPill,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: sans,
                  color: "#fff",
                  background: isSel
                    ? tokens.brandGradient
                    : "rgba(255,255,255,0.08)",
                }}
              >
                Choose
              </button>
            </div>
          )
        })}
      </div>

      {onDefer && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            type="button"
            onClick={onDefer}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: sans,
              color: tokens.textFaint,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Decide later
          </button>
        </div>
      )}
    </div>
  )
}
