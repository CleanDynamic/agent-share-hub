import { GitFork, X } from 'lucide-react'
import { tokens } from './tokens'
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { elevation } from "@/lib/theme/elevation"
import { tierFill, xpText } from "@/lib/theme/progress"
const fontMono = tokens.fontMono

export interface LineageXpToastProps {
  xp: number
  /** Headline message, e.g. "Your blueprint was remixed". */
  message?: string
  onDismiss?: () => void
}

export default function LineageXpToast({
  xp,
  message = 'Your blueprint was remixed',
  onDismiss,
}: LineageXpToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-3"
      style={{
        padding: '12px 14px',
        borderRadius: tokens.radiusCard,
        background: t.glass,
        border: `0.5px solid ${t.glassBorder}`,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        ...elevation.raised,
        minWidth: 280,
      }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          borderRadius: r.chip,
          background: t.glass2,
          border: `0.5px solid ${t.line}`,
          flexShrink: 0,
        }}
      >
        <GitFork size={17} strokeWidth={2.2} style={{ color: t.text2 }} />
      </span>

      <div className="flex flex-col gap-0.5">
        <span
          style={{
            ...xpText("onLit"),
            background: tierFill("highest").background,
            borderRadius: r.chip,
            padding: "1px 7px",
            alignSelf: "flex-start",
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          +{xp} XP
        </span>
        <span style={{ fontSize: 12.5, color: tokens.textMuted }}>{message}</span>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-2 inline-flex items-center justify-center"
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          background: 'transparent',
          border: 'none',
          color: tokens.textFaint,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <X size={15} strokeWidth={2.2} />
      </button>
    </div>
  )
}
