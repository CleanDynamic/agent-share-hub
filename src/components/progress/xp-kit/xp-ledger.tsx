import { useState } from "react"
import { Info } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { elevation } from "@/lib/theme/elevation"
import { xpText } from "@/lib/theme/progress"
import { tokens } from "./tokens"
import DiminishingMeter from "./diminishing-meter"

/* ── BG-P28b ────────────────────────────────────────────────────────────────
   THE LEDGER IS A DATA TABLE, and `data-visualization` applies to it even
   though it is built from divs. Three things follow from that and none of them
   is a recolour:

   · THE XP COLUMN IS DM MONO WITH TABULAR NUMERALS. It was the body face at
     weight 700, so "+120" and "+25" were different widths and the column's
     right edge moved row to row — the one thing a column of figures must not
     do. `xpText()` supplies the face, the numerals and a legal colour.
   · THE FIGURE IS NOT COLOURED. It was `tokens.orange`, which resolves to
     `--action` — "the primary thing to do" — spent on a number you cannot
     press. Every row's award is the same KIND of thing, so colouring them says
     nothing; `--text` for a full award and `--text2` for a diminished one is
     the whole encoding, and it matches the struck-through base beside it.
   · ROWS STRIPE IN `--recess`. Eight rows of icon + label + figure need a
     horizontal guide for the eye to carry across; the hairline alone does not
     do it once the list is scrolled. `--recess` is the system's inset ground
     and is already measured against both text tokens in both rooms.
   ────────────────────────────────────────────────────────────────────────── */

export interface XpLedgerEntry {
  id: string
  icon: LucideIcon
  /** Action label, e.g. "Post downloaded" */
  action: string
  /** Optional source title, e.g. "Whisper Hallucinations" */
  sourceLabel?: string
  sourceUrl?: string
  /** XP actually awarded */
  xp: number
  /** Original base value, present only when the award was diminished */
  baseXp?: number
  /** When the XP was awarded */
  timestamp: Date
}

export interface XpLedgerProps {
  entries: XpLedgerEntry[]
  onLoadMore: () => void
  /** Optional fairness readout, surfaced behind the header info icon */
  diminishing?: { actionType: string; currentMultiplier: number }
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function dayHeader(d: Date) {
  const today = startOfDay(new Date())
  const day = startOfDay(d)
  const diff = Math.round((today - day) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
}

function relativeTime(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function XpLedger({ entries, onLoadMore, diminishing }: XpLedgerProps) {
  const [showMeter, setShowMeter] = useState(false)

  // Group entries by day, preserving incoming order
  const groups: { key: string; label: string; rows: XpLedgerEntry[] }[] = []
  for (const e of entries) {
    const key = String(startOfDay(e.timestamp))
    let g = groups.find((x) => x.key === key)
    if (!g) {
      g = { key, label: dayHeader(e.timestamp), rows: [] }
      groups.push(g)
    }
    g.rows.push(e)
  }

  return (
    <div
      style={{
        fontFamily: tokens.fontSans,
        background: tokens.card,
        border: tokens.borderMid,
        borderRadius: tokens.radiusPanel,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        maxHeight: 460,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: tokens.borderSoft,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>XP History</span>

        {diminishing && (
          <div
            style={{ position: "relative", display: "flex", alignItems: "center" }}
            onMouseEnter={() => setShowMeter(true)}
            onMouseLeave={() => setShowMeter(false)}
          >
            <button
              type="button"
              aria-label="Show today's XP rate"
              onClick={() => setShowMeter((v) => !v)}
              style={{
                display: "flex",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: tokens.textFaint,
              }}
            >
              <Info size={15} />
            </button>
            {showMeter && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  padding: "8px 12px",
                  borderRadius: tokens.radiusCard,
                  background: tokens.shell,
                  border: tokens.borderStrong,
                  // A shadow on a light ground and one on a dark ground are
                  // not the same object; the scale is defined per theme.
                  ...elevation.raised,
                  zIndex: 20,
                  ...tokens.glass,
                }}
              >
                <DiminishingMeter
                  actionType={diminishing.actionType}
                  currentMultiplier={diminishing.currentMultiplier}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {groups.map((g) => (
          <div key={g.key}>
            <div
              style={{
                position: "sticky",
                top: 0,
                padding: "8px 16px",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: tokens.textFaint,
                background: tokens.card,
                backdropFilter: "blur(8px)",
              }}
            >
              {g.label}
            </div>

            {g.rows.map((row, i) => {
              const diminished = typeof row.baseXp === "number" && row.baseXp > row.xp
              const Icon = row.icon
              return (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 16px",
                    borderTop: tokens.borderSoft,
                    // Striping, so the eye carries across a scrolled column.
                    background: i % 2 === 1 ? t.recess : "transparent",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 30,
                      height: 30,
                      borderRadius: r.chip,
                      background: t.glass2,
                      flexShrink: 0,
                      color: tokens.textMuted,
                    }}
                  >
                    <Icon size={15} />
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: tokens.text }}>
                      {row.action}
                      {row.sourceLabel && (
                        <>
                          <span style={{ color: tokens.textMuted }}>{" on "}</span>
                          {row.sourceUrl ? (
                            <a
                              href={row.sourceUrl}
                              style={{ color: tokens.teal, textDecoration: "none" }}
                            >
                              {`'${row.sourceLabel}'`}
                            </a>
                          ) : (
                            <span style={{ color: tokens.text }}>{`'${row.sourceLabel}'`}</span>
                          )}
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: tokens.textFaint, marginTop: 2 }}>
                      {relativeTime(row.timestamp)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      ...xpText(),
                      flexShrink: 0,
                    }}
                  >
                    {diminished && (
                      <>
                        <span
                          style={{
                            ...xpText("secondary"),
                            fontSize: 11,
                            textDecoration: "line-through",
                          }}
                        >
                          {`+${row.baseXp}`}
                        </span>
                        <span
                          title="Diminishing returns — repeated actions earn less each day"
                          style={{ display: "flex", cursor: "help", color: tokens.textFaint }}
                        >
                          <Info size={12} />
                        </span>
                      </>
                    )}
                    <span
                      style={{
                        ...xpText(diminished ? "secondary" : "primary"),
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {`+${row.xp}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        <button
          type="button"
          onClick={onLoadMore}
          style={{
            width: "100%",
            padding: "12px 0",
            border: "none",
            borderTop: tokens.borderSoft,
            background: "none",
            cursor: "pointer",
            color: tokens.textMuted,
            fontFamily: tokens.fontSans,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Load more
        </button>
      </div>
    </div>
  )
}
