import { GitFork, X } from 'lucide-react'
import { tokens, xpColor } from './tokens'
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
        borderRadius: tokens.cardRadius,
        background: tokens.card,
        border: tokens.borderSoft,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        minWidth: 280,
      }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: 'rgba(232,87,26,0.16)',
          border: '0.5px solid rgba(232,87,26,0.4)',
          flexShrink: 0,
        }}
      >
        <GitFork size={17} strokeWidth={2.2} style={{ color: xpColor }} />
      </span>

      <div className="flex flex-col gap-0.5">
        <span style={{ fontFamily: fontMono, fontSize: 15, fontWeight: 700, color: xpColor }}>
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
