import { useState } from 'react'
import { GitFork, Lock } from 'lucide-react'
import { tokens } from './tokens'

export interface AttributionChipProps {
  /** Original author handle, e.g. "ada". Omit when original was deleted. */
  authorHandle?: string
  /** Original blueprint title. Omit when original was deleted. */
  title?: string
  /** When true, the original was removed — render the locked fallback. */
  deleted?: boolean
  onClick?: () => void
}

export default function AttributionChip({
  authorHandle,
  title,
  deleted = false,
  onClick,
}: AttributionChipProps) {
  const [hover, setHover] = useState(false)
  const isFallback = deleted || !authorHandle || !title

  return (
    <button
      type="button"
      onClick={isFallback ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex max-w-full items-center gap-1.5 font-medium"
      aria-label={
        isFallback
          ? 'Remixed from a removed original'
          : `Remixed from @${authorHandle} · ${title}`
      }
      style={{
        padding: '5px 11px 5px 9px',
        borderRadius: tokens.pill,
        background: tokens.input,
        border: hover && !isFallback ? tokens.borderSoft : tokens.borderFaint,
        color: isFallback ? tokens.locked : tokens.textMuted,
        fontSize: 12.5,
        cursor: isFallback ? 'default' : 'pointer',
        transition: 'border 140ms ease, color 140ms ease',
      }}
    >
      {isFallback ? (
        <Lock size={13} strokeWidth={2.2} style={{ color: tokens.locked, flexShrink: 0 }} />
      ) : (
        <GitFork size={13} strokeWidth={2.2} style={{ color: tokens.orange, flexShrink: 0 }} />
      )}
      {isFallback ? (
        <span className="truncate" style={{ fontStyle: 'italic' }}>
          Remixed from a removed original
        </span>
      ) : (
        <span className="truncate">
          Remixed from{' '}
          <span style={{ color: hover ? tokens.text : tokens.textMuted }}>@{authorHandle}</span>
          {' · '}
          <span style={{ color: hover ? tokens.text : tokens.textMuted }}>{title}</span>
        </span>
      )}
    </button>
  )
}
