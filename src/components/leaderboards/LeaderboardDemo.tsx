import { useMemo, useState } from "react"
import { tokens } from "./tokens"
import type { LeaderboardRow, LeaderboardTab } from "./types"
import LeaderboardPanel from "./LeaderboardPanel"
import YourRankRow from "./YourRankRow"
import MiniLeaderboard from "./MiniLeaderboard"
import LeaderboardEmptyState from "./LeaderboardEmptyState"

const WEEK_ROWS: LeaderboardRow[] = [
  { id: "1", rank: 1, name: "Mara Okafor", handle: "@mara", level: 24, levelProgress: 0.7, track: "Architect", value: 4820, delta: 2 },
  { id: "2", rank: 2, name: "Devin Park", handle: "@dpark", level: 22, levelProgress: 0.35, track: "Mentor", value: 4510, delta: 0 },
  { id: "3", rank: 3, name: "Ines Caro", handle: "@inescaro", level: 21, levelProgress: 0.9, track: "Curator", value: 4180, delta: -1 },
  { id: "4", rank: 4, name: "Sam Whitfield", handle: "@samw", level: 20, levelProgress: 0.5, track: "Explorer", value: 3760, delta: 3 },
  { id: "5", rank: 5, name: "Lena Voss", handle: "@lvoss", level: 19, levelProgress: 0.2, track: "Architect", value: 3540, delta: 1 },
  { id: "6", rank: 6, name: "Tariq Hassan", handle: "@tariq", level: 18, levelProgress: 0.6, track: "Mentor", value: 3290, delta: -2 },
  { id: "7", rank: 7, name: "Priya Nair", handle: "@priya", level: 17, levelProgress: 0.45, track: "Curator", value: 3015, delta: 4 },
]

const REP_ROWS: LeaderboardRow[] = [
  { id: "2", rank: 1, name: "Devin Park", handle: "@dpark", level: 22, levelProgress: 0.35, track: "Mentor", value: 9820, delta: 1 },
  { id: "1", rank: 2, name: "Mara Okafor", handle: "@mara", level: 24, levelProgress: 0.7, track: "Architect", value: 9410, delta: -1 },
  { id: "6", rank: 3, name: "Tariq Hassan", handle: "@tariq", level: 18, levelProgress: 0.6, track: "Mentor", value: 8730, delta: 2 },
  { id: "3", rank: 4, name: "Ines Caro", handle: "@inescaro", level: 21, levelProgress: 0.9, track: "Curator", value: 8120, delta: 0 },
  { id: "5", rank: 5, name: "Lena Voss", handle: "@lvoss", level: 19, levelProgress: 0.2, track: "Architect", value: 7640, delta: 3 },
]

/**
 * Demo composing the full Leaderboards surface with realistic sample data.
 */
export default function LeaderboardDemo() {
  const [tab, setTab] = useState<LeaderboardTab>("week")

  const rows = useMemo(() => {
    return tab === "reputation" ? REP_ROWS : WEEK_ROWS
  }, [tab])

  const yourUnit = tab === "reputation" ? "reputation" : "XP this week"
  const yourValue = tab === "reputation" ? 2140 : 380

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 24,
        maxWidth: 880,
        margin: "0 auto",
        padding: 24,
        fontFamily: tokens.fontSans,
      }}
    >
      {/* Two-up: full panel + side widgets */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <LeaderboardPanel tab={tab} rows={rows} onTab={setTab} />
          <YourRankRow rank={42} value={yourValue} unitLabel={yourUnit} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <MiniLeaderboard rows={WEEK_ROWS} onSeeAll={() => setTab("week")} />
          <LeaderboardEmptyState />
        </div>
      </div>
    </div>
  )
}
