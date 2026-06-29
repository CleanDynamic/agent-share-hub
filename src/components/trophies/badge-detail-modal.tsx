"use client"

import type { Badge } from "./badge-data"
import { tierColorVar, tierLabel } from "./badge-data"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarCheck, Sparkles } from "lucide-react"

interface BadgeDetailModalProps {
  badge: Badge | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * BadgeDetailModal — R1 spec, including nullable rarityPct (hide the line when null).
 */
export function BadgeDetailModal({ badge, open, onOpenChange }: BadgeDetailModalProps) {
  if (!badge) return null

  const Icon = badge.icon
  const isTiered = badge.variant === "tiered" && badge.tier
  const accent = isTiered ? tierColorVar[badge.tier!] : "var(--ring)"
  const isHidden = badge.variant === "hidden" && !badge.earned

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-white/12 bg-shell sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <span
            className="mb-2 flex size-20 items-center justify-center rounded-2xl ring-1 ring-border"
            style={{
              color: badge.earned ? accent : "var(--muted-foreground)",
              backgroundColor: badge.earned
                ? `color-mix(in oklch, ${accent} 16%, transparent)`
                : "color-mix(in oklch, var(--muted) 60%, transparent)",
              filter: badge.earned ? undefined : "grayscale(1)",
            }}
          >
            <Icon className="size-10" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <DialogTitle className="text-xl">{badge.name}</DialogTitle>
          <DialogDescription className="text-balance">
            {isHidden ? "This badge is hidden. Its criteria are revealed only once earned." : badge.description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-2.5 text-sm">
          {isTiered ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <span className="text-muted-foreground">Tier</span>
              <span className="font-semibold" style={{ color: accent }}>
                {tierLabel[badge.tier!]}
              </span>
            </div>
          ) : null}

          {badge.seasonal ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <span className="text-muted-foreground">Season</span>
              <span className="font-medium text-foreground">{badge.seasonal}</span>
            </div>
          ) : null}

          {/* rarityPct is nullable — hide the line when null */}
          {badge.rarityPct !== null ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="size-3.5" aria-hidden="true" /> Rarity
              </span>
              <span className="font-mono font-medium text-foreground">
                {badge.rarityPct < 1 ? badge.rarityPct.toFixed(1) : badge.rarityPct.toFixed(0)}% of creators
              </span>
            </div>
          ) : null}

          {badge.earned && badge.earnedDate ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarCheck className="size-3.5" aria-hidden="true" /> Earned
              </span>
              <span className="font-medium text-foreground">{badge.earnedDate}</span>
            </div>
          ) : null}

          {!badge.earned && typeof badge.progress === "number" ? (
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-muted-foreground">{badge.progressLabel ?? "Progress"}</span>
                <span className="font-mono font-medium text-foreground">{badge.progress}%</span>
              </div>
              <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-ring" style={{ width: `${badge.progress}%` }} />
              </span>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
