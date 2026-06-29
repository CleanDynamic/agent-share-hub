import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Clock,
  MessageCircle,
  Share2,
  PenLine,
} from "lucide-react"
import {
  colors,
  radius,
  semantic,
  shellSurface,
  cardSurface,
  withAlpha,
} from "./tokens"
import type {
  Challenge,
  ChallengeState,
  WeeklyChallenge,
  ChallengeHistoryEntry,
} from "./types"
import ClaimButton from "./claim-button"
import WeeklyChallengeCard from "./weekly-challenge-card"
import ChallengeHistoryRow from "./challenge-history-row"

export interface ChallengesPanelProps {
  dailies: Challenge[]
  weekly: WeeklyChallenge
  history?: ChallengeHistoryEntry[]
  /** ISO timestamp the daily set resets at */
  resetAt: string
  /** show the 'new' dot on the Daily tab */
  hasNew?: boolean
  onGo?: (challenge: Challenge) => void
  onClaim?: (challenge: Challenge) => void
  onClaimWeekly?: (challenge: WeeklyChallenge) => void
}

const DAILY_ICONS: Record<string, typeof MessageCircle> = {
  comment: MessageCircle,
  share: Share2,
  draft: PenLine,
}

function useCountdown(resetAt: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const diff = Math.max(0, new Date(resetAt).getTime() - now)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

type Tab = "daily" | "history"

export default function ChallengesPanel({
  dailies,
  weekly,
  history = [],
  resetAt,
  hasNew = false,
  onGo,
  onClaim,
  onClaimWeekly,
}: ChallengesPanelProps) {
  const [tab, setTab] = useState<Tab>("daily")
  const countdown = useCountdown(resetAt)

  const claimableCount = useMemo(
    () => dailies.filter((d) => d.state === "claimable").length,
    [dailies],
  )

  return (
    <section aria-label="Challenges" className="p-5" style={shellSurface}>
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <TabButton
            active={tab === "daily"}
            onClick={() => setTab("daily")}
            label="Challenges"
            badge={claimableCount > 0 ? claimableCount : undefined}
            showDot={hasNew}
          />
          <TabButton
            active={tab === "history"}
            onClick={() => setTab("history")}
            label="History"
          />
        </div>

        <div
          className="flex items-center gap-1.5 px-2.5 py-1"
          style={{
            borderRadius: radius.pill,
            background: colors.input,
            border: `0.5px solid ${colors.borderSoft}`,
          }}
        >
          <Clock size={13} style={{ color: colors.textSecondary }} />
          <span
            className="font-mono text-xs"
            style={{ color: colors.textSecondary }}
          >
            {countdown}
          </span>
        </div>
      </header>

      {tab === "daily" ? (
        <div className="mt-4 flex flex-col gap-3">
          <p
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: colors.textMuted }}
          >
            Daily challenges
          </p>
          {dailies.map((d) => (
            <DailyRow
              key={d.id}
              challenge={d}
              onGo={onGo}
              onClaim={onClaim}
            />
          ))}

          <p
            className="mt-2 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: colors.textMuted }}
          >
            This week
          </p>
          <WeeklyChallengeCard challenge={weekly} onClaim={onClaimWeekly} />
        </div>
      ) : (
        <div className="mt-4">
          {history.length === 0 ? (
            <p
              className="py-8 text-center text-sm"
              style={{ color: colors.textMuted }}
            >
              No completed challenges yet.
            </p>
          ) : (
            <div
              style={{
                ...cardSurface,
                background: colors.card,
                overflow: "hidden",
              }}
            >
              {history.map((h) => (
                <ChallengeHistoryRow key={h.id} entry={h} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function TabButton({
  active,
  onClick,
  label,
  badge,
  showDot,
}: {
  active: boolean
  onClick: () => void
  label: string
  badge?: number
  showDot?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors"
      style={{
        borderRadius: radius.pill,
        background: active ? colors.input : "transparent",
        color: active ? colors.textPrimary : colors.textSecondary,
        border: active
          ? `0.5px solid ${colors.borderStrong}`
          : "0.5px solid transparent",
      }}
    >
      {label}
      {badge !== undefined && (
        <span
          className="flex h-4 min-w-4 items-center justify-center px-1 font-mono text-[10px] font-bold"
          style={{
            borderRadius: radius.pill,
            background: semantic.xp,
            color: "#FFFFFF",
          }}
        >
          {badge}
        </span>
      )}
      {showDot && (
        <span
          aria-label="new"
          className="absolute -right-0.5 -top-0.5 h-2 w-2"
          style={{
            borderRadius: radius.pill,
            background: colors.orange,
            boxShadow: `0 0 8px ${withAlpha(colors.orange, 0.8)}`,
          }}
        />
      )}
    </button>
  )
}

function DailyRow({
  challenge,
  onGo,
  onClaim,
}: {
  challenge: Challenge
  onGo?: (c: Challenge) => void
  onClaim?: (c: Challenge) => void
}) {
  const Icon = DAILY_ICONS[challenge.id] ?? MessageCircle
  const state: ChallengeState = challenge.state
  return (
    <div
      className="flex items-center gap-3 p-3"
      style={{
        ...cardSurface,
        background: colors.card,
        borderColor:
          state === "claimable"
            ? withAlpha(colors.orange, 0.4)
            : colors.borderSoft,
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center"
        style={{
          borderRadius: radius.card,
          background: withAlpha(colors.teal, 0.16),
          color: colors.teal,
        }}
      >
        <Icon size={17} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold"
          style={{ color: colors.textPrimary }}
        >
          {challenge.title}
        </p>
        {challenge.description && (
          <p className="truncate text-xs" style={{ color: colors.textSecondary }}>
            {challenge.description}
          </p>
        )}
      </div>
      <span
        className="shrink-0 px-2 py-0.5 font-mono text-xs font-semibold"
        style={{
          borderRadius: radius.pill,
          background: withAlpha(colors.orange, 0.14),
          color: semantic.xp,
        }}
      >
        +{challenge.xp}
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
