import type { LucideIcon } from "lucide-react"
import { Lock } from "lucide-react"
import { tierFill, tokens } from "./tokens"

export interface MasteryRibbon {
  id: string
  label: string
  icon: LucideIcon
  /** Mastery progress 0–100. */
  progressPct: number
  color: string
  /** Locked ribbons render dimmed with a lock glyph. */
  locked?: boolean
}

export interface MasteryRibbonsProps {
  ribbons: MasteryRibbon[]
  title?: string
}

/**
 * R1 — L2 module. Vertical list of mastery ribbons with progress fills.
 * Additive; sits below the core L1 surfaces and never alters them.
 */
export default function MasteryRibbons({ ribbons, title = "Mastery" }: MasteryRibbonsProps) {
  return (
    <section
      className="flex flex-col gap-3"
      style={{
        padding: 20,
        borderRadius: tokens.radius.panel,
        background: tokens.surface.shell,
        border: tokens.border.strong,
        ...tokens.glass,
      }}
    >
      <h2
        style={{
          fontFamily: tokens.font.sans,
          fontSize: 15,
          fontWeight: 700,
          color: tokens.text.primary,
          margin: 0,
        }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-2.5">
        {ribbons.map((ribbon) => {
          const Icon = ribbon.icon
          const color = ribbon.locked ? tokens.locked : ribbon.color
          return (
            <div
              key={ribbon.id}
              className="flex items-center gap-3"
              style={{
                padding: "10px 12px",
                borderRadius: tokens.radius.card,
                background: tokens.surface.card,
                border: tokens.border.soft,
                opacity: ribbon.locked ? 0.6 : 1,
              }}
            >
              <span
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 32,
                  height: 32,
                  /**
                   * BG-P28b. Was `${color}1f` over `${color}55` — alpha
                   * suffixes on what BG-P25 turned into `var(--lit)`, so
                   * neither resolved and this medallion rendered bare. An
                   * earned ribbon takes the top rung, a locked one the middle;
                   * see the ladder.
                   */
                  borderRadius: tokens.radius.card,
                  background: tierFill(ribbon.locked ? "rare" : "highest").background,
                  border: `1px solid ${tierFill(ribbon.locked ? "rare" : "highest").borderColor}`,
                }}
              >
                {ribbon.locked ? (
                  <Lock size={15} color={tierFill("rare").color} strokeWidth={2.25} aria-hidden />
                ) : (
                  <Icon size={16} color={tierFill("highest").color} strokeWidth={2.25} aria-hidden />
                )}
              </span>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="truncate"
                    style={{
                      fontFamily: tokens.font.sans,
                      fontSize: 13,
                      fontWeight: 600,
                      color: ribbon.locked ? tokens.locked : tokens.text.primary,
                    }}
                  >
                    {ribbon.label}
                  </span>
                  <span
                    style={{
                      fontFamily: tokens.font.mono,
                      fontSize: 12,
                      fontWeight: 600,
                      color: ribbon.locked ? tokens.locked : tokens.text.secondary,
                    }}
                  >
                    {ribbon.progressPct}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: tokens.radius.pill,
                    background: tokens.surface.card,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, ribbon.progressPct))}%`,
                      height: "100%",
                      borderRadius: tokens.radius.pill,
                      background: ribbon.locked ? tokens.locked : color,
                      transition: "width 600ms cubic-bezier(0.4,0,0.2,1)",
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
