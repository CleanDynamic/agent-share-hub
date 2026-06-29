import { Trophy } from "lucide-react"
import { tokens } from "./tokens"

/**
 * Pre-flag state shown if Leaderboards are rendered before the population
 * justifies turning them on.
 */
export default function LeaderboardEmptyState() {
  return (
    <section
      style={{
        ...tokens.glass,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
        padding: "40px 24px",
        background: tokens.shell,
        border: tokens.borderStrong,
        borderRadius: tokens.radiusPanel,
        fontFamily: tokens.fontSans,
        color: tokens.textPrimary,
      }}
      aria-label="Leaderboards open soon"
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: tokens.radiusPill,
          background: `${tokens.brand}1F`,
          border: `0.5px solid ${tokens.brand}59`,
          color: tokens.brand,
        }}
      >
        <Trophy size={22} aria-hidden />
      </span>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
        Leaderboards open soon
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: tokens.textMuted,
          maxWidth: 220,
          lineHeight: 1.5,
        }}
      >
        Keep earning — your standing is being tracked and will appear here.
      </p>
    </section>
  )
}
