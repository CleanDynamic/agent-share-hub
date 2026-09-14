import { useEffect, useState } from "react"
import { tokens } from "./tokens"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { elevation } from "@/lib/theme/elevation"
import { tierFill, xpText } from "@/lib/theme/progress"

export interface ActionXpHintProps {
  /** XP amount to float up, e.g. 2. */
  amount: number
  /**
   * Increment a counter each time you want to fire the hint
   * (e.g. on every click). Changing this re-triggers the animation.
   */
  trigger: number
  /** Colour of the floating value. Defaults to XP orange. */
  color?: string
  /** Horizontal offset from the anchor centre, in px. */
  offsetX?: number
}

/**
 * ActionXpHint — a tiny "+N" that floats up and fades off an engagement
 * button. Designed to be placed inside a `position: relative` wrapper. L1.
 */
export default function ActionXpHint({
  amount,
  trigger,
  color = undefined,
  offsetX = 0,
}: ActionXpHintProps) {
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (trigger <= 0) return
    setAnimating(true)
    const t = setTimeout(() => setAnimating(false), 750)
    return () => clearTimeout(t)
  }, [trigger])

  return (
    <span
      aria-hidden="true"
      key={trigger}
      className="pointer-events-none absolute left-1/2 top-0 select-none"
      style={{
        /**
         * BG-P28b. This floats over whatever button triggered it — a save, a
         * follow, a publish — so it appears over every ground in the product.
         * It was amber type propped up by a black text-shadow, which is the
         * dark-room way of making an illegal colour survive; on Exhibition the
         * shadow just smudged it. It is set as data in --text, like every other
         * XP figure.
         */
        ...xpText(),
        fontSize: 13,
        fontWeight: 500,
        ...(color ? { color } : null),
        transform: `translateX(calc(-50% + ${offsetX}px)) translateY(${animating ? -22 : -2}px)`,
        opacity: animating ? 0 : trigger > 0 ? 1 : 0,
        transition: animating
          ? "transform 700ms cubic-bezier(0.22,1,0.36,1), opacity 700ms ease-out"
          : "none",
      }}
    >
      +{amount}
    </span>
  )
}
