import type { CSSProperties } from "react"
import { Crown } from "lucide-react"
import { tokens } from "./tokens"

export interface FounderMarkProps {
  /** Optional override label. */
  label?: string
  style?: CSSProperties
}

/**
 * R1 — L1 scarcity identity. Crown chip shipped day one. Reinforces the
 * "first 100" founding-member status as part of identity formation.
 */
export default function FounderMark({
  label = "Founding member — first 100",
  style,
}: FounderMarkProps) {
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
        color: "#FFFFFF",
        boxShadow: "0 2px 12px rgba(232,87,26,0.35)",
        ...style,
      }}
    >
      <Crown size={15} color="#FFFFFF" strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  )
}
