import { useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { ActivityGrid, type ActivityDay } from "@/components/brand/ActivityGrid"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { FIGTREE } from "@/lib/theme/type"
import { BORDER, COLORS, RADIUS } from "./tokens"

export interface StreakDay {
  /** ISO date string, e.g. "2026-06-01". */
  date: string
  /** Activity level 0–4 driving heat intensity. */
  level: number
  /** Whether this day was kept alive by a freeze pass. */
  frozen?: boolean
}

export interface StreakCalendarProps {
  /** A month's worth of days. */
  days?: StreakDay[]
  /** Month label, e.g. "June 2026". */
  monthLabel?: string
  /** Pager handlers — omit to hide the relevant control. */
  onPrev?: () => void
  onNext?: () => void
  /** Disable forward navigation (e.g. current month). */
  canGoNext?: boolean
}

function buildSampleMonth(): StreakDay[] {
  // 30-day sample with varied activity + two frozen days.
  const levels = [
    2, 3, 1, 4, 0, 2, 3, 4, 4, 2, 0, 1, 3, 4, 2, 3, 4, 1, 0, 2, 3, 4, 4, 3, 2,
    1, 0, 3, 4, 2,
  ]
  return levels.map((level, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    level,
    frozen: i === 4 || i === 18, // the two zero-activity days were frozen
  }))
}

/**
 * StreakCalendar — L2 heatmap of activity. Frozen days are marked with a small
 * snowflake instead of reading as a broken day. Includes an optional month pager.
 */
export default function StreakCalendar({
  days,
  monthLabel = "June 2026",
  onPrev,
  onNext,
  canGoNext = false,
}: StreakCalendarProps) {
  const data = days ?? useMemo(buildSampleMonth, [])

  // UI-P12: the days are drawn as the activity grid — a column per week, `--lit`
  // by volume, a frozen day an outlined cell — so a month is five columns of
  // seven, filled from the first day, and carries no weekday header or numbers.
  const cells: ActivityDay[] = data.map((day) => ({
    count: day.frozen ? 0 : day.level,
    frozen: day.frozen,
    date: `${day.date}${day.frozen ? " · frozen" : ` · level ${day.level}`}`,
  }))

  return (
    <section
      style={{
        background: t.glass,
        border: `1px solid ${t.glassBorder}`,
        borderRadius: r.panel,
        padding: 20,
        fontFamily: FIGTREE,
        maxWidth: 360,
      }}
    >
      <header className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: COLORS.text,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {monthLabel}
        </h3>
        <div className="flex items-center gap-1">
          <PagerButton label="Previous month" onClick={onPrev} disabled={!onPrev}>
            <ChevronLeft size={16} />
          </PagerButton>
          <PagerButton
            label="Next month"
            onClick={onNext}
            disabled={!onNext || !canGoNext}
          >
            <ChevronRight size={16} />
          </PagerButton>
        </div>
      </header>

      <ActivityGrid days={cells} label={`${monthLabel}: ${cells.filter((c) => c.count > 0 || c.frozen).length} days kept`} />
    </section>
  )
}

function PagerButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center transition-opacity"
      style={{
        width: 28,
        height: 28,
        borderRadius: RADIUS.pill,
        background: COLORS.input,
        border: BORDER.hairline,
        color: COLORS.text,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  )
}
