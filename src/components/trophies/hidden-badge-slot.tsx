import { HelpCircle } from "lucide-react"

/**
 * HiddenBadgeSlot — R1 spec. A "?" tile that reveals nothing: no criteria hints.
 */
export function HiddenBadgeSlot() {
  return (
    <div
      aria-label="Hidden badge, criteria undisclosed"
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-card/30 p-3 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground ring-1 ring-border/50">
        <HelpCircle className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="text-xs font-medium text-muted-foreground">Hidden</span>
      <span className="text-[10px] leading-tight text-muted-foreground/70">Keep building to reveal</span>
    </div>
  )
}
