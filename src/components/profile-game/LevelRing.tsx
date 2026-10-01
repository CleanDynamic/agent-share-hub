import type { CSSProperties, ReactNode } from "react"
import { OrbRing } from "@/components/brand/OrbRing"

export interface LevelRingProps {
  level: number
  progressPct: number
  size?: number
  /**
   * @deprecated Ignored since UI-P10. The ring is `--lit` — light, never a
   * track's colour — and the level is said in the centre and in the label. The
   * prop stays so no call site has to change.
   */
  color?: string
  style?: CSSProperties
  /** When provided, replaces the centre level number with custom content (used to wrap avatars). */
  children?: ReactNode
}

/**
 * The level ring, as the design kit's ring orb (UI-P10): a glass disc inside a
 * `--lit` arc that fills clockwise from the top. Same footprint as before —
 * `size` × `size` — so no layout moves; the arc's thickness follows the old
 * stroke (7.5% of the size) and stops at the orb's 9px.
 */
export default function LevelRing({ level, progressPct, size = 80, style, children }: LevelRingProps) {
  const clamped = Math.min(100, Math.max(0, progressPct))
  const thickness = Math.min(9, Math.max(2, Math.round(size * 0.075)))

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size, ...style }}
    >
      <OrbRing
        size={size}
        percent={clamped}
        value={level}
        caption="level"
        label={`Level ${level}, ${Math.round(clamped)}% of the way to level ${level + 1}`}
        thickness={thickness}
      >
        {children}
      </OrbRing>
    </div>
  )
}
