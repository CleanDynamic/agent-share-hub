import { Pin, Sparkles } from "lucide-react"
import { tierFill, tokens } from "./tokens"
import ShowcaseStrip, { type ShowcaseItem } from "./ShowcaseStrip"

export interface ShowcaseSectionProps {
  items: ShowcaseItem[]
  /** Auto-pinned defaults to true at L1 (identity formation). */
  autoPinned?: boolean
  /** Surface layer hint; "shell" applies glass, "card" is flat. */
  layer?: "shell" | "card"
  title?: string
  /** Optional "View cabinet →" handler rendered in the header. */
  onViewAll?: () => void
  viewAllLabel?: string
}

/**
 * Wraps the Session D ShowcaseStrip in a titled panel. autoPinned true at L1.
 */
export default function ShowcaseSection({
  items,
  autoPinned = true,
  layer = "shell",
  title = "Showcase",
  onViewAll,
  viewAllLabel = "View cabinet →",
}: ShowcaseSectionProps) {
  const isShell = layer === "shell"
  return (
    <section
      className="flex flex-col gap-3"
      style={{
        padding: 20,
        borderRadius: tokens.radius.panel,
        background: isShell ? tokens.surface.shell : tokens.surface.card,
        border: tokens.border.strong,
        ...(isShell ? tokens.glass : {}),
      }}
    >
      <div className="flex items-center justify-between">
        <h2
          className="inline-flex items-center gap-2"
          style={{
            fontFamily: tokens.font.sans,
            fontSize: 15,
            fontWeight: 700,
            color: tokens.text.primary,
            margin: 0,
          }}
        >
          <Sparkles size={16} color={tokens.text.secondary} strokeWidth={2.25} aria-hidden />
          {title}
        </h2>
        <div className="inline-flex items-center gap-2">
          {autoPinned && (
            <span
              className="inline-flex items-center gap-1.5"
              style={{
                height: 24,
                padding: "0 10px",
                /**
                 * BG-P28b. Was `${tokens.brand.orange}1f` over
                 * `${tokens.brand.orange}66` — alpha suffixes glued onto what
                 * BG-P25 turned into `var(--action)`, so both produced
                 * non-colours and this chip has rendered with no ground and no
                 * border ever since. It is the ladder's middle rung now, which
                 * is also the right rank for it: "auto-pinned" is a status on
                 * the section, not an achievement, so it does not take light.
                 */
                borderRadius: tokens.radius.pill,
                background: tierFill("rare").background,
                border: `1px solid ${tierFill("rare").borderColor}`,
                fontFamily: tokens.font.sans,
                fontSize: 11,
                fontWeight: 600,
                color: tierFill("rare").color,
              }}
            >
              <Pin size={12} strokeWidth={2.25} aria-hidden />
              Auto-pinned
            </span>
          )}
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              style={{
                height: 24,
                padding: "0 10px",
                borderRadius: tokens.radius.pill,
                background: "transparent",
                border: tokens.border.soft,
                fontFamily: tokens.font.sans,
                fontSize: 11,
                fontWeight: 600,
                color: tokens.text.secondary,
                cursor: "pointer",
              }}
            >
              {viewAllLabel}
            </button>
          )}
        </div>
      </div>
      <ShowcaseStrip items={items} />
    </section>
  )
}
