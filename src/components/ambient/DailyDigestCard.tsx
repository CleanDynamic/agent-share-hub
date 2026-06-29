import { Flame, Sparkles, ArrowUpRight } from "lucide-react"
import { tokens, xpColor, streakColor } from "./tokens"

export interface DigestEntry {
  id: string
  label: string
  xp: number
}

export interface DailyDigestCardProps {
  /** Heading date label, e.g. "Yesterday" or "Jun 15". */
  dateLabel: string
  /** Ledger of XP-earning events. */
  entries: DigestEntry[]
  /** Current streak in days (amber flame). */
  streakDays: number
  /** Optional positive delta vs prior period (green). */
  deltaPct?: number
}

/**
 * DailyDigestCard — recap of recent XP activity. Implies history, so L2.
 */
export default function DailyDigestCard({
  dateLabel,
  entries,
  streakDays,
  deltaPct,
}: DailyDigestCardProps) {
  const total = entries.reduce((sum, e) => sum + e.xp, 0)

  return (
    <section
      style={{
        fontFamily: tokens.fontSans,
        width: "100%",
        maxWidth: 360,
        borderRadius: tokens.radiusPanel,
        background: tokens.shell,
        border: tokens.borderStrong,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        boxShadow: "0 14px 40px rgba(0,0,0,0.32)",
        padding: 18,
      }}
    >
      <header className="flex items-center justify-between">
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: tokens.text }}>
            Daily digest
          </div>
          <div style={{ fontSize: 11.5, color: tokens.textMuted }}>{dateLabel}</div>
        </div>
        <div
          className="flex items-center gap-1.5"
          style={{
            padding: "5px 10px",
            borderRadius: tokens.radiusPill,
            background: `${streakColor}1F`,
            border: `0.5px solid ${streakColor}55`,
          }}
        >
          <Flame size={13} color={streakColor} />
          <span
            style={{
              fontFamily: tokens.fontMono,
              fontSize: 12,
              fontWeight: 600,
              color: streakColor,
            }}
          >
            {streakDays}d
          </span>
        </div>
      </header>

      <div
        className="mt-4 flex flex-col"
        style={{ borderTop: tokens.borderSoft }}
      >
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between py-2.5"
            style={{ borderBottom: tokens.borderSoft }}
          >
            <span style={{ fontSize: 13, color: tokens.text }}>{e.label}</span>
            <span
              style={{
                fontFamily: tokens.fontMono,
                fontSize: 12.5,
                fontWeight: 600,
                color: xpColor,
              }}
            >
              +{e.xp}
            </span>
          </div>
        ))}
      </div>

      <footer className="mt-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5" style={{ color: tokens.textMuted, fontSize: 12.5 }}>
          <Sparkles size={14} color={xpColor} />
          Total earned
        </span>
        <div className="flex items-center gap-2">
          {typeof deltaPct === "number" && deltaPct > 0 && (
            <span
              className="flex items-center gap-0.5"
              style={{ fontFamily: tokens.fontMono, fontSize: 11, color: tokens.green }}
            >
              <ArrowUpRight size={12} />
              {deltaPct}%
            </span>
          )}
          <span
            style={{
              fontFamily: tokens.fontMono,
              fontSize: 18,
              fontWeight: 700,
              color: tokens.text,
              letterSpacing: "-0.01em",
            }}
          >
            +{total}
            <span style={{ fontSize: 11, color: tokens.textMuted, fontWeight: 500 }}> XP</span>
          </span>
        </div>
      </footer>
    </section>
  )
}
