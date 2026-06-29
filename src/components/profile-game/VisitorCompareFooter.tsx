import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import { tokens } from "./tokens"

export interface CompareMetric {
  id: string
  label: string
  /** Profile owner's value. */
  ownerValue: number
  /** Visiting user's value. */
  visitorValue: number
}

export interface VisitorCompareFooterProps {
  ownerName: string
  visitorName: string
  metrics: CompareMetric[]
  /**
   * Gate. Comparison is a depth surface — render ONLY when BOTH users are past
   * the depth reveal. New users must never see themselves ranked against anyone.
   */
  bothRevealed: boolean
}

/**
 * R1 visitor comparison footer, gated by bothRevealed.
 */
export default function VisitorCompareFooter({
  ownerName,
  visitorName,
  metrics,
  bothRevealed,
}: VisitorCompareFooterProps) {
  if (!bothRevealed) return null

  return (
    <footer
      className="flex flex-col gap-3"
      style={{
        padding: 18,
        borderRadius: tokens.radius.panel,
        background: tokens.surface.shell,
        border: tokens.border.strong,
        ...tokens.glass,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          style={{
            fontFamily: tokens.font.sans,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: tokens.text.muted,
          }}
        >
          You vs {ownerName}
        </span>
        <span style={{ fontFamily: tokens.font.sans, fontSize: 12, color: tokens.text.muted }}>
          {visitorName}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {metrics.map((metric) => {
          const diff = metric.visitorValue - metric.ownerValue
          const ahead = diff > 0
          const even = diff === 0
          const color = even ? tokens.text.muted : ahead ? tokens.accent.green : tokens.text.secondary
          const Icon = even ? Minus : ahead ? ArrowUpRight : ArrowDownRight
          return (
            <div key={metric.id} className="flex items-center gap-3">
              <span
                style={{
                  fontFamily: tokens.font.sans,
                  fontSize: 13,
                  color: tokens.text.secondary,
                  width: 110,
                }}
              >
                {metric.label}
              </span>
              <CompareBar
                ownerValue={metric.ownerValue}
                visitorValue={metric.visitorValue}
              />
              <span
                className="inline-flex items-center gap-1 justify-end"
                style={{ width: 84, fontFamily: tokens.font.mono, fontSize: 12, fontWeight: 600, color }}
              >
                <Icon size={13} strokeWidth={2.5} aria-hidden />
                {even ? "even" : `${ahead ? "+" : ""}${diff}`}
              </span>
            </div>
          )
        })}
      </div>
    </footer>
  )
}

function CompareBar({ ownerValue, visitorValue }: { ownerValue: number; visitorValue: number }) {
  const max = Math.max(ownerValue, visitorValue, 1)
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <Track pct={(visitorValue / max) * 100} color={tokens.accent.teal} />
      <Track pct={(ownerValue / max) * 100} color={tokens.brand.orange} />
    </div>
  )
}

function Track({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      style={{
        height: 5,
        borderRadius: tokens.radius.pill,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: "100%",
          borderRadius: tokens.radius.pill,
          background: color,
        }}
      />
    </div>
  )
}
