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
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { progressFill, tierFill, xpText } from "@/lib/theme/progress"
import {
  colors,
  radius,
  semantic,
  shellSurface,
  withAlpha,
} from "./tokens"
import type { QuestStep, CreatorMark } from "./types"

/* ── BG-P28b ────────────────────────────────────────────────────────────────
   THREE RULES DECIDE EVERY COLOUR BELOW, and each replaced a hue that was
   saying the wrong thing.

   1. XP IS NEVER AMBER TYPE. Four figures here were `color: semantic.xp`,
      which after the token repoint resolves to `--lit` — amber text, 3.01:1 on
      the Exhibition ground and the one thing the theme forbids outright. They
      take `xpText()` now: DM Mono, tabular, in `--text` or `--text2`. The amber
      moved to the things it can legally be — the quest medallion and the
      progress bar's fill, both of which are FILLS.

   2. A COMPLETED STEP IS `--evidence`, which is what the task asks for and
      what the plaque already uses for "this worked". The tick was an amber
      disc with a white glyph; it is a solid `--evidence` disc with the glyph
      in `--bg`, a pair that measures over 5:1 in both rooms (the token
      inverts across themes, and so does the ground, so they stay opposed).

   3. "GO" IS SECONDARY, "CLAIM" IS PRIMARY. The theme allows ONE primary
      action per view. Every active step used to render a `--action`-filled
      "Go", so a quest with three open steps shipped three primaries, and the
      daily nudge's Claim — the one genuinely primary act on this page — had
      to compete with them. Go is a glass secondary with a `--line` border now.

   The orange glow box-shadows went with them: a coloured glow under a button
   is decoration the system does not sanction, and on Exhibition it had nothing
   to glow against.
   ────────────────────────────────────────────────────────────────────────── */

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
    const accent = t.lit
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
              t.lit,
              0.18,
            )} 0%, transparent 60%)`,
          }}
        />
        <div className="relative flex flex-col items-center gap-4">
          <div
            className="flex h-20 w-20 items-center justify-center"
            data-bg-animated=""
            style={{
              // A circle, so --r-full is the legal step for it.
              borderRadius: r.full,
              background: tierFill("highest").background,
              animation: "bgQuestPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            <Trophy size={36} strokeWidth={2} color={tierFill("highest").color} />
          </div>

          <div>
            <h2
              className="text-balance text-xl font-bold"
              style={{ color: colors.textPrimary }}
            >
              Quest complete — you&apos;re a buildgallery creator
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
            data-bg-animated=""
            style={{
              borderRadius: r.chip,
              background: tierFill("rare").background,
              border: `0.5px solid ${tierFill("rare").borderColor}`,
              animation:
                "bgQuestPop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.25s both",
            }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center"
              style={{ borderRadius: r.full, background: accent }}
            >
              <Sparkles size={15} color={t.onLit} strokeWidth={2.5} />
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: colors.textPrimary }}
            >
              {completedMark.name}
            </span>
            <span className="text-xs" style={xpText("secondary")}>
              +{totalXp} XP
            </span>
          </div>
        </div>

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
              background: tierFill("highest").background,
            }}
          >
            <Trophy size={20} color={tierFill("highest").color} strokeWidth={2} />
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
              <span style={xpText("secondary")}>
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
              borderRadius: r.full,
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
              background: progressFill().background,
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
          style={{ borderRadius: r.full, background: semantic.completed }}
        >
          <Check size={12} color={t.bg} strokeWidth={3} />
        </span>
        <span
          className="flex-1 text-sm line-through"
          style={{ color: colors.textMuted }}
        >
          {step.label}
        </span>
        <span className="text-xs" style={xpText("secondary")}>
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
          background: tierFill("rare").background,
          border: `0.5px solid ${tierFill("rare").borderColor}`,
        }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center"
          style={{
            borderRadius: radius.card,
            background: t.glass2,
            color: colors.textSecondary,
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
          <span className="ml-2 text-xs" style={xpText("secondary")}>
            +{step.xp} XP
          </span>
        </div>
        <button
          type="button"
          onClick={() => onGo?.(step)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-transform hover:scale-105"
          style={{
            // SECONDARY. The page's one primary is the claim button; see the
            // note at the top of this file.
            borderRadius: r.control,
            background: t.glass,
            color: t.text,
            border: `0.5px solid ${t.line}`,
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
          borderRadius: r.full,
          border: `1.5px solid ${colors.borderSoft}`,
        }}
      />
      <span className="flex-1 text-sm" style={{ color: colors.locked }}>
        {step.label}
      </span>
      <span className="text-xs" style={xpText("secondary")}>
        +{step.xp}
      </span>
    </li>
  )
}
