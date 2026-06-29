import { useCallback, useRef, useState } from "react"
import { Check, Sparkles } from "lucide-react"
import {
  colors,
  orangeGradient,
  radius,
  semantic,
  prefersReducedMotion,
} from "./tokens"

interface Particle {
  id: number
  dx: number
  dy: number
  size: number
  color: string
}

interface FloatXP {
  id: number
  amount: number
}

export interface ClaimButtonProps {
  /** XP awarded — shown in the floating reward */
  xp: number
  /** whether the reward has already been claimed */
  claimed?: boolean
  label?: string
  claimedLabel?: string
  onClaim?: () => void
}

/**
 * ClaimButton — press → particle burst → floating +XP.
 * Honours prefers-reduced-motion (instant, no particles).
 */
export default function ClaimButton({
  xp,
  claimed = false,
  label = "Claim",
  claimedLabel = "Claimed",
  onClaim,
}: ClaimButtonProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [floats, setFloats] = useState<FloatXP[]>([])
  const [pressing, setPressing] = useState(false)
  const seq = useRef(0)

  const fire = useCallback(() => {
    if (claimed) return
    const reduced = prefersReducedMotion()
    onClaim?.()

    if (reduced) return

    const burst: Particle[] = Array.from({ length: 14 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4
      const dist = 26 + Math.random() * 30
      const palette = [colors.orange, colors.amber, semantic.xp, "#FFFFFF"]
      return {
        id: seq.current++,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        size: 4 + Math.random() * 4,
        color: palette[i % palette.length],
      }
    })
    const float: FloatXP = { id: seq.current++, amount: xp }

    setParticles((p) => [...p, ...burst])
    setFloats((f) => [...f, float])
    setPressing(true)

    window.setTimeout(() => {
      setParticles((p) => p.filter((x) => !burst.some((b) => b.id === x.id)))
      setPressing(false)
    }, 620)
    window.setTimeout(() => {
      setFloats((f) => f.filter((x) => x.id !== float.id))
    }, 900)
  }, [claimed, onClaim, xp])

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={fire}
        disabled={claimed}
        aria-label={claimed ? claimedLabel : `${label} ${xp} XP`}
        className="relative inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-transform"
        style={{
          borderRadius: radius.pill,
          color: claimed ? colors.textSecondary : "#FFFFFF",
          background: claimed ? colors.input : orangeGradient,
          border: claimed
            ? `0.5px solid ${colors.borderSoft}`
            : "0.5px solid rgba(255,255,255,0.18)",
          cursor: claimed ? "default" : "pointer",
          transform: pressing ? "scale(0.94)" : "scale(1)",
          boxShadow: claimed
            ? "none"
            : "0 4px 14px rgba(232,87,26,0.35)",
        }}
      >
        {claimed ? (
          <Check size={14} strokeWidth={2.5} />
        ) : (
          <Sparkles size={14} strokeWidth={2.5} />
        )}
        {claimed ? claimedLabel : label}
      </button>

      {/* particle burst */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {particles.map((p) => (
          <span
            key={p.id}
            aria-hidden
            style={{
              position: "absolute",
              width: p.size,
              height: p.size,
              borderRadius: radius.pill,
              background: p.color,
              animation: "qb-particle 0.6s ease-out forwards",
              // @ts-expect-error custom props
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
            }}
          />
        ))}
      </span>

      {/* floating +XP */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {floats.map((f) => (
          <span
            key={f.id}
            aria-hidden
            className="text-sm font-bold font-mono"
            style={{
              position: "absolute",
              color: semantic.xp,
              textShadow: "0 2px 8px rgba(0,0,0,0.45)",
              animation: "qb-float 0.9s ease-out forwards",
            }}
          >
            {"+"}
            {f.amount} XP
          </span>
        ))}
      </span>

      <style>{`
        @keyframes qb-particle {
          0%   { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
        }
        @keyframes qb-float {
          0%   { transform: translateY(0); opacity: 0; }
          18%  { opacity: 1; }
          100% { transform: translateY(-34px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .relative [style*="qb-particle"], .relative [style*="qb-float"] { display: none !important; }
        }
      `}</style>
    </div>
  )
}
