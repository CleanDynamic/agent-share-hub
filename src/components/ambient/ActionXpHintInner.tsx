import { useEffect, useState } from "react"
import { tokens, xpColor } from "./tokens"

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
  color = xpColor,
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
        fontFamily: tokens.fontMono,
        fontSize: 13,
        fontWeight: 700,
        color,
        textShadow: "0 1px 6px rgba(0,0,0,0.45)",
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
