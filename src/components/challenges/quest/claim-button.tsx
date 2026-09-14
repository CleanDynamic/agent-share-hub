import { useCallback, useRef, useState } from "react"
import { Check, Sparkles } from "lucide-react"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { xpText } from "@/lib/theme/progress"
import {
  colors,
  radius,
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
 *
 * THIS IS THE PAGE'S ONE PRIMARY ACTION (BG-P28b), which is why it keeps the
 * `--action` fill while the quest list's "Go" buttons stepped down to glass
 * secondaries. Claiming is the one thing on `/analytics` you press to make
 * something happen.
 *
 * THE FLOATING REWARD WAS AMBER TYPE — `color: semantic.xp`, which resolves to
 * `--lit` and measures 3.01:1 on Exhibition. It is `xpText()` now, like every
 * other XP figure in the product. The particle palette dropped its literal
 * `#FFFFFF` for the same reason: white motes are invisible against a luminous
 * grey room.
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
      // The light and the action, which is what a claim awards and what it
      // is. No white: a white mote has nothing to show against on Exhibition.
      const palette = [t.lit, t.action, t.lit, t.action]
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
          borderRadius: r.control,
          color: claimed ? colors.textSecondary : t.onAction,
          background: claimed ? colors.input : t.action,
          border: `0.5px solid ${claimed ? colors.borderSoft : t.action}`,
          cursor: claimed ? "default" : "pointer",
          transform: pressing ? "scale(0.94)" : "scale(1)",
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
            data-bg-animated=""
            style={{
              position: "absolute",
              width: p.size,
              height: p.size,
              // A mote is a circle.
              borderRadius: r.full,
              background: p.color,
              animation: "bgClaimParticle 0.6s ease-out forwards",
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
            data-bg-animated=""
            className="text-sm font-bold"
            style={{
              ...xpText(),
              position: "absolute",
              animation: "bgClaimFloat 0.9s ease-out forwards",
            }}
          >
            {"+"}
            {f.amount} XP
          </span>
        ))}
      </span>

    </div>
  )
}
