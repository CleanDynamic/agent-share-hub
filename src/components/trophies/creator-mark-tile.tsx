import type { CreatorMark } from "./badge-data"
import { cn } from "@/lib/utils"

interface CreatorMarkTileProps {
  mark: CreatorMark
  earned: boolean
  /** One-line "how to earn" invitation, shown only when unearned. */
  hint: string
}

/**
 * CreatorMarkTile — larger, warmer cousin of a badge tile (110×130px).
 * Earned: amber-orange tinted card. Unearned: soft outline tile with an
 * invitation, never greyscale — at L1 unearned marks are invitations.
 */
export function CreatorMarkTile({ mark, earned, hint }: CreatorMarkTileProps) {
  const Icon = mark.icon

  if (earned) {
    return (
      <div
        className="flex h-[130px] w-[110px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-mark-border bg-mark-surface px-2 py-3 text-center transition-transform duration-200 hover:-translate-y-0.5"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 50% -10%, color-mix(in oklch, var(--mark) 22%, transparent), transparent 70%)",
        }}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-mark/15 text-mark ring-1 ring-mark-border">
          <Icon className="size-[36px] p-0.5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="text-[12px] font-semibold leading-tight text-foreground text-balance">{mark.name}</span>
        {mark.earnedDate ? (
          <span className="text-[10px] leading-none text-mark-muted">{mark.earnedDate}</span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex h-[130px] w-[110px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-mark-border/60 bg-transparent px-2 py-3 text-center transition-colors duration-200 hover:border-mark-border hover:bg-mark-surface/40">
      <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-mark-border/70 text-mark-muted">
        <Icon className="size-[28px]" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span className="text-[12px] font-semibold leading-tight text-foreground/90 text-balance">{mark.name}</span>
      <span className={cn("text-[10px] leading-tight text-mark-muted text-balance")}>{hint}</span>
    </div>
  )
}
