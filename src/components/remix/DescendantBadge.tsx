import { useState } from 'react'
import { GitFork } from 'lucide-react'
import { tokens, fontMono } from './tokens'
import Tooltip from './Tooltip'

export interface DescendantBadgeProps {
  count: number
  /** false (L1) = static count pill. true (L2) = click-through opens lineage tree. */
  interactive?: boolean
  onOpen?: () => void
}

export default function DescendantBadge({
  count,
  interactive = true,
  onOpen,
}: DescendantBadgeProps) {
  const [hover, setHover] = useState(false)
  const label = `${count} ${count === 1 ? 'remix' : 'remixes'}`

  const inner = (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? onOpen : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={interactive ? `${label}, view lineage tree` : label}
      className="inline-flex items-center gap-1.5 font-medium"
      style={{
        padding: '4px 10px',
        borderRadius: tokens.pill,
        background: interactive && hover ? tokens.card : tokens.input,
        border: interactive && hover ? tokens.borderSoft : tokens.borderFaint,
        color: tokens.textMuted,
        fontSize: 12.5,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background 140ms ease, border 140ms ease',
      }}
    >
      <GitFork size={13} strokeWidth={2.2} style={{ color: tokens.teal }} />
      <span style={{ fontFamily: fontMono, color: tokens.text }}>{count}</span>
      <span>{count === 1 ? 'remix' : 'remixes'}</span>
    </button>
  )

  return <Tooltip label="People built on this">{inner}</Tooltip>
}
