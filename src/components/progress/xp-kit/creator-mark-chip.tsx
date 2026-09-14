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
  const tint = "linear-gradient(135deg, color-mix(in srgb, var(--lit) 20%, transparent) 0%, color-mix(in srgb, var(--action) 22%, transparent) 100%)"

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
          border: "0.5px solid color-mix(in srgb, var(--action) 45%, transparent)",
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
        border: "0.5px solid color-mix(in srgb, var(--action) 45%, transparent)",
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
