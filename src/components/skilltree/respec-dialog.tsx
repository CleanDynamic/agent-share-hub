import { RefreshCw, Clock } from "lucide-react"
import { tokens, sans, type TrackId, trackMeta } from "./tokens"

export interface RespecDialogProps {
  currentTrack: TrackId
  canRespec: boolean
  nextRespecDate?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function RespecDialog({
  currentTrack,
  canRespec,
  nextRespecDate,
  onConfirm,
  onCancel,
}: RespecDialogProps) {
  const meta = trackMeta[currentTrack]

  return (
    <div
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
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          padding: 24,
          borderRadius: tokens.radiusPanel,
          background: tokens.shell,
          backdropFilter: tokens.glass,
          WebkitBackdropFilter: tokens.glass,
          border: tokens.border,
          color: tokens.text,
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: tokens.radiusCard,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `color-mix(in srgb, ${meta.color} 16%, transparent)`,
            border: `0.5px solid color-mix(in srgb, ${meta.color} 40%, transparent)`,
            marginBottom: 16,
          }}
        >
          <RefreshCw size={22} color={meta.color} strokeWidth={2} />
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          Switch path?
        </h3>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: tokens.textDim,
            marginTop: 10,
          }}
        >
          Your <strong style={{ color: meta.color }}>{meta.name}</strong>{" "}
          track XP is kept — nothing is lost. Your active perks swap to the
          new track&apos;s tree, and respec goes on a 30-day cooldown.
        </p>

        {!canRespec && nextRespecDate && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 16,
              padding: "10px 12px",
              borderRadius: tokens.radiusCard,
              background: `color-mix(in srgb, ${tokens.amber} 12%, transparent)`,
              border: `0.5px solid color-mix(in srgb, ${tokens.amber} 35%, transparent)`,
            }}
          >
            <Clock size={16} color={tokens.amber} />
            <span style={{ fontSize: 12, color: tokens.amber }}>
              On cooldown — available again {nextRespecDate}
            </span>
          </div>
        )}

        <div
          className="flex"
          style={{ gap: 10, marginTop: 22 }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: tokens.radiusPill,
              border: tokens.border,
              background: "rgba(255,255,255,0.06)",
              color: tokens.text,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: sans,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canRespec}
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: tokens.radiusPill,
              border: "none",
              background: canRespec
                ? tokens.brandGradient
                : "rgba(255,255,255,0.08)",
              color: canRespec ? "#fff" : tokens.textFaint,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: sans,
              cursor: canRespec ? "pointer" : "not-allowed",
            }}
          >
            {canRespec ? "Confirm switch" : "Unavailable"}
          </button>
        </div>
      </div>
    </div>
  )
}
