"use client"

import { useMemo, useState } from "react"
import type { Badge, BadgeCategory } from "@/lib/badge-data"
import { BadgeTile } from "@/components/badge-tile"
import { HiddenBadgeSlot } from "@/components/hidden-badge-slot"
import { BadgeDetailModal } from "@/components/badge-detail-modal"
import { cn } from "@/lib/utils"

interface CabinetGridProps {
  badges: Badge[]
}

type FilterKey = "all" | "earned" | "locked" | BadgeCategory
type SortKey = "default" | "rarity" | "recent" | "name"

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "earned", label: "Earned" },
  { key: "locked", label: "Locked" },
  { key: "creation", label: "Creation" },
  { key: "community", label: "Community" },
  { key: "mastery", label: "Mastery" },
  { key: "milestone", label: "Milestone" },
  { key: "seasonal", label: "Seasonal" },
]

const sorts: { key: SortKey; label: string }[] = [
  { key: "default", label: "Recommended" },
  { key: "rarity", label: "Rarest first" },
  { key: "recent", label: "Recently earned" },
  { key: "name", label: "Name A–Z" },
]

/**
 * CabinetGrid — the L2 surface. R1 spec with filters + sort. Hidden + unearned
 * badges render as HiddenBadgeSlots so criteria stay secret.
 */
export function CabinetGrid({ badges }: CabinetGridProps) {
  const [filter, setFilter] = useState<FilterKey>("all")
  const [sort, setSort] = useState<SortKey>("default")
  const [selected, setSelected] = useState<Badge | null>(null)
  const [open, setOpen] = useState(false)

  const earnedCount = badges.filter((b) => b.earned).length

  const visible = useMemo(() => {
    let list = [...badges]

    if (filter === "earned") list = list.filter((b) => b.earned)
    else if (filter === "locked") list = list.filter((b) => !b.earned)
    else if (filter !== "all") list = list.filter((b) => b.category === filter)

    list.sort((a, b) => {
      switch (sort) {
        case "rarity":
          return (a.rarityPct ?? 999) - (b.rarityPct ?? 999)
        case "recent":
          return (b.earnedDate ? Date.parse(b.earnedDate) : 0) - (a.earnedDate ? Date.parse(a.earnedDate) : 0)
        case "name":
          return a.name.localeCompare(b.name)
        default:
          return Number(b.earned) - Number(a.earned)
      }
    })
    return list
  }, [badges, filter, sort])

  function handleSelect(badge: Badge) {
    setSelected(badge)
    setOpen(true)
  }

  return (
    <section aria-labelledby="cabinet-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <h2 id="cabinet-heading" className="text-lg font-semibold tracking-tight text-foreground">
            Trophy cabinet
          </h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs font-medium text-secondary-foreground">
            {earnedCount}/{badges.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Every badge you can chase, including a few well-kept secrets.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter badges">
          {filters.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sorts.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No badges match this filter yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((badge) =>
            badge.variant === "hidden" && !badge.earned ? (
              <HiddenBadgeSlot key={badge.id} />
            ) : (
              <BadgeTile key={badge.id} badge={badge} onSelect={handleSelect} />
            ),
          )}
        </div>
      )}

      <BadgeDetailModal badge={selected} open={open} onOpenChange={setOpen} />
    </section>
  )
}
