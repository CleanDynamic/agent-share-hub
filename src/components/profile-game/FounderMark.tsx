import type { CSSProperties } from "react"
import { Crown } from "lucide-react"
import { tierFill, tokens } from "./tokens"

export interface FounderMarkProps {
  /** Optional override label. */
  label?: string
  /** When provided, renders compact "Founder · #N". */
  memberNumber?: number
  style?: CSSProperties
}

/**
 * R1 — L1 scarcity identity. Crown chip shipped day one. Reinforces the
 * "first 100" founding-member status as part of identity formation.
 */
export default function FounderMark({
  label,
  memberNumber,
  style,
}: FounderMarkProps) {
  const text =
    label ??
    (typeof memberNumber === "number"
      ? `Founder · #${memberNumber}`
      : "Founding member — first 100")
  return (
    <span
      className="inline-flex items-center gap-2 self-start"
      style={{
        height: 30,
        padding: "0 14px",
        /**
         * BG-P28b. A founder mark is the rarest thing a profile can carry, so
         * it takes the ladder's TOP rung rather than `--action`: it is an
         * achievement, not the primary thing to do. This is also what makes it
         * agree with the level marker beside it, which is the whole point of
         * task 6 — both are amber fills with `--on-lit` on them.
         */
        borderRadius: tokens.radius.pill,
        background: tierFill("highest").background,
        border: tokens.border.soft,
        fontFamily: tokens.font.sans,
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        /* The measured label for an `--action` ground. White was legal on one
           of the two orange values and on neither ground. */
        color: tierFill("highest").color,
        ...style,
      }}
    >
      <Crown size={15} color={tierFill("highest").color} strokeWidth={2.25} aria-hidden />
      {text}
    </span>
  )
}
