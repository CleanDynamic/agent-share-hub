import { useState } from "react"
import { Snowflake } from "lucide-react"
import { BORDER, COLORS, FONT, RADIUS } from "./tokens"

export interface FreezeIndicatorProps {
  /** Freezes available this month. */
  available?: number
  /** Total freeze passes per month. */
  total?: number
}

/**
 * FreezeIndicator — L2 only. Shows remaining freeze passes as snowflakes with a
 * tooltip explaining the monthly allowance. Lives beside the calendar.
 */
export default function FreezeIndicator({
  available = 2,
  total = 3,
}: FreezeIndicatorProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative inline-flex items-center gap-2"
      style={{ fontFamily: FONT.sans }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className="inline-flex items-center gap-2"
        style={{
          background: COLORS.card,
          border: BORDER.hairline,
          borderRadius: RADIUS.pill,
          padding: "6px 12px",
          cursor: "default",
        }}
        tabIndex={0}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`${available} of ${total} freeze passes remaining this month`}
      >
        {Array.from({ length: total }).map((_, i) => {
          const used = i >= available
          return (
            <Snowflake
              key={i}
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              style={{ color: used ? COLORS.locked : COLORS.reputationTeal }}
            />
          )
        })}
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            color: COLORS.textMuted,
            marginLeft: 2,
          }}
        >
          {available}/{total}
        </span>
      </div>

      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            width: 220,
            background: COLORS.shell,
            border: BORDER.hairlineStrong,
            borderRadius: RADIUS.card,
            padding: "10px 12px",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            fontSize: 12.5,
            lineHeight: 1.5,
            color: COLORS.text,
            zIndex: 20,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          Freeze passes keep your streak alive on a missed day. You get{" "}
          {total} a month — {available} left.
        </div>
      )}
    </div>
  )
}
