"use client"

import { useEffect, useState } from "react"
import type { Badge } from "@/lib/badge-data"
import { tierColorVar } from "@/lib/badge-data"

interface PendingRevealStripProps {
  badges: Badge[]
}

/**
 * PendingRevealStrip — used inside the depth-reveal moment.
 * "While you were building..." label + up to 4 small badge tiles that pop in
 * sequentially (80ms stagger, scale 0.8 → 1).
 */
export function PendingRevealStrip({ badges }: PendingRevealStripProps) {
  const shown = badges.slice(0, 4)
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    setRevealed(0)
    const timers = shown.map((_, i) =>
      setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), 120 + i * 80),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badges])

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">While you were building…</p>
      <div className="flex items-center justify-center gap-3">
        {shown.map((badge, i) => {
          const Icon = badge.icon
          const accent = badge.variant === "tiered" && badge.tier ? tierColorVar[badge.tier] : "var(--ring)"
          const isOn = i < revealed
          return (
            <div
              key={badge.id}
              className="flex flex-col items-center gap-1.5"
              style={{
                transform: isOn ? "scale(1)" : "scale(0.8)",
                opacity: isOn ? 1 : 0,
                transition: "transform 280ms cubic-bezier(0.34,1.56,0.64,1), opacity 220ms ease-out",
              }}
            >
              <span
                className="flex size-12 items-center justify-center rounded-xl ring-1 ring-border"
                style={{ color: accent, backgroundColor: `color-mix(in oklch, ${accent} 16%, transparent)` }}
              >
                <Icon className="size-6" strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span className="max-w-16 text-[10px] font-medium leading-tight text-foreground text-balance">
                {badge.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
