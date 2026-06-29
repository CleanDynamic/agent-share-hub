import { useState } from 'react'
import { GitFork } from 'lucide-react'
import { tokens } from './tokens'
import Tooltip from './Tooltip'

export interface RemixButtonProps {
  onRemix?: () => void
  /** Render as a compact icon-only button. */
  compact?: boolean
  disabled?: boolean
}

export default function RemixButton({
  onRemix,
  compact = false,
  disabled = false,
}: RemixButtonProps) {
  const [hover, setHover] = useState(false)

  return (
    <Tooltip label="Build on this — the author gets credit and a share of XP">
      <button
        type="button"
        onClick={onRemix}
        disabled={disabled}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="Remix — build on this"
        className="inline-flex items-center justify-center gap-2 font-medium"
        style={{
          padding: compact ? 9 : '9px 16px',
          borderRadius: tokens.pill,
          background: tokens.orangeGradient,
          color: '#FFFFFF',
          border: '0.5px solid rgba(255,255,255,0.18)',
          fontSize: 14,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transform: hover && !disabled ? 'translateY(-1px)' : 'translateY(0)',
          boxShadow: hover && !disabled
            ? '0 8px 22px rgba(232,87,26,0.42)'
            : '0 2px 10px rgba(232,87,26,0.28)',
          transition: 'transform 140ms ease, box-shadow 140ms ease',
        }}
      >
        <GitFork size={16} strokeWidth={2.2} />
        {!compact && <span>Remix</span>}
      </button>
    </Tooltip>
  )
}
