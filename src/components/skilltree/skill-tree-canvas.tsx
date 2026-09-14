import { useRef, useState } from "react"
import { Sparkles, type LucideIcon } from "lucide-react"
import { tokens, sans, type TrackId, type NodeState } from "./tokens"
import SkillNode from "./skill-node"
import { r } from "@/lib/theme/radius"
import { t as tok } from "@/lib/theme/tokens"
import { tierFill } from "@/lib/theme/progress"

export interface TierNode {
  tier: number
  perkName: string
  perkIcon: LucideIcon
}

export interface SkillTreeCanvasProps {
  track: TrackId
  trackColor: string
  tiers: TierNode[]
  unlockedTier: number
  onNodeClick?: (tier: number) => void
}

export default function SkillTreeCanvas({
  trackColor,
  tiers,
  unlockedTier,
  onNodeClick,
}: SkillTreeCanvasProps) {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  )
  const [dragging, setDragging] = useState(false)

  function stateFor(tier: number): NodeState {
    if (tier <= unlockedTier) return "unlocked"
    if (tier === unlockedTier + 1) return "available"
    return "locked"
  }

  function onDown(x: number, y: number) {
    drag.current = { x, y, px: pan.x, py: pan.y }
    setDragging(true)
  }
  function onMove(x: number, y: number) {
    if (!drag.current) return
    setPan({
      x: drag.current.px + (x - drag.current.x),
      y: drag.current.py + (y - drag.current.y),
    })
  }
  function onUp() {
    drag.current = null
    setDragging(false)
  }

  const nodeGap = 150

  return (
    <div
      onMouseDown={(e) => onDown(e.clientX, e.clientY)}
      onMouseMove={(e) => onMove(e.clientX, e.clientY)}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={(e) =>
        onDown(e.touches[0].clientX, e.touches[0].clientY)
      }
      onTouchMove={(e) =>
        onMove(e.touches[0].clientX, e.touches[0].clientY)
      }
      onTouchEnd={onUp}
      style={{
        position: "relative",
        width: "100%",
        height: 320,
        borderRadius: tokens.radiusPanel,
        background: tokens.shell,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        border: tokens.border,
        overflow: "hidden",
        cursor: dragging ? "grabbing" : "grab",
        fontFamily: sans,
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 40,
          transform: `translate(${pan.x}px, calc(-50% + ${pan.y}px))`,
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* origin node */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: r.full,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // The root of the tree is an unlocked node, so it takes the same
            // top rung every unlocked node takes. Its 24px orange glow went
            // with every other glow on this surface: a glow needs darkness to
            // glow against, and Exhibition has none to offer it.
            background: tierFill("highest").background,
            flexShrink: 0,
          }}
        >
          <Sparkles size={26} color={tierFill("highest").color} strokeWidth={2} />
        </div>

        {tiers.map((t, i) => {
          const unlocked = t.tier <= unlockedTier
          return (
            <div
              key={t.tier}
              style={{ display: "flex", alignItems: "center" }}
            >
              {/* connector line */}
              <div
                style={{
                  width: nodeGap - 56,
                  height: 1.5,
                  /**
                   * CONNECTORS ARE `--line` AND NEVER GLOW (BG-P28b), in both
                   * states. A lit, pulsing connector made the tree read as a
                   * circuit board rather than as a sequence, and the pulse
                   * animated opacity on a line nobody was asked to watch. The
                   * line's job is "this follows from that", which is a
                   * hairline's job everywhere else in the product; whether a
                   * tier is reached is said by the NODES it joins.
                   */
                  background: tok.line,
                  margin: "0 0",
                }}
              />
              <div style={{ textAlign: "center" }}>
                <SkillNode
                  state={stateFor(t.tier)}
                  perkIcon={t.perkIcon}
                  trackColor={trackColor}
                  tierLabel={`Unlocks at Tier ${t.tier}`}
                  onClick={() => onNodeClick?.(t.tier)}
                />
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: unlocked ? tok.text : tokens.textFaint,
                  }}
                >
                  Tier {t.tier}
                </div>
              </div>
              <span style={{ display: "none" }}>{i}</span>
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 10,
          right: 14,
          fontSize: 10,
          color: tokens.textFaint,
        }}
      >
        Drag to pan
      </div>
    </div>
  )
}
