import { Check } from "lucide-react"
import { colors, radius, semantic, tracks, withAlpha } from "./tokens"
import type { ChallengeHistoryEntry } from "./types"

export interface ChallengeHistoryRowProps {
  entry: ChallengeHistoryEntry
}

export default function ChallengeHistoryRow({
  entry,
}: ChallengeHistoryRowProps) {
  const accent = entry.track ? tracks[entry.track] : colors.teal
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
          borderRadius: radius.pill,
          background: withAlpha(accent, 0.16),
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
          <span className="text-xs" style={{ color: accent }}>
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
        style={{ color: semantic.xp }}
      >
        +{entry.xp} XP
      </span>
    </div>
  )
}
