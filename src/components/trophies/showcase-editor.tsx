"use client"

import { useState } from "react"
import type { Badge } from "./badge-data"
import { tierColorVar } from "./badge-data"
import { cn } from "@/lib/utils"
import { GripVertical, X } from "lucide-react"

interface ShowcaseEditorProps {
  badges: Badge[]
  onChange?: (badges: Badge[]) => void
}

/**
 * ShowcaseEditor — R1 spec. Drag-to-reorder showcase management (L2 only).
 */
export function ShowcaseEditor({ badges, onChange }: ShowcaseEditorProps) {
  const [items, setItems] = useState<Badge[]>(badges)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function commit(next: Badge[]) {
    setItems(next)
    onChange?.(next)
  }

  function handleDrop(target: number) {
    if (dragIndex === null || dragIndex === target) return
    const next = [...items]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(target, 0, moved)
    commit(next)
    setDragIndex(null)
    setOverIndex(null)
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    commit(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">Drag to reorder, or use the arrows. The first five appear on your profile.</p>
      <ul className="flex flex-col gap-2">
        {items.map((badge, index) => {
          const Icon = badge.icon
          const accent = badge.variant === "tiered" && badge.tier ? tierColorVar[badge.tier] : "var(--ring)"
          return (
            <li
              key={badge.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                e.preventDefault()
                setOverIndex(index)
              }}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors",
                dragIndex === index && "opacity-50",
                overIndex === index && dragIndex !== index && "border-ring",
              )}
            >
              <span className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden="true">
                <GripVertical className="size-4" />
              </span>
              <span
                className="flex size-9 items-center justify-center rounded-lg ring-1 ring-border"
                style={{ color: accent, backgroundColor: `color-mix(in oklch, ${accent} 14%, transparent)` }}
              >
                <Icon className="size-5" strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span className="flex-1 text-sm font-medium text-foreground">{badge.name}</span>
              {index < 5 ? (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  On profile
                </span>
              ) : null}
              <span className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${badge.name} up`}
                  className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label={`Move ${badge.name} down`}
                  className="px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
              <button
                type="button"
                onClick={() => commit(items.filter((_, i) => i !== index))}
                aria-label={`Remove ${badge.name} from showcase`}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
