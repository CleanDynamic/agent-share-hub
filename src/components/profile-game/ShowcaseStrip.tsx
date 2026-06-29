import { Heart, Eye } from "lucide-react"
import { tokens } from "./tokens"

export interface ShowcaseItem {
  id: string
  title: string
  imageUrl?: string
  likes: number
  views: number
  /** Accent bar colour — usually the track colour. */
  accent?: string
}

export interface ShowcaseStripProps {
  items: ShowcaseItem[]
}

/**
 * Session D — horizontal strip of showcase cards. Consumed by ShowcaseSection.
 */
export default function ShowcaseStrip({ items }: ShowcaseStripProps) {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-1"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`div::-webkit-scrollbar{display:none}`}</style>
      {items.map((item) => {
        const accent = item.accent ?? tokens.brand.orange
        return (
          <article
            key={item.id}
            className="shrink-0 flex flex-col overflow-hidden"
            style={{
              width: 180,
              borderRadius: tokens.radius.card,
              background: tokens.surface.card,
              border: tokens.border.soft,
            }}
          >
            <div
              className="flex items-end"
              style={{
                height: 104,
                background: item.imageUrl
                  ? `center / cover no-repeat url(${item.imageUrl})`
                  : `linear-gradient(135deg, ${accent}40 0%, rgba(82,82,100,0.4) 100%)`,
                borderBottom: `2px solid ${accent}`,
              }}
            />
            <div className="flex flex-col gap-2" style={{ padding: 12 }}>
              <h3
                className="truncate"
                style={{
                  fontFamily: tokens.font.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: tokens.text.primary,
                  margin: 0,
                }}
              >
                {item.title}
              </h3>
              <div className="flex items-center gap-3">
                <Metric icon={Heart} value={item.likes} />
                <Metric icon={Eye} value={item.views} />
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function Metric({ icon: Icon, value }: { icon: typeof Heart; value: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon size={13} color={tokens.text.muted} strokeWidth={2} aria-hidden />
      <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.text.secondary }}>
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </span>
    </span>
  )
}
