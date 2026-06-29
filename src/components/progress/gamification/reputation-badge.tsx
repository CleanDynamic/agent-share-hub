import { ShieldCheck, ArrowUpRight } from "lucide-react"
import { colors, radius, glass, monoFont, withAlpha } from "./tokens"

export interface ReputationBadgeProps {
  /** Reputation score. */
  score: number
  /** Named tier, e.g. "Trusted", "Veteran". */
  tier: string
  /** Positive delta over the trailing period. */
  weeklyDelta?: number
}

export default function ReputationBadge({
  score,
  tier,
  weeklyDelta = 0,
}: ReputationBadgeProps) {
  return (
    <section
      className="flex items-center gap-4 p-5"
      style={{
        background: colors.card,
        border: `0.5px solid ${colors.borderStrong}`,
        borderRadius: radius.card,
        ...glass,
      }}
    >
      <span
        className="flex size-14 shrink-0 items-center justify-center"
        style={{
          background: withAlpha(colors.teal, 0.16),
          border: `0.5px solid ${withAlpha(colors.teal, 0.4)}`,
          borderRadius: radius.card,
        }}
      >
        <ShieldCheck size={28} color={colors.teal} />
      </span>

      <div className="flex flex-1 flex-col">
        <span
          className="text-xs uppercase tracking-wider"
          style={{ color: colors.textMuted }}
        >
          Reputation
        </span>
        <span
          className="text-3xl font-bold leading-none"
          style={{ fontFamily: monoFont, color: colors.teal }}
        >
          {score.toLocaleString()}
        </span>
        <span
          className="mt-1.5 inline-flex w-fit items-center px-2.5 py-0.5 text-xs font-medium"
          style={{
            background: withAlpha(colors.teal, 0.14),
            color: colors.teal,
            borderRadius: radius.pill,
          }}
        >
          {tier}
        </span>
      </div>

      {weeklyDelta > 0 && (
        <span className="flex flex-col items-end">
          <span
            className="inline-flex items-center gap-0.5 text-sm font-semibold"
            style={{ color: colors.green }}
          >
            <ArrowUpRight size={15} />
            <span style={{ fontFamily: monoFont }}>
              +{weeklyDelta.toLocaleString()}
            </span>
          </span>
          <span className="text-xs" style={{ color: colors.textFaint }}>
            this week
          </span>
        </span>
      )}
    </section>
  )
}
