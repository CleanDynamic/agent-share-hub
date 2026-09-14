import type { CreatorMark } from "./badge-data"
import { CreatorMarkTile } from "./creator-mark-tile"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { tierFill, xpText } from "@/lib/theme/progress"

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
          <h2
            id="creator-marks-heading"
            className="text-lg font-semibold tracking-tight"
            style={{ color: t.text }}
          >
            Your marks
          </h2>
          {/* BG-P28b: was `bg-mark/15 text-mark`, and neither --mark nor its
              Tailwind registration exists, so this chip has always rendered
              unstyled. It is a count, so it is set as data on the ladder's
              middle rung — the earned MARKS carry the light, not the tally. */}
          <span
            className="px-2 py-0.5 text-xs font-medium"
            style={{
              borderRadius: r.chip,
              background: tierFill("rare").background,
              border: `1px solid ${tierFill("rare").borderColor}`,
              ...xpText(),
            }}
          >
            {earnedCount} earned
          </span>
        </div>
        <p className="hidden text-sm sm:block" style={{ color: t.text2 }}>
          Warm milestones from your first steps
        </p>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {ordered.map((mark) => (
          <CreatorMarkTile key={mark.id} mark={mark} earned={mark.earned} hint={mark.hint} />
        ))}
      </div>
    </section>
  )
}
