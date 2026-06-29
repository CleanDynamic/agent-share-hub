import { useState } from "react"
import { Info } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { tokens } from "./tokens"
import DiminishingMeter from "./diminishing-meter"

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
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
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

            {g.rows.map((row) => {
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
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.06)",
                      flexShrink: 0,
                      color: tokens.text,
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
                      fontFamily: tokens.fontMono,
                      flexShrink: 0,
                    }}
                  >
                    {diminished && (
                      <>
                        <span
                          style={{
                            fontSize: 11,
                            color: tokens.textFaint,
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
                        fontSize: 13,
                        fontWeight: 700,
                        color: diminished ? tokens.textMuted : tokens.orange,
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
