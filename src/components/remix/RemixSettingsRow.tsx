import { GitFork, ShieldCheck, LayoutTemplate, Crown } from 'lucide-react'
import { tokens } from './tokens'

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
}

function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 42,
        height: 24,
        borderRadius: tokens.pill,
        background: checked ? tokens.orangeGradient : tokens.input,
        border: tokens.borderFaint,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 160ms ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          transition: 'left 160ms ease',
        }}
      />
    </button>
  )
}

export interface RemixSettingsRowProps {
  isRemixable: boolean
  /** When true (L2), reveals the attribution-required sub-row and Architect template toggle. */
  advanced?: boolean
  /** Whether the user owns the Architect template perk (L2). */
  hasPerk?: boolean
  onChange: (next: {
    isRemixable: boolean
    attributionRequired?: boolean
    architectTemplate?: boolean
  }) => void
  attributionRequired?: boolean
  architectTemplate?: boolean
}

export default function RemixSettingsRow({
  isRemixable,
  advanced = false,
  hasPerk = false,
  onChange,
  attributionRequired = true,
  architectTemplate = false,
}: RemixSettingsRowProps) {
  return (
    <div
      className="flex flex-col"
      style={{
        borderRadius: tokens.cardRadius,
        background: tokens.card,
        border: tokens.borderFaint,
        overflow: 'hidden',
      }}
    >
      {/* Primary row */}
      <div className="flex items-center gap-3" style={{ padding: '14px 15px' }}>
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: tokens.input,
            flexShrink: 0,
          }}
        >
          <GitFork size={16} strokeWidth={2.2} style={{ color: tokens.orange }} />
        </span>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span style={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>Allow remixing</span>
          <span style={{ fontSize: 12.5, color: tokens.textMuted }}>
            Remixes always credit you and share a little XP.
          </span>
        </div>

        <div className="ml-auto">
          <Toggle
            label="Allow remixing"
            checked={isRemixable}
            onChange={(next) =>
              onChange({
                isRemixable: next,
                attributionRequired,
                architectTemplate,
              })
            }
          />
        </div>
      </div>

      {/* Advanced sub-rows (L2) */}
      {advanced && isRemixable && (
        <>
          <div style={{ height: 0, borderTop: tokens.borderFaint }} />

          <div className="flex items-center gap-3" style={{ padding: '13px 15px' }}>
            <span
              className="inline-flex items-center justify-center"
              style={{ width: 32, height: 32, borderRadius: 8, background: tokens.input, flexShrink: 0 }}
            >
              <ShieldCheck size={16} strokeWidth={2.2} style={{ color: tokens.teal }} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span style={{ fontSize: 13.5, fontWeight: 600, color: tokens.text }}>
                Require attribution
              </span>
              <span style={{ fontSize: 12, color: tokens.textMuted }}>
                Remixers must keep your credit chip visible.
              </span>
            </div>
            <div className="ml-auto">
              <Toggle
                label="Require attribution"
                checked={attributionRequired}
                onChange={(next) =>
                  onChange({ isRemixable, attributionRequired: next, architectTemplate })
                }
              />
            </div>
          </div>

          <div style={{ height: 0, borderTop: tokens.borderFaint }} />

          <div className="flex items-center gap-3" style={{ padding: '13px 15px' }}>
            <span
              className="inline-flex items-center justify-center"
              style={{ width: 32, height: 32, borderRadius: 8, background: tokens.input, flexShrink: 0 }}
            >
              <LayoutTemplate size={16} strokeWidth={2.2} style={{ color: hasPerk ? tokens.orange : tokens.locked }} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span
                className="inline-flex items-center gap-1.5"
                style={{ fontSize: 13.5, fontWeight: 600, color: hasPerk ? tokens.text : tokens.locked }}
              >
                Architect template
                {!hasPerk && (
                  <span
                    className="inline-flex items-center gap-1"
                    style={{
                      padding: '1px 7px',
                      borderRadius: tokens.pill,
                      background: 'rgba(232,87,26,0.12)',
                      border: '0.5px solid rgba(232,87,26,0.3)',
                      color: tokens.orange,
                      fontSize: 10.5,
                      fontWeight: 600,
                    }}
                  >
                    <Crown size={11} strokeWidth={2.4} />
                    PERK
                  </span>
                )}
              </span>
              <span style={{ fontSize: 12, color: hasPerk ? tokens.textMuted : tokens.locked }}>
                Publish as a reusable template for the Architect track.
              </span>
            </div>
            <div className="ml-auto">
              <Toggle
                label="Architect template"
                disabled={!hasPerk}
                checked={architectTemplate}
                onChange={(next) =>
                  onChange({ isRemixable, attributionRequired, architectTemplate: next })
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
