import { tokens, fontSans } from "./tokens"
import RepDial from "./rep-dial"
import RepVsXpCard from "./rep-vs-xp-card"
import RepBreakdownPanel from "./rep-breakdown-panel"
import RepHistorySparkline from "./rep-history-sparkline"
import RepTooltip from "./rep-tooltip"

const SAMPLE = {
  score: 78,
  level: 32,
  parts: [
    { label: "Saves", share: 41 },
    { label: "Remixes", share: 27 },
    { label: "Accepted solutions", share: 19 },
    { label: "Weighted votes", share: 13 },
  ],
  history: [52, 55, 54, 58, 61, 60, 64, 67, 69, 72, 75, 78],
}

/**
 * ReputationDemo — composes the full Reputation UI with realistic data.
 * Default export so it can be dropped onto a page directly.
 */
export default function ReputationDemo() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#25252F",
        padding: "48px 24px",
        fontFamily: fontSans,
        color: tokens.text,
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <header style={{ marginBottom: 32 }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Reputation
            </h1>
            <RepTooltip />
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: tokens.textMuted }}>
            A quality signal, kept separate from XP on purpose.
          </p>
        </header>

        {/* Hero: dial inside a shell card */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "28px 20px 16px",
            marginBottom: 20,
            borderRadius: tokens.radiusPanel,
            border: tokens.borderStrong,
            background: tokens.shell,
            ...tokens.glass,
          }}
        >
          <RepDial score={SAMPLE.score} />
        </div>

        {/* Grid of panels */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          <RepVsXpCard level={SAMPLE.level} rep={SAMPLE.score} />
          <RepHistorySparkline points={SAMPLE.history} />
          <RepBreakdownPanel parts={SAMPLE.parts} />
        </div>
      </div>
    </div>
  )
}
