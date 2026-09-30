"use client"

import type { Badge } from "./badge-data"
import { BadgeMark } from "./BadgeMark"
import { ring } from "@/lib/theme/controls"
import { useInteractive } from "@/lib/theme/interactive"
import { r } from "@/lib/theme/radius"

interface BadgeTileProps {
  badge: Badge
  onSelect?: (badge: Badge) => void
}

/**
 * BadgeTile — the cabinet's button around one BadgeMark. The mark carries the
 * tier treatment and the accessible name ("<name>, <tier> badge"); the button
 * has no paint of its own, only the theme's one focus ring (STATES.md row 9),
 * so a keyboard user sees the ring and nobody sees a second edge.
 */
export function BadgeTile({ badge, onSelect }: BadgeTileProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>()

  return (
    <button
      type="button"
      onClick={() => onSelect?.(badge)}
      {...handlers}
      data-testid={`badge-tile-${badge.id}`}
      style={{
        display: "block",
        width: "100%",
        margin: 0,
        padding: 0,
        border: 0,
        background: "none",
        color: "inherit",
        font: "inherit",
        cursor: "pointer",
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      <BadgeMark badge={badge} />
    </button>
  )
}
