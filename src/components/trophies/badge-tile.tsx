"use client"

import type { Badge } from "./badge-data"
import { tierColorVar, tierLabel } from "./badge-data"
import { cn } from "@/lib/utils"
import { Lock } from "lucide-react"

interface BadgeTileProps {
  badge: Badge
  onSelect?: (badge: Badge) => void
}

/**
 * BadgeTile — R1 spec. Supports tiered / hidden-earned / seasonal / category
 * variants, with earned vs greyscale-progress states.
 */
export function BadgeTile({ badge, onSelect }: BadgeTileProps) {
  const Icon = badge.icon
  const isTiered = badge.variant === "tiered" && badge.tier
  const accent = isTiered ? tierColorVar[badge.tier!] : "var(--ring)"

  return (
    <button
      type="button"
      onClick={() => onSelect?.(badge)}
      aria-label={`${badge.name}${badge.earned ? ", earned" : ", in progress"}`}
      className={cn(
        "group relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        badge.earned
          ? "border-border bg-card hover:-translate-y-0.5 hover:border-ring/50"
          : "border-border/60 bg-card/40 hover:border-border",
      )}
    >
      {/* tier ring accent */}
      {isTiered ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl opacity-60"
          style={{
            background: badge.earned
              ? `radial-gradient(110% 80% at 50% -10%, color-mix(in oklch, ${accent} 26%, transparent), transparent 65%)`
              : "none",
          }}
        />
      ) : null}

      <span
        className={cn(
          "relative flex size-12 items-center justify-center rounded-full ring-1 transition",
          badge.earned ? "ring-border" : "ring-border/50",
        )}
        style={{
          color: badge.earned ? accent : "var(--muted-foreground)",
          backgroundColor: badge.earned
            ? `color-mix(in oklch, ${accent} 14%, transparent)`
            : "color-mix(in oklch, var(--muted) 60%, transparent)",
          filter: badge.earned ? undefined : "grayscale(1)",
        }}
      >
        <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
        {!badge.earned ? (
          <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground">
            <Lock className="size-2.5" aria-hidden="true" />
          </span>
        ) : null}
      </span>

      <span
        className={cn(
          "line-clamp-2 text-xs font-medium leading-tight text-balance",
          badge.earned ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {badge.name}
      </span>

      {isTiered ? (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: accent, backgroundColor: `color-mix(in oklch, ${accent} 16%, transparent)` }}
        >
          {tierLabel[badge.tier!]}
        </span>
      ) : badge.seasonal ? (
        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
          {badge.seasonal}
        </span>
      ) : null}

      {/* greyscale-progress bar */}
      {!badge.earned && typeof badge.progress === "number" ? (
        <span className="absolute inset-x-3 bottom-2 h-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-ring transition-all"
            style={{ width: `${badge.progress}%` }}
          />
        </span>
      ) : null}
    </button>
  )
}
