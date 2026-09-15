import { Pin, Sparkles } from "lucide-react"
import { tokens } from "./tokens"
import ShowcaseStrip, { type ShowcaseItem } from "./ShowcaseStrip"
import { colourAlpha } from "@/lib/theme/tokens";

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
          <Sparkles size={16} color={tokens.brand.orange} strokeWidth={2.25} aria-hidden />
          {title}
        </h2>
        <div className="inline-flex items-center gap-2">
          {autoPinned && (
            <span
              className="inline-flex items-center gap-1.5"
              style={{
                height: 24,
                padding: "0 10px",
                borderRadius: tokens.radius.pill,
                background: `${colourAlpha(tokens.brand.orange, 0.122)}`,
                border: `0.5px solid ${colourAlpha(tokens.brand.orange, 0.4)}`,
                fontFamily: tokens.font.sans,
                fontSize: 11,
                fontWeight: 600,
                color: tokens.brand.orange,
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
