"use client"

import type { Badge } from "./badge-data"
import { badgeLabel, badgePaint } from "./BadgeMark"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { r } from "@/lib/theme/radius"
import { cn } from "@/lib/utils"
import { Plus, Settings2 } from "lucide-react"

interface ShowcaseStripProps {
  badges: Badge[]
  /** Whether this is the viewer's own profile (shows dashed empties + Manage). */
  isOwnProfile?: boolean
  /** L1: when true, render an "auto" tooltip on hover and hide the Manage affordance. */
  autoPinned?: boolean
  onManage?: () => void
}

const MAX = 5

/**
 * ShowcaseStrip — R1 spec. Profile strip, max 5, dashed empties on own profile.
 * PLUS autoPinned: when true (L1), each slot gets a tiny "auto" tooltip on hover
 * and the Manage affordance is suppressed.
 */
export function ShowcaseStrip({ badges, isOwnProfile = true, autoPinned = false, onManage }: ShowcaseStripProps) {
  const shown = badges.slice(0, MAX)
  const emptyCount = isOwnProfile ? Math.max(0, MAX - shown.length) : 0

  return (
    <section aria-labelledby="showcase-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="showcase-heading" className="text-sm font-semibold tracking-tight text-foreground">
            Showcase
          </h2>
          {autoPinned ? (
            <span className="rounded-full bg-mark/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-mark">
              Auto-pinned
            </span>
          ) : null}
        </div>
        {isOwnProfile && !autoPinned ? (
          <button
            type="button"
            onClick={onManage}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Settings2 className="size-3.5" aria-hidden="true" />
            Manage
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {shown.map((badge) => {
          const Icon = badge.icon
          // One treatment for every badge of a tier: BadgeMark's, by weight and fill.
          const tileClass = "flex size-14 items-center justify-center transition-transform hover:-translate-y-0.5"
          const tileStyle = { ...badgePaint(badge.tier, badge.earned), borderRadius: r.chip }

          if (autoPinned) {
            return (
              <Tooltip key={badge.id}>
                <TooltipTrigger
                  type="button"
                  aria-label={`${badgeLabel(badge, badge.earned)}, auto-pinned`}
                  className={tileClass}
                  style={tileStyle}
                >
                  <Icon className="size-7" strokeWidth={1.6} aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>
                  <span className="font-medium">{badge.name}</span>
                  <span className="ml-1 text-muted-foreground">· auto</span>
                </TooltipContent>
              </Tooltip>
            )
          }

          return (
            <div
              key={badge.id}
              className={tileClass}
              style={tileStyle}
              title={badge.name}
              role="img"
              aria-label={badgeLabel(badge, badge.earned)}
            >
              <Icon className="size-7" strokeWidth={1.6} aria-hidden="true" />
            </div>
          )
        })}

        {Array.from({ length: emptyCount }).map((_, i) => (
          <div
            key={`empty-${i}`}
            aria-hidden="true"
            className={cn(
              "flex size-14 items-center justify-center border border-dashed border-border text-muted-foreground/50",
              autoPinned && "opacity-40",
            )}
            style={{ borderRadius: r.chip }}
          >
            <Plus className="size-5" />
          </div>
        ))}
      </div>
    </section>
  )
}
