import { useState } from "react"
import { Lock, type LucideIcon } from "lucide-react"
import { tokens, sans, type NodeState } from "./tokens"

export interface SkillNodeProps {
  state: NodeState
  perkIcon: LucideIcon
  tierLabel: string
  trackColor: string
  onClick?: () => void
}

export default function SkillNode({
  state,
  perkIcon: PerkIcon,
  tierLabel,
  trackColor,
  onClick,
}: SkillNodeProps) {
  const [hover, setHover] = useState(false)
  const size = 56

  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    transition: "transform 0.15s ease",
    transform: hover ? "scale(1.06)" : "scale(1)",
  }

  let inner: React.CSSProperties = {}
  let icon: React.ReactNode = null

  if (state === "locked") {
    inner = {
      background: "rgba(40,40,52,0.9)",
      border: tokens.border,
      opacity: 0.6,
    }
    icon = <Lock size={22} color={tokens.locked} strokeWidth={2} />
  } else if (state === "available") {
    inner = {
      background: "rgba(40,40,52,0.9)",
      border: `2px solid ${trackColor}`,
      boxShadow: `0 0 0 4px color-mix(in srgb, ${trackColor} 18%, transparent)`,
      animation: "skillPulse 2s ease-in-out infinite",
    }
    icon = <PerkIcon size={22} color={trackColor} strokeWidth={2} />
  } else {
    inner = {
      background: trackColor,
      border: `2px solid color-mix(in srgb, ${trackColor} 80%, #fff 20%)`,
      boxShadow: `0 0 18px color-mix(in srgb, ${trackColor} 65%, transparent)`,
    }
    icon = <PerkIcon size={24} color="#fff" strokeWidth={2.25} />
  }

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <style>{`@keyframes skillPulse {
        0%,100% { box-shadow: 0 0 0 4px color-mix(in srgb, ${trackColor} 18%, transparent); }
        50% { box-shadow: 0 0 0 7px color-mix(in srgb, ${trackColor} 8%, transparent); }
      }`}</style>

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
            borderRadius: 8,
            fontSize: 11,
            fontFamily: sans,
            color: tokens.text,
            background: "rgba(20,20,28,0.95)",
            border: tokens.border,
            zIndex: 5,
          }}
        >
          {tierLabel}
        </div>
      )}
    </div>
  )
}
