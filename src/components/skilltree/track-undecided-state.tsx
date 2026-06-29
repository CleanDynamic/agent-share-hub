import {
  Compass,
  DraftingCompass,
  Library,
  Users,
} from "lucide-react"
import { tokens, sans, trackMeta } from "./tokens"

export interface TrackUndecidedStateProps {
  onChoose: () => void
}

const row = [
  { id: "architect", Icon: DraftingCompass },
  { id: "curator", Icon: Library },
  { id: "mentor", Icon: Users },
  { id: "explorer", Icon: Compass },
] as const

export default function TrackUndecidedState({
  onChoose,
}: TrackUndecidedStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "48px 24px",
        borderRadius: tokens.radiusPanel,
        background: tokens.shell,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        border: tokens.border,
        fontFamily: sans,
      }}
    >
      <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
        {row.map(({ id, Icon }) => (
          <div
            key={id}
            style={{
              width: 44,
              height: 44,
              borderRadius: tokens.radiusCard,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.05)",
              border: tokens.borderSoft,
            }}
          >
            <Icon size={24} color={trackMeta[id].color} strokeWidth={1.75} />
          </div>
        ))}
      </div>

      <h3
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: tokens.text,
          margin: 0,
        }}
      >
        Choose your path
      </h3>
      <p
        style={{
          fontSize: 13,
          color: tokens.textDim,
          marginTop: 6,
          maxWidth: 280,
        }}
      >
        You haven&apos;t picked a specialisation yet — choose one whenever
        you&apos;re ready.
      </p>

      <button
        type="button"
        onClick={onChoose}
        style={{
          marginTop: 18,
          padding: "10px 24px",
          borderRadius: tokens.radiusPill,
          border: "none",
          background: tokens.brandGradient,
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: sans,
          cursor: "pointer",
        }}
      >
        Choose
      </button>
    </div>
  )
}
