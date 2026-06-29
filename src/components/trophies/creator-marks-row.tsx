import type { CreatorMark } from "@/lib/badge-data"
import { CreatorMarkTile } from "@/components/creator-mark-tile"

interface CreatorMarksRowProps {
  marks: CreatorMark[]
}

/**
 * CreatorMarksRow — the L1 trophies surface. Horizontal row of up to 8
 * CreatorMarkTiles (earned first, then invitations) under a "Your marks"
 * header with an earned count.
 */
export function CreatorMarksRow({ marks }: CreatorMarksRowProps) {
  const ordered = [...marks]
    .map((m) => ({ ...m, earned: Boolean(m.earnedDate) }))
    .sort((a, b) => Number(b.earned) - Number(a.earned))
    .slice(0, 8)

  const earnedCount = ordered.filter((m) => m.earned).length

  return (
    <section aria-labelledby="creator-marks-heading" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 id="creator-marks-heading" className="text-lg font-semibold tracking-tight text-foreground">
            Your marks
          </h2>
          <span className="rounded-full bg-mark/15 px-2 py-0.5 text-xs font-medium text-mark">
            {earnedCount} earned
          </span>
        </div>
        <p className="hidden text-sm text-muted-foreground sm:block">Warm milestones from your first steps</p>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {ordered.map((mark) => (
          <CreatorMarkTile key={mark.id} mark={mark} earned={mark.earned} hint={mark.hint} />
        ))}
      </div>
    </section>
  )
}
