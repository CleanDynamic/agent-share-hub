import type { LucideIcon } from "lucide-react"
import { tokens } from "./tokens"

export interface CreatorMark {
  icon: LucideIcon
  name: string
}

export interface CreatorMarkChipProps {
  mark: CreatorMark
  /** 'full' shows icon + name; 'minimal' shows icon only with a tooltip */
  variant?: "full" | "minimal"
}

/** A small warm identity chip used beside names and on profiles. */
export default function CreatorMarkChip({ mark, variant = "full" }: CreatorMarkChipProps) {
  const Icon = mark.icon
  const tint = "linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(232,87,26,0.22) 100%)"

  if (variant === "minimal") {
    return (
      <span
        title={mark.name}
        aria-label={mark.name}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: tint,
          border: "0.5px solid rgba(232,87,26,0.45)",
          color: tokens.orange,
          cursor: "help",
          verticalAlign: "middle",
        }}
      >
        <Icon size={16} />
      </span>
    )
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: tokens.radiusPill,
        background: tint,
        border: "0.5px solid rgba(232,87,26,0.45)",
        fontFamily: tokens.fontSans,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: tokens.amber,
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} color={tokens.orange} />
      <span>{mark.name}</span>
    </span>
  )
}
