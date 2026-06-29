import { Activity, Gem } from "lucide-react"
import { tokens, fontMono, fontSans } from "./tokens"
import RepTooltip from "./rep-tooltip"

export interface RepVsXpCardProps {
  /** Activity level (XP tier). */
  level: number
  /** Reputation score, 0–100. */
  rep: number
}

/** Pick a non-insulting interpretation from the level/rep balance. */
function interpret(level: number, rep: number): string {
  // Map level onto a 0–100 expectation so the two are comparable.
  const levelPct = Math.min(level / 50, 1) * 100
  const diff = rep - levelPct

  if (diff > 12) return "Quality-first creator"
  if (diff < -12) return "High activity, building quality"
  return "Balanced — activity and quality in step"
}

export default function RepVsXpCard({ level, rep }: RepVsXpCardProps) {
  const interpretation = interpret(level, rep)

  return (
    <section
      style={{
        width: "100%",
        maxWidth: 420,
        padding: 20,
        borderRadius: tokens.radiusPanel,
        border: tokens.borderStrong,
        background: tokens.shell,
        ...tokens.glass,
        fontFamily: fontSans,
        color: tokens.text,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
          Level vs Reputation
        </h3>
        <RepTooltip />
      </div>

      <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
        <Stat
          icon={<Activity size={16} color={tokens.orange} aria-hidden="true" />}
          label="Level"
          value={String(level)}
          accent={tokens.orange}
          sub="Activity"
        />
        <div
          aria-hidden="true"
          style={{ width: 1, background: "rgba(255,255,255,0.10)" }}
        />
        <Stat
          icon={<Gem size={16} color={tokens.teal} aria-hidden="true" />}
          label="Reputation"
          value={String(rep)}
          accent={tokens.teal}
          sub="Quality"
        />
      </div>

      <p
        style={{
          margin: "16px 0 0",
          padding: "10px 12px",
          borderRadius: tokens.radiusCard,
          border: tokens.borderSoft,
          background: "rgba(46,196,182,0.08)",
          fontSize: 12.5,
          lineHeight: 1.5,
          color: tokens.text,
        }}
      >
        {interpretation}
      </p>
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
  sub: string
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: tokens.textMuted,
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontFamily: fontMono,
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1,
          color: accent,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: tokens.textFaint }}>{sub}</span>
    </div>
  )
}
