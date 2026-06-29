import { GitFork, X } from 'lucide-react'
import { tokens } from './tokens'

export interface RemixComposerBannerProps {
  /** Original author handle being remixed. */
  authorHandle: string
  /** Original blueprint title being remixed. */
  title: string
  onClear?: () => void
}

export default function RemixComposerBanner({
  authorHandle,
  title,
  onClear,
}: RemixComposerBannerProps) {
  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: '11px 13px',
        borderRadius: tokens.cardRadius,
        background: 'rgba(232,87,26,0.10)',
        border: '0.5px solid rgba(232,87,26,0.34)',
        borderLeft: `3px solid ${tokens.orange}`,
      }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: 'rgba(232,87,26,0.16)',
          flexShrink: 0,
        }}
      >
        <GitFork size={16} strokeWidth={2.2} style={{ color: tokens.orange }} />
      </span>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span style={{ fontSize: 11, letterSpacing: 0.3, color: tokens.orange, fontWeight: 600 }}>
          REMIXING
        </span>
        <span className="truncate" style={{ fontSize: 13.5, color: tokens.text }}>
          <span style={{ color: tokens.textMuted }}>@{authorHandle}</span> · {title}
        </span>
      </div>

      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear remix source"
          className="ml-auto inline-flex items-center justify-center"
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: tokens.input,
            border: tokens.borderFaint,
            color: tokens.textMuted,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      )}
    </div>
  )
}
