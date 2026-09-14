import type { CSSProperties } from "react"
import { Crown } from "lucide-react"
import { tokens } from "./tokens"

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
        borderRadius: tokens.radius.pill,
        background: tokens.brand.orangeGradient,
        border: tokens.border.soft,
        fontFamily: tokens.font.sans,
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        /* The measured label for an `--action` ground. White was legal on one
           of the two orange values and on neither ground. */
        color: tokens.brand.onOrange,
        ...style,
      }}
    >
      <Crown size={15} color={tokens.brand.onOrange} strokeWidth={2.25} aria-hidden />
      {text}
    </span>
  )
}
