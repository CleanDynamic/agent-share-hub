import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Snowflake } from "lucide-react"
import { BORDER, COLORS, FONT, HEAT_RAMP, RADIUS } from "./tokens"

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

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

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

  // Pad the front so day 1 lands on the correct weekday. June 2026 starts Monday.
  const leadingPad = 1

  return (
    <section
      style={{
        background: COLORS.card,
        border: BORDER.hairline,
        borderRadius: RADIUS.panel,
        padding: 20,
        fontFamily: FONT.sans,
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

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}
      >
        {WEEKDAYS.map((d, i) => (
          <div
            key={`wd-${i}`}
            className="flex items-center justify-center"
            style={{ fontSize: 11, fontWeight: 500, color: COLORS.textFaint, height: 18 }}
          >
            {d}
          </div>
        ))}

        {Array.from({ length: leadingPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {data.map((day) => {
          const dayNum = Number(day.date.slice(-2))
          const bg = day.frozen ? "rgba(46,196,182,0.18)" : HEAT_RAMP[Math.min(day.level, 4)]
          return (
            <div
              key={day.date}
              title={`${day.date}${day.frozen ? " · frozen" : ` · level ${day.level}`}`}
              className="relative flex items-center justify-center"
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 7,
                background: bg,
                border: day.frozen
                  ? "0.5px solid rgba(46,196,182,0.45)"
                  : "0.5px solid rgba(255,255,255,0.06)",
              }}
            >
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  color: day.level >= 3 ? COLORS.text : COLORS.textMuted,
                }}
              >
                {dayNum}
              </span>
              {day.frozen && (
                <Snowflake
                  size={9}
                  strokeWidth={2}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    color: COLORS.reputationTeal,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
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
