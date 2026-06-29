import { Crown } from "lucide-react"
import { tokens, medalColor } from "./tokens"
import type { LeaderboardRow, LeaderboardTab } from "./types"
import LevelRingMini from "./LevelRingMini"
import TrackChip from "./TrackChip"
import RankDeltaChip from "./RankDeltaChip"

export interface LeaderboardPanelProps {
  tab: LeaderboardTab
  rows: LeaderboardRow[]
  onTab: (tab: LeaderboardTab) => void
}

const TABS: { id: LeaderboardTab; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "alltime", label: "All time" },
  { id: "reputation", label: "Reputation" },
  { id: "category", label: "Per-category" },
]

function valueColor(tab: LeaderboardTab) {
  // XP tabs use brand orange; reputation uses teal.
  return tab === "reputation" ? tokens.teal : tokens.brand
}

function valueSuffix(tab: LeaderboardTab) {
  return tab === "reputation" ? "rep" : "XP"
}

function RankBadge({ rank }: { rank: number }) {
  const medal = medalColor[rank as 1 | 2 | 3]
  if (medal) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: tokens.radiusPill,
          background: `${medal}24`,
          border: `0.5px solid ${medal}66`,
          color: medal,
          flexShrink: 0,
        }}
        aria-label={`Rank ${rank}`}
      >
        {rank === 1 ? (
          <Crown size={13} aria-hidden />
        ) : (
          <span
            style={{
              fontFamily: tokens.fontMono,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {rank}
          </span>
        )}
      </span>
    )
  }
  return (
    <span
      style={{
        width: 24,
        textAlign: "center",
        fontFamily: tokens.fontMono,
        fontSize: 12,
        fontWeight: 600,
        color: tokens.textMuted,
        flexShrink: 0,
      }}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  )
}

export default function LeaderboardPanel({
  tab,
  rows,
  onTab,
}: LeaderboardPanelProps) {
  return (
    <section
      style={{
        ...tokens.glass,
        background: tokens.shell,
        border: tokens.borderStrong,
        borderRadius: tokens.radiusPanel,
        overflow: "hidden",
        fontFamily: tokens.fontSans,
        color: tokens.textPrimary,
      }}
      aria-label="Leaderboard"
    >
      {/* Header + tabs */}
      <header style={{ padding: "16px 16px 0" }}>
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          Leaderboard
        </h2>
        <div
          role="tablist"
          aria-label="Leaderboard views"
          style={{
            display: "flex",
            gap: 6,
            marginTop: 14,
            overflowX: "auto",
            paddingBottom: 12,
          }}
        >
          {TABS.map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => onTab(t.id)}
                style={{
                  height: 30,
                  padding: "0 12px",
                  borderRadius: tokens.radiusPill,
                  border: active ? "none" : tokens.borderSoft,
                  background: active ? tokens.brandGradient : "transparent",
                  color: active ? "#fff" : tokens.textMuted,
                  fontFamily: tokens.fontSans,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </header>

      {/* Rows */}
      <ul style={{ listStyle: "none", margin: 0, padding: "4px 8px 12px" }}>
        {rows.map((row) => {
          const isTop = row.rank <= 3
          return (
            <li
              key={row.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 8px",
                borderRadius: tokens.radiusCard,
                background: isTop ? tokens.card : "transparent",
                border: isTop ? tokens.borderSoft : "0.5px solid transparent",
                marginBottom: 2,
              }}
            >
              <RankBadge rank={row.rank} />
              <LevelRingMini
                level={row.level}
                progress={row.levelProgress}
                track={row.track}
                avatarUrl={row.avatarUrl}
                name={row.name}
              />

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: tokens.textFaint,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.handle}
                  </span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <TrackChip track={row.track} />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 2,
                }}
              >
                <span
                  style={{
                    fontFamily: tokens.fontMono,
                    fontSize: 14,
                    fontWeight: 700,
                    color: valueColor(tab),
                  }}
                >
                  {row.value.toLocaleString()}
                  <span
                    style={{
                      fontSize: 10,
                      color: tokens.textFaint,
                      marginLeft: 3,
                      fontWeight: 500,
                    }}
                  >
                    {valueSuffix(tab)}
                  </span>
                </span>
                {typeof row.delta === "number" && (
                  <RankDeltaChip delta={row.delta} />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
