import { useEffect, useState } from "react"
import { CheckCircle2, X } from "lucide-react"
import {
  colors,
  orangeGradient,
  radius,
  semantic,
  shellSurface,
  withAlpha,
  prefersReducedMotion,
} from "./tokens"

export interface ChallengeCompleteToastProps {
  title: string
  xp: number
  /** controls visibility */
  open: boolean
  /** auto-dismiss after ms (default 4000); 0 disables */
  duration?: number
  onClose?: () => void
}

export default function ChallengeCompleteToast({
  title,
  xp,
  open,
  duration = 4000,
  onClose,
}: ChallengeCompleteToastProps) {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(prefersReducedMotion())
  }, [])

  useEffect(() => {
    if (!open || duration === 0) return
    const t = window.setTimeout(() => onClose?.(), duration)
    return () => window.clearTimeout(t)
  }, [open, duration, onClose])

  if (!open) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-3 pr-4"
      style={{
        ...shellSurface,
        minWidth: 280,
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        animation: reduced
          ? "none"
          : "ct-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center"
        style={{
          borderRadius: radius.card,
          background: orangeGradient,
          boxShadow: `0 6px 18px ${withAlpha(colors.orange, 0.4)}`,
        }}
      >
        <CheckCircle2 size={20} color="#FFFFFF" strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-semibold"
          style={{ color: colors.textPrimary }}
        >
          Challenge complete
        </p>
        <p className="truncate text-xs" style={{ color: colors.textSecondary }}>
          {title}
        </p>
      </div>

      <span
        className="shrink-0 px-2.5 py-1 font-mono text-xs font-bold"
        style={{
          borderRadius: radius.pill,
          background: withAlpha(colors.orange, 0.16),
          color: semantic.xp,
        }}
      >
        +{xp} XP
      </span>

      <button
        type="button"
        onClick={() => onClose?.()}
        aria-label="Dismiss"
        className="flex h-6 w-6 shrink-0 items-center justify-center"
        style={{ borderRadius: radius.pill, color: colors.textMuted }}
      >
        <X size={14} />
      </button>

      <style>{`
        @keyframes ct-in {
          0% { transform: translateY(24px) scale(0.9); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
