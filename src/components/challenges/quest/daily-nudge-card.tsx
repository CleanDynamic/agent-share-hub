import { ArrowRight, MessageCircle } from "lucide-react"
import {
  colors,
  radius,
  semantic,
  cardSurface,
  withAlpha,
} from "./tokens"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { tierFill, xpText } from "@/lib/theme/progress"
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
        /**
         * A CLAIMABLE CARD IS BORDERED `--action`, NOT AMBER (BG-P28b).
         * This border carries state — it is the difference between "there is
         * something to collect here" and "there is not" — and an amber
         * state-carrying border is exactly what the theme forbids on a light
         * ground, where --lit measures 3.01:1. `--action` is both legal and
         * more accurate: a claimable nudge IS the primary thing to do.
         */
        borderColor: state === "claimable" ? t.action : colors.borderSoft,
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center"
        style={{
          borderRadius: radius.card,
          background: tierFill("highest").background,
          color: tierFill("highest").color,
        }}
      >
        <MessageCircle size={18} strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: colors.textSecondary }}
        >
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
          // THE ONE AMBER-FILLED ELEMENT on this card. The figure was amber
          // TYPE on an orange wash; it is the light as a FILL now, with the
          // measured --on-lit label on it.
          borderRadius: r.chip,
          background: tierFill("highest").background,
          ...xpText("onLit"),
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
            borderRadius: r.control,
            background: t.glass,
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
