import { Target } from "lucide-react"
import {
  colors,
  orangeGradient,
  radius,
  semantic,
  cardSurface,
  withAlpha,
} from "./tokens"
import type { WeeklyChallenge, ChallengeState } from "./types"
import ClaimButton from "./claim-button"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { tierFill, xpText } from "@/lib/theme/progress"

export interface WeeklyChallengeCardProps {
  challenge: WeeklyChallenge
  onClaim?: (challenge: WeeklyChallenge) => void
}

export default function WeeklyChallengeCard({
  challenge,
  onClaim,
}: WeeklyChallengeCardProps) {
  const pct = Math.min(
    100,
    Math.round((challenge.progress / challenge.goal) * 100),
  )
  const state: ChallengeState = challenge.state

  return (
    <div
      className="p-4"
      style={{
        ...cardSurface,
        background: colors.card,
        borderColor: withAlpha(colors.purple, 0.32),
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center"
          style={{
            // `colors.purple` marked a TRACK and resolves to --lit now, so
            // this medallion was an amber wash with amber glyph on it. The
            // rung supplies a measured ground/label pair instead.
            borderRadius: radius.card,
            background: tierFill("rare").background,
            color: tierFill("rare").color,
          }}
        >
          <Target size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                borderRadius: r.chip,
                background: tierFill("rare").background,
                border: `1px solid ${tierFill("rare").borderColor}`,
                color: t.text2,
              }}
            >
              Weekly
            </span>
            <span
              className="text-xs"
              style={{
                ...xpText("onLit"),
                background: tierFill("highest").background,
                borderRadius: r.chip,
                padding: "1px 6px",
              }}
            >
              +{challenge.xp} XP
            </span>
          </div>
          <h3
            className="mt-1.5 text-sm font-semibold"
            style={{ color: colors.textPrimary }}
          >
            {challenge.title}
          </h3>
          <p className="text-xs" style={{ color: colors.textSecondary }}>
            {challenge.description}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden"
          style={{ borderRadius: radius.pill, background: colors.input }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              borderRadius: radius.pill,
              background:
                state === "claimable"
                  ? orangeGradient
                  : withAlpha(colors.purple, 0.9),
            }}
          />
        </div>
        <span
          className="shrink-0 font-mono text-xs"
          style={{ color: colors.textSecondary }}
        >
          {challenge.progress}/{challenge.goal}
        </span>
      </div>

      {state !== "go" && (
        <div className="mt-3 flex justify-end">
          <ClaimButton
            xp={challenge.xp}
            claimed={state === "claimed"}
            onClaim={() => onClaim?.(challenge)}
          />
        </div>
      )}
    </div>
  )
}
