import { Flame, Sparkles, ArrowUpRight } from "lucide-react"
import { tokens } from "./tokens"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { elevation } from "@/lib/theme/elevation"
import { tierFill, xpText } from "@/lib/theme/progress"

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
        background: t.glass,
        border: `0.5px solid ${t.glassBorder}`,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        ...elevation.raised,
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
            /**
             * BG-P28b. Was `${streakColor}1F` over `${streakColor}55` — alpha
             * suffixes on what is now `var(--lit)`, so neither the ground nor
             * the border was a colour and the chip rendered bare. The streak
             * count is progress, so it is the amber FILL with --on-lit on it.
             */
            borderRadius: r.chip,
            background: tierFill("highest").background,
          }}
        >
          <Flame size={13} color={tierFill("highest").color} />
          <span
            style={{
              ...xpText("onLit"),
              fontSize: 12,
              fontWeight: 500,
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
                ...xpText("secondary"),
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              +{e.xp}
            </span>
          </div>
        ))}
      </div>

      <footer className="mt-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5" style={{ color: tokens.textMuted, fontSize: 12.5 }}>
          <Sparkles size={14} color={t.text2} />
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
