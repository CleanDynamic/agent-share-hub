import { useState, type ReactNode } from 'react'
import { tokens } from './tokens'

export interface TooltipProps {
  label: string
  children: ReactNode
}

export default function Tooltip({ label, children }: TooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 whitespace-nowrap text-xs"
        style={{
          transform: `translateX(-50%) translateY(${open ? '0' : '4px'})`,
          opacity: open ? 1 : 0,
          transition: 'opacity 140ms ease, transform 140ms ease',
          padding: '6px 10px',
          borderRadius: 8,
          background: 'rgba(20,20,28,0.92)',
          border: tokens.borderSoft,
          color: tokens.text,
          backdropFilter: tokens.glass,
          WebkitBackdropFilter: tokens.glass,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}
      >
        {label}
      </span>
    </span>
  )
}
