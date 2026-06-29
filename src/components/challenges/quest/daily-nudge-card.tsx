import { ArrowRight, MessageCircle } from "lucide-react"
import {
  colors,
  radius,
  semantic,
  cardSurface,
  withAlpha,
} from "./tokens"
import type { Challenge, ChallengeState } from "./types"
import ClaimButton from "./claim-button"

export interface DailyNudgeCardProps {
  challenge: Challenge
  state: ChallengeState
  onGo?: (challenge: Challenge) => void
  onClaim?: (challenge: Challenge) => void
}

/**
 * DailyNudgeCard — the single L1 daily nudge. Compact card with icon,
 * label, +XP chip, and Go→ / Claim states.
 */
export default function DailyNudgeCard({
  challenge,
  state,
  onGo,
  onClaim,
}: DailyNudgeCardProps) {
  return (
    <div
      className="flex items-center gap-3 p-3"
      style={{
        ...cardSurface,
        background: colors.card,
        borderColor:
          state === "claimable"
            ? withAlpha(colors.amber, 0.4)
            : colors.borderSoft,
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center"
        style={{
          borderRadius: radius.card,
          background: withAlpha(colors.amber, 0.16),
          color: colors.amber,
        }}
      >
        <MessageCircle size={18} strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: colors.amber }}>
          Today
        </p>
        <p
          className="truncate text-sm font-semibold"
          style={{ color: colors.textPrimary }}
        >
          {challenge.title}
        </p>
      </div>

      {/* XP chip */}
      <span
        className="shrink-0 px-2.5 py-1 font-mono text-xs font-semibold"
        style={{
          borderRadius: radius.pill,
          background: withAlpha(colors.orange, 0.14),
          color: semantic.xp,
        }}
      >
        +{challenge.xp} XP
      </span>

      {state === "go" ? (
        <button
          type="button"
          onClick={() => onGo?.(challenge)}
          className="inline-flex shrink-0 items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-transform hover:scale-105"
          style={{
            borderRadius: radius.pill,
            background: colors.input,
            color: colors.textPrimary,
            border: `0.5px solid ${colors.borderStrong}`,
          }}
        >
          Go
          <ArrowRight size={13} strokeWidth={2.5} />
        </button>
      ) : (
        <ClaimButton
          xp={challenge.xp}
          claimed={state === "claimed"}
          onClaim={() => onClaim?.(challenge)}
        />
      )}
    </div>
  )
}
