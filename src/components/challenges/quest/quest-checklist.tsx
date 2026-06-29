import { useMemo } from "react"
import {
  ArrowRight,
  Check,
  Mail,
  UserCircle,
  Bookmark,
  MessageCircle,
  FileText,
  Lightbulb,
  CalendarCheck,
  X,
  Trophy,
  Sparkles,
} from "lucide-react"
import {
  colors,
  orangeGradient,
  radius,
  semantic,
  shellSurface,
  withAlpha,
} from "./tokens"
import type { QuestStep, CreatorMark } from "./types"

export interface QuestChecklistProps {
  steps: QuestStep[]
  onGo?: (step: QuestStep) => void
  onDismiss?: () => void
  /** present + all steps complete → celebration final state */
  completedMark?: CreatorMark
}

const ICONS: Record<string, typeof Mail> = {
  "verify-email": Mail,
  "complete-profile": UserCircle,
  "save-posts": Bookmark,
  "first-comment": MessageCircle,
  "publish-draft": FileText,
  "todays-nudge": Lightbulb,
  "come-back": CalendarCheck,
}

function StepIcon({ id }: { id: string }) {
  const Icon = ICONS[id] ?? Sparkles
  return <Icon size={16} strokeWidth={2} />
}

export default function QuestChecklist({
  steps,
  onGo,
  onDismiss,
  completedMark,
}: QuestChecklistProps) {
  const totalXp = useMemo(
    () => steps.reduce((s, step) => s + step.xp, 0),
    [steps],
  )
  const earnedXp = useMemo(
    () =>
      steps
        .filter((s) => s.status === "completed")
        .reduce((s, step) => s + step.xp, 0),
    [steps],
  )
  const completedCount = steps.filter((s) => s.status === "completed").length
  const allDone = steps.length > 0 && completedCount === steps.length
  const pct = totalXp === 0 ? 0 : Math.round((earnedXp / totalXp) * 100)

  // ---- Final celebration state ----
  if (allDone && completedMark) {
    const accent = colors.orange
    return (
      <section
        aria-label="Quest complete"
        className="relative overflow-hidden p-8 text-center"
        style={shellSurface}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 50% 0%, ${withAlpha(
              colors.orange,
              0.18,
            )} 0%, transparent 60%)`,
          }}
        />
        <div className="relative flex flex-col items-center gap-4">
          <div
            className="flex h-20 w-20 items-center justify-center"
            style={{
              borderRadius: radius.pill,
              background: orangeGradient,
              boxShadow: `0 10px 40px ${withAlpha(colors.orange, 0.5)}`,
              animation: "qc-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            <Trophy size={36} strokeWidth={2} color="#FFFFFF" />
          </div>

          <div>
            <h2
              className="text-balance text-xl font-bold"
              style={{ color: colors.textPrimary }}
            >
              Quest complete — you&apos;re a NeoScale creator
            </h2>
            <p
              className="mt-1 text-sm"
              style={{ color: colors.textSecondary }}
            >
              You earned every step. Welcome to the community.
            </p>
          </div>

          {/* CreatorMark pop-in */}
          <div
            className="mt-1 flex items-center gap-3 px-4 py-2.5"
            style={{
              borderRadius: radius.pill,
              background: withAlpha(accent, 0.1),
              border: `0.5px solid ${withAlpha(accent, 0.4)}`,
              animation:
                "qc-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.25s both",
            }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center"
              style={{ borderRadius: radius.pill, background: accent }}
            >
              <Sparkles size={15} color="#FFFFFF" strokeWidth={2.5} />
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: colors.textPrimary }}
            >
              {completedMark.name}
            </span>
            <span
              className="font-mono text-xs"
              style={{ color: semantic.xp }}
            >
              +{totalXp} XP
            </span>
          </div>
        </div>

        <style>{`
          @keyframes qc-pop {
            0% { transform: scale(0.4); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </section>
    )
  }

  // ---- Active quest line ----
  return (
    <section aria-label="Become a creator quest" className="p-6" style={shellSurface}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center"
            style={{
              borderRadius: radius.card,
              background: orangeGradient,
              boxShadow: `0 6px 18px ${withAlpha(colors.orange, 0.35)}`,
            }}
          >
            <Trophy size={20} color="#FFFFFF" strokeWidth={2} />
          </span>
          <div>
            <h2
              className="text-lg font-bold leading-tight"
              style={{ color: colors.textPrimary }}
            >
              Become a creator
            </h2>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              {completedCount} of {steps.length} steps ·{" "}
              <span className="font-mono" style={{ color: semantic.xp }}>
                {earnedXp}/{totalXp} XP
              </span>
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss quest"
            className="flex h-7 w-7 items-center justify-center transition-colors"
            style={{
              borderRadius: radius.pill,
              color: colors.textMuted,
              border: `0.5px solid ${colors.borderSoft}`,
            }}
          >
            <X size={14} />
          </button>
        )}
      </header>

      {/* overall progress bar */}
      <div className="mt-4">
        <div
          className="h-2 w-full overflow-hidden"
          style={{ borderRadius: radius.pill, background: colors.input }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              borderRadius: radius.pill,
              background: orangeGradient,
              boxShadow: `0 0 12px ${withAlpha(colors.orange, 0.6)}`,
            }}
          />
        </div>
      </div>

      {/* steps */}
      <ul className="mt-4 flex flex-col gap-2">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} onGo={onGo} />
        ))}
      </ul>
    </section>
  )
}

function StepRow({
  step,
  onGo,
}: {
  step: QuestStep
  onGo?: (step: QuestStep) => void
}) {
  if (step.status === "completed") {
    return (
      <li
        className="flex items-center gap-3 px-3 py-2"
        style={{ borderRadius: radius.card }}
      >
        <span
          className="flex h-5 w-5 items-center justify-center"
          style={{ borderRadius: radius.pill, background: semantic.xp }}
        >
          <Check size={12} color="#FFFFFF" strokeWidth={3} />
        </span>
        <span
          className="flex-1 text-sm line-through"
          style={{ color: colors.textMuted }}
        >
          {step.label}
        </span>
        <span className="font-mono text-xs" style={{ color: colors.textMuted }}>
          +{step.xp}
        </span>
      </li>
    )
  }

  if (step.status === "active") {
    return (
      <li
        className="flex items-center gap-3 px-3 py-3"
        style={{
          borderRadius: radius.card,
          background: withAlpha(colors.orange, 0.08),
          border: `0.5px solid ${withAlpha(colors.orange, 0.35)}`,
        }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center"
          style={{
            borderRadius: radius.card,
            background: withAlpha(colors.orange, 0.18),
            color: colors.orange,
          }}
        >
          <StepIcon id={step.id} />
        </span>
        <div className="flex-1">
          <span
            className="text-sm font-semibold"
            style={{ color: colors.textPrimary }}
          >
            {step.label}
          </span>
          <span
            className="ml-2 font-mono text-xs"
            style={{ color: semantic.xp }}
          >
            +{step.xp} XP
          </span>
        </div>
        <button
          type="button"
          onClick={() => onGo?.(step)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-transform hover:scale-105"
          style={{
            borderRadius: radius.pill,
            background: orangeGradient,
            color: "#FFFFFF",
            boxShadow: `0 4px 14px ${withAlpha(colors.orange, 0.35)}`,
          }}
        >
          Go
          <ArrowRight size={13} strokeWidth={2.5} />
        </button>
      </li>
    )
  }

  // future
  return (
    <li
      className="flex items-center gap-3 px-3 py-2"
      style={{ borderRadius: radius.card }}
    >
      <span
        className="flex h-5 w-5 items-center justify-center"
        style={{
          borderRadius: radius.pill,
          border: `1.5px solid ${colors.locked}`,
        }}
      />
      <span className="flex-1 text-sm" style={{ color: colors.locked }}>
        {step.label}
      </span>
      <span className="font-mono text-xs" style={{ color: colors.locked }}>
        +{step.xp}
      </span>
    </li>
  )
}
