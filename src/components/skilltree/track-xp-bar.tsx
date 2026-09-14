import { tokens, mono, fmt } from "./tokens"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"

export interface TrackXpBarProps {
  trackXp: number
  tierThresholds: number[]
  trackColor: string
}

export default function TrackXpBar({
  trackXp,
  tierThresholds,
  trackColor,
}: TrackXpBarProps) {
  const max = tierThresholds[tierThresholds.length - 1] || 1
  const pct = Math.max(0, Math.min(100, (trackXp / max) * 100))

  return (
    <div style={{ width: "100%" }}>
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 8 }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: tokens.textDim,
          }}
        >
          Track XP
        </span>
        <span
          style={{
            fontFamily: mono,
            fontSize: 12,
            color: t.text,
            fontWeight: 600,
          }}
        >
          {fmt(trackXp)}{" "}
          <span style={{ color: tokens.textFaint }}>/ {fmt(max)}</span>
        </span>
      </div>

      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: r.chip,
          background: t.line,
          border: tokens.borderSoft,
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${pct}%`,
            borderRadius: r.chip,
            // The light as a FILL. The 12px glow under it went: a glow needs
            // darkness to glow against, and on Exhibition it read as a sticker.
            background: t.lit,
            transition: "width 0.4s ease",
          }}
        />
        {/* tier notches */}
        {tierThresholds.map((t, i) => {
          const left = Math.min(100, (t / max) * 100)
          const reached = trackXp >= t
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: -3,
                left: `${left}%`,
                transform: "translateX(-50%)",
                width: 2,
                height: 14,
                borderRadius: 2,
                background: reached
                  ? t.lit
                  : t.line,
              }}
              title={`Tier ${i + 1} — ${fmt(t)} XP`}
            />
          )
        })}
        {/* current position dot */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${pct}%`,
            transform: "translate(-50%, -50%)",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: t.bg,
            border: `2px solid ${t.lit}`,
            boxShadow: `0 0 10px color-mix(in srgb, ${trackColor} 70%, transparent)`,
          }}
        />
      </div>
    </div>
  )
}
