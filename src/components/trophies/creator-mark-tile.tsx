import type { CreatorMark } from "./badge-data"

import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { tierFill } from "@/lib/theme/progress"

interface CreatorMarkTileProps {
  mark: CreatorMark
  earned: boolean
  /** One-line "how to earn" invitation, shown only when unearned. */
  hint: string
}

/**
 * CreatorMarkTile — the larger, warmer cousin of a badge tile (110×130px).
 * Repainted onto the ladder by BG-P28b.
 *
 * EVERY COLOUR ON THIS TILE WAS A NO-OP. It was painted with `bg-mark/15`,
 * `text-mark`, `border-mark-border`, `bg-mark-surface`, `text-mark-muted` and a
 * `var(--mark)` radial — and NONE of `--mark`, `--mark-border`, `--mark-surface`
 * or `--mark-muted` is defined in `index.css` or registered in the Tailwind
 * config. So an earned mark rendered with no ground, no ring and inherited
 * text, which is why the "warm amber-orange tinted card" the old comment
 * describes has never actually appeared. This is the first paint it has had.
 *
 * THE TWO STATES ARE TWO RUNGS:
 *
 *   earned    the `highest` rung — an amber fill with `--on-lit` on it. This
 *             is the surface where the top rung belongs: a marks row is mostly
 *             invitations, so the few earned ones are exactly the scarce, lit
 *             thing von-Restorff wants you to remember.
 *   unearned  a dashed `--line` edge over nothing, with `--text2` type. Dashed
 *             because the theme's dashed edge means "deliberately unfilled,
 *             come and fill it" — an invitation, which is what the component's
 *             own comment says an unearned mark is, and never greyscale.
 *
 * The 110×130 box, the radii and the hover lift are untouched: this is a
 * repaint.
 */
export function CreatorMarkTile({ mark, earned, hint }: CreatorMarkTileProps) {
  const Icon = mark.icon

  if (earned) {
    const fill = tierFill("highest")
    return (
      <div
        className="flex h-[130px] w-[110px] shrink-0 flex-col items-center justify-center gap-2 px-2 py-3 text-center transition-transform duration-200 hover:-translate-y-0.5"
        style={{
          borderRadius: r.card,
          background: fill.background,
          border: `1px solid ${fill.borderColor}`,
          color: fill.color,
        }}
      >
        <span
          className="flex size-11 items-center justify-center"
          style={{ borderRadius: r.full, color: fill.color }}
        >
          <Icon className="size-[36px] p-0.5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span
          className="text-[12px] font-semibold leading-tight text-balance"
          style={{ color: fill.color }}
        >
          {mark.name}
        </span>
        {mark.earnedDate ? (
          <span className="text-[10px] leading-none" style={{ color: fill.color, opacity: 0.75 }}>
            {mark.earnedDate}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="flex h-[130px] w-[110px] shrink-0 flex-col items-center justify-center gap-1.5 px-2 py-3 text-center transition-colors duration-200"
      style={{
        borderRadius: r.card,
        background: "transparent",
        border: `1px dashed ${t.line}`,
      }}
    >
      <span
        className="flex size-11 items-center justify-center"
        style={{
          borderRadius: r.full,
          border: `1px dashed ${t.line}`,
          color: t.text2,
        }}
      >
        <Icon className="size-[28px]" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span
        className="text-[12px] font-semibold leading-tight text-balance"
        style={{ color: t.text }}
      >
        {mark.name}
      </span>
      <span className="text-[10px] leading-tight text-balance" style={{ color: t.text2 }}>
        {hint}
      </span>
    </div>
  )
}
