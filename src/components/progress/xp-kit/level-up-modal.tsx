import { useEffect, useMemo, useState } from "react"
import { Check } from "lucide-react"
import { tokens } from "./tokens"

export interface LevelUpModalProps {
  newLevel: number
  unlocks: string[]
  onClose: () => void
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return reduced
}

const CONFETTI_COLORS = [tokens.orange, tokens.amber, tokens.teal, "#fff"]

/** Celebration modal shown on level-up with a scaling number and confetti burst. */
export default function LevelUpModal({ newLevel, unlocks, onClose }: LevelUpModalProps) {
  const reduced = usePrefersReducedMotion()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: 50 + (Math.random() * 60 - 30),
        dx: Math.random() * 220 - 110,
        dy: -(80 + Math.random() * 200),
        rot: Math.random() * 360,
        delay: Math.random() * 120,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [],
  )

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15,15,20,0.62)",
        ...tokens.glass,
        fontFamily: tokens.fontSans,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Level ${newLevel} reached`}
      onClick={onClose}
    >
      <style>{`
        @keyframes levelup-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          70%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes levelup-confetti {
          0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>

      {/* Confetti */}
      {!reduced && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          {particles.map((p) => (
            <span
              key={p.id}
              style={{
                position: "absolute",
                left: `${p.left}%`,
                top: "44%",
                width: p.size,
                height: p.size * 0.5,
                borderRadius: 1,
                background: p.color,
                ["--dx" as string]: `${p.dx}px`,
                ["--dy" as string]: `${p.dy}px`,
                ["--rot" as string]: `${p.rot}deg`,
                animation: `levelup-confetti 1.2s ease-out ${p.delay}ms forwards`,
              }}
            />
          ))}
        </div>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(420px, 92vw)",
          padding: "44px 32px 28px",
          borderRadius: tokens.radiusPanel,
          background: tokens.card,
          border: tokens.borderStrong,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          textAlign: "center",
          ...tokens.glass,
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: -40,
            left: "50%",
            transform: "translateX(-50%)",
            width: 320,
            height: 320,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(232,87,26,0.45) 0%, rgba(232,87,26,0.10) 45%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            fontFamily: tokens.fontMono,
            fontWeight: 700,
            fontSize: 72,
            lineHeight: 1,
            color: tokens.orange,
            textShadow: "0 4px 24px rgba(232,87,26,0.5)",
            animation: reduced ? undefined : "levelup-pop 700ms cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          {newLevel}
        </div>

        <div
          style={{
            position: "relative",
            marginTop: 10,
            fontSize: 28,
            fontWeight: 700,
            color: tokens.text,
          }}
        >
          {`Level ${newLevel}`}
        </div>

        {unlocks.length > 0 && (
          <div
            style={{
              position: "relative",
              marginTop: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              textAlign: "left",
            }}
          >
            {unlocks.map((u) => (
              <div
                key={u}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9px 12px",
                  borderRadius: tokens.radiusCard,
                  background: "rgba(255,255,255,0.05)",
                  border: tokens.borderSoft,
                  fontSize: 13,
                  color: tokens.text,
                }}
              >
                <Check size={15} color={tokens.teal} />
                <span>{u}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            position: "relative",
            marginTop: 24,
            width: "100%",
            padding: "12px 0",
            borderRadius: tokens.radiusPill,
            border: "none",
            cursor: "pointer",
            background: tokens.orangeGradient,
            color: "#fff",
            fontFamily: tokens.fontSans,
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "0 6px 18px rgba(232,87,26,0.4)",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
