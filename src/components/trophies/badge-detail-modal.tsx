"use client"

import type { Badge } from "./badge-data"
import { tierLabel } from "./badge-data"
import { badgeLabel, badgePaint } from "./BadgeMark"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { r } from "@/lib/theme/radius"
import { CalendarCheck } from "lucide-react"

interface BadgeDetailModalProps {
  badge: Badge | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * BadgeDetailModal — one badge: its mark, what earns it, its tier in words, and
 * whether and when it was earned.
 */
export function BadgeDetailModal({ badge, open, onOpenChange }: BadgeDetailModalProps) {
  if (!badge) return null

  const Icon = badge.icon
  // XP-DESIGN.md gives what earns a badge as a fragment ("publish a build"); here it opens a sentence.
  const earnedBy = badge.description.charAt(0).toUpperCase() + badge.description.slice(1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-white/12 bg-shell sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <span
            className="mb-2 flex size-20 items-center justify-center"
            role="img"
            aria-label={badgeLabel(badge, badge.earned)}
            style={{ ...badgePaint(badge.tier, badge.earned), borderRadius: r.chip }}
          >
            <Icon className="size-10" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <DialogTitle className="text-xl">{badge.name}</DialogTitle>
          <DialogDescription className="text-balance">{earnedBy}</DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-2.5 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <span className="text-muted-foreground">Tier</span>
            <span className="font-semibold text-foreground">{tierLabel[badge.tier]}</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarCheck className="size-3.5" aria-hidden="true" /> Earned
            </span>
            <span className="font-medium text-foreground">
              {badge.earned ? (badge.earnedDate ?? "Yes") : "Not yet"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
