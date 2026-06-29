import type { CSSProperties } from "react"
import type { LucideIcon } from "lucide-react"
import { tokens } from "./tokens"

export interface CreatorMark {
  id: string
  label: string
  icon: LucideIcon
  /** Optional accent override; defaults to teal reputation colour. */
  color?: string
  /** Renders the chip in a dimmed locked state. */
  locked?: boolean
}

export interface CreatorMarkChipProps {
  mark: CreatorMark
  style?: CSSProperties
}

/**
 * Small identity pill (Session A). Shown in a row of up to 3 under the name.
 */
export default function CreatorMarkChip({ mark, style }: CreatorMarkChipProps) {
  const Icon = mark.icon
  const color = mark.locked ? tokens.locked : mark.color ?? tokens.reputation

  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        height: 24,
        padding: "0 10px",
        borderRadius: tokens.radius.pill,
        background: "rgba(82,82,100,0.45)",
        border: tokens.border.soft,
        fontFamily: tokens.font.sans,
        fontSize: 12,
        fontWeight: 500,
        color: mark.locked ? tokens.locked : tokens.text.primary,
        ...style,
      }}
    >
      <Icon size={13} color={color} strokeWidth={2.25} aria-hidden />
      {mark.label}
    </span>
  )
}
