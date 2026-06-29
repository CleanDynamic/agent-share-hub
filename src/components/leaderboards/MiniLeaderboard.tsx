import { ArrowRight } from "lucide-react"
import { tokens, medalColor } from "./tokens"
import type { LeaderboardRow } from "./types"
import LevelRingMini from "./LevelRingMini"

export interface MiniLeaderboardProps {
  rows: LeaderboardRow[]
  onSeeAll?: () => void
}

/** Compact 3-row dashboard teaser widget. */
export default function MiniLeaderboard({
  rows,
  onSeeAll,
}: MiniLeaderboardProps) {
  const top = rows.slice(0, 3)

  return (
    <section
      style={{
        ...tokens.glass,
        background: tokens.shell,
        border: tokens.borderStrong,
        borderRadius: tokens.radiusPanel,
        padding: 14,
        fontFamily: tokens.fontSans,
        color: tokens.textPrimary,
      }}
      aria-label="Leaderboard preview"
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
          Leaderboard
        </h3>
        <button
          onClick={onSeeAll}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            background: "transparent",
            border: "none",
            color: tokens.brand,
            fontFamily: tokens.fontSans,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
          }}
        >
          See all
          <ArrowRight size={13} aria-hidden />
        </button>
      </header>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {top.map((row) => {
          const medal = medalColor[row.rank as 1 | 2 | 3]
          return (
            <li
              key={row.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 0",
              }}
            >
              <span
                style={{
                  width: 16,
                  textAlign: "center",
                  fontFamily: tokens.fontMono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: medal ?? tokens.textMuted,
                  flexShrink: 0,
                }}
                aria-label={`Rank ${row.rank}`}
              >
                {row.rank}
              </span>
              <LevelRingMini
                level={row.level}
                progress={row.levelProgress}
                track={row.track}
                avatarUrl={row.avatarUrl}
                name={row.name}
                size={28}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
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
                  fontFamily: tokens.fontMono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: tokens.brand,
                }}
              >
                {row.value.toLocaleString()}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
