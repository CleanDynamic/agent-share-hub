import { Check } from "lucide-react"
import { colors, radius, semantic, tracks, withAlpha } from "./tokens"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { xpText } from "@/lib/theme/progress"
import type { ChallengeHistoryEntry } from "./types"

export interface ChallengeHistoryRowProps {
  entry: ChallengeHistoryEntry
}

export default function ChallengeHistoryRow({
  entry,
}: ChallengeHistoryRowProps) {
  /**
   * A ROW IN THIS LIST IS A COMPLETED CHALLENGE, so it is `--evidence` — the
   * token the plaque already uses for "this worked" — rather than the track's
   * own colour. The four tracks used to carry four hues; they resolve to one
   * light now (see the ladder), which would have made every row amber and
   * every row's label amber TYPE. Evidence says the true thing and says it
   * legally in both rooms.
   */
  const accent = colors.teal
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5"
      style={{
        borderBottom: `0.5px solid ${colors.borderSoft}`,
      }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center"
        style={{
          borderRadius: r.full,
          background: t.evidenceFill,
          color: accent,
        }}
      >
        <Check size={13} strokeWidth={3} />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm"
          style={{ color: colors.textPrimary }}
        >
          {entry.title}
        </p>
        {entry.track && (
          <span className="text-xs" style={{ color: colors.textSecondary }}>
            {entry.track}
          </span>
        )}
      </div>

      <span
        className="shrink-0 text-xs"
        style={{ color: colors.textMuted }}
      >
        {entry.completedAt}
      </span>
      <span
        className="w-14 shrink-0 text-right font-mono text-xs font-semibold"
        style={xpText("secondary")}
      >
        +{entry.xp} XP
      </span>
    </div>
  )
}
