import { useState } from "react"
import { Lock, type LucideIcon } from "lucide-react"

import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { elevation } from "@/lib/theme/elevation"
import { tokens, sans, nodeState, type NodeState } from "./tokens"

export interface SkillNodeProps {
  state: NodeState
  perkIcon: LucideIcon
  tierLabel: string
  /**
   * Retained so the canvas's call site does not have to change. It is no
   * longer spent: the node's colour comes from its STATE, not from its track —
   * see the note below.
   */
  trackColor?: string
  onClick?: () => void
}

/**
 * One node on the skill tree. Repainted onto the ladder by BG-P28b.
 *
 * THE THREE NODE STATES ARE THE THREE RUNGS, which is the whole point of
 * giving this surface a shared module rather than a private palette:
 *
 *   locked     `--text2` on `--recess` — present and legible, not yet yours.
 *   available  a `--line` border, no fill — the invitation.
 *   unlocked   the `--lit` fill with `--on-lit` on it — the light.
 *
 * They come from `nodeState` in this folder's tokens, which is built from
 * `tierFill()`, so a skill node and a badge tile cannot drift apart.
 *
 * WHAT WENT. Every node used to be painted by `trackColor` — one of four track
 * hues — so the tree was a rainbow keyed to an identity rather than to
 * progress, and an unlocked node carried `#fff` type on it. Three effects went
 * with it:
 *
 *   · THE 18px GLOW under an unlocked node. A glow needs darkness to glow
 *     against; on Exhibition it read as a sticker on a wall, which is the
 *     failure this prompt exists to avoid. The node is a solid amber mark and
 *     carries itself.
 *   · THE PULSING 4px→7px RING on an available node, which animated
 *     `box-shadow` — the one property the motion rules name as forbidden,
 *     because it cannot be composited. The invitation is now carried by the
 *     border alone, which is what a border is for.
 *   · THE INLINE <style> BLOCK that defined the pulse, interpolating a colour
 *     into a keyframe on every render.
 *
 * The hover label was `rgba(20,20,28,0.95)` — a near-black chip that on
 * Exhibition was a dark hole in a lit room. It is a raised glass surface now.
 */
export default function SkillNode({
  state,
  perkIcon: PerkIcon,
  tierLabel,
  onClick,
}: SkillNodeProps) {
  const [hover, setHover] = useState(false)
  const size = 56

  const rung = nodeState[state]

  const base: React.CSSProperties = {
    width: size,
    height: size,
    // A node is a circle, which is the one thing --r-full is for.
    borderRadius: r.full,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    transition: "transform 0.15s ease",
    transform: hover ? "scale(1.06)" : "scale(1)",
  }

  const inner: React.CSSProperties = {
    background: rung.background,
    // `available` reads as the invitation, so its hairline is doubled to 2px.
    // Locked and unlocked keep 1px, and the ring is the same width in every
    // state so nothing moves when a node unlocks.
    border: `${state === "available" ? 2 : 1}px solid ${rung.borderColor}`,
    opacity: rung.opacity,
  }

  const icon =
    state === "locked" ? (
      <Lock size={22} color={rung.color as string} strokeWidth={2} />
    ) : (
      <PerkIcon
        size={state === "unlocked" ? 24 : 22}
        color={rung.color as string}
        strokeWidth={state === "unlocked" ? 2.25 : 2}
      />
    )

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={tierLabel}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick?.()
        }}
        style={{ ...base, ...inner }}
      >
        {icon}
      </div>

      {state === "available" && hover && (
        <div
          style={{
            position: "absolute",
            bottom: size + 8,
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            padding: "5px 10px",
            borderRadius: r.chip,
            fontSize: 11,
            fontFamily: sans,
            color: t.text,
            background: t.glass,
            border: tokens.border,
            ...elevation.raised,
            zIndex: 5,
          }}
        >
          {tierLabel}
        </div>
      )}
    </div>
  )
}
