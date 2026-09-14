"use client"

import type { Badge } from "./badge-data"
import { legacyTier, tierFill } from "@/lib/theme/progress"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
          <h2
            id="showcase-heading"
            className="text-sm font-semibold tracking-tight"
            style={{ color: t.text }}
          >
            Showcase
          </h2>
          {autoPinned ? (
            <span
              className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              style={{
                borderRadius: r.chip,
                background: tierFill("rare").background,
                border: `1px solid ${tierFill("rare").borderColor}`,
                color: t.text2,
              }}
            >
              Auto-pinned
            </span>
          ) : null}
        </div>
        {isOwnProfile && !autoPinned ? (
          <button
            type="button"
            onClick={onManage}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium transition-colors"
            style={{ borderRadius: r.chip, color: t.text2 }}
          >
            <Settings2 className="size-3.5" aria-hidden="true" />
            Manage
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {shown.map((badge) => {
          const Icon = badge.icon
          /**
           * BG-P28b. `tierColorVar` used to be a `var(--tier-*)` that nothing
           * defined, and this tile spent it as BOTH the icon colour and, at 14%,
           * the ground — so an unbroken version of it would have painted the
           * icon in the same hue as the fill behind it.
           *
           * The rung supplies both halves as a measured PAIR instead: a top-rung
           * tile is an amber fill with `--on-lit` on it, and an untiered badge
           * falls to the middle rung rather than to shadcn's `--ring`.
           */
          const rung = tierFill(
            badge.variant === "tiered" && badge.tier ? legacyTier(badge.tier) : "rare",
          )
          const tileClass =
            "flex size-14 items-center justify-center transition-transform hover:-translate-y-0.5"
          const tileStyle = {
            borderRadius: r.card,
            color: rung.color,
            background: rung.background,
            border: `1px solid ${rung.borderColor}`,
          }

          if (autoPinned) {
            return (
              <Tooltip key={badge.id}>
                <TooltipTrigger
                  type="button"
                  aria-label={`${badge.name}, auto-pinned`}
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
            <div key={badge.id} className={tileClass} style={tileStyle} title={badge.name}>
              <Icon className="size-7" strokeWidth={1.6} aria-hidden="true" />
            </div>
          )
        })}

        {Array.from({ length: emptyCount }).map((_, i) => (
          <div
            key={`empty-${i}`}
            aria-hidden="true"
            className={cn(
              "flex size-14 items-center justify-center",
              autoPinned && "opacity-40",
            )}
            style={{
              borderRadius: r.card,
              border: `1px dashed ${t.line}`,
              color: t.text2,
            }}
          >
            <Plus className="size-5" />
          </div>
        ))}
      </div>
    </section>
  )
}
