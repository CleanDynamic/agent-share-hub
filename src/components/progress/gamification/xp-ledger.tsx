import { ScrollText } from "lucide-react"
import { colors, radius, glass, monoFont, tracks, withAlpha } from "./tokens"
import type { TrackName } from "./tokens"

export interface LedgerEntry {
  id: string
  label: string
  track: TrackName
  /** Positive XP earned, negative for deductions. */
  amount: number
  /** Human-readable timestamp, e.g. "2h ago". */
  time: string
}

export interface XpLedgerProps {
  entries: LedgerEntry[]
  title?: string
}

export default function XpLedger({
  entries,
  title = "XP Ledger",
}: XpLedgerProps) {
  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  return (
    <section
      className="flex flex-col p-5"
      style={{
        background: colors.card,
        border: `0.5px solid ${colors.borderStrong}`,
        borderRadius: radius.card,
        ...glass,
      }}
    >
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ScrollText size={18} color={colors.brand} />
          <span
            className="text-sm font-semibold"
            style={{ color: colors.textPrimary }}
          >
            {title}
          </span>
        </div>
        <span
          className="text-sm font-semibold"
          style={{ fontFamily: monoFont, color: colors.green }}
        >
          +{total.toLocaleString()} XP
        </span>
      </header>

      <ul className="flex flex-col">
        {entries.map((entry, i) => {
          const accent = tracks[entry.track]
          const positive = entry.amount >= 0
          return (
            <li
              key={entry.id}
              className="flex items-center gap-3 py-3"
              style={{
                borderTop:
                  i === 0
                    ? "none"
                    : `0.5px solid ${colors.borderSoft}`,
              }}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: accent }}
                aria-hidden="true"
              />
              <div className="flex flex-1 flex-col">
                <span
                  className="text-sm"
                  style={{ color: colors.textPrimary }}
                >
                  {entry.label}
                </span>
                <span
                  className="text-xs"
                  style={{ color: colors.textFaint }}
                >
                  {entry.track} &middot; {entry.time}
                </span>
              </div>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{
                  fontFamily: monoFont,
                  color: positive ? colors.green : colors.textMuted,
                }}
              >
                {positive ? "+" : ""}
                {entry.amount.toLocaleString()}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
