import { useRef, useState } from "react"
import { Sparkles, type LucideIcon } from "lucide-react"
import { tokens, sans, type TrackId, type NodeState } from "./tokens"
import SkillNode from "./skill-node"

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
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: tokens.brandGradient,
            boxShadow: `0 0 24px color-mix(in srgb, ${tokens.brandOrange} 55%, transparent)`,
            flexShrink: 0,
          }}
        >
          <Sparkles size={26} color="#fff" strokeWidth={2} />
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
                  background: unlocked
                    ? trackColor
                    : "rgba(255,255,255,0.12)",
                  boxShadow: unlocked
                    ? `0 0 8px color-mix(in srgb, ${trackColor} 60%, transparent)`
                    : "none",
                  animation: unlocked
                    ? "linePulse 2.4s ease-in-out infinite"
                    : "none",
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
                    color: unlocked ? trackColor : tokens.textFaint,
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

      <style>{`@keyframes linePulse {
        0%,100% { opacity: 1; }
        50% { opacity: 0.55; }
      }`}</style>

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
