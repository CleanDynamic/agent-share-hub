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
      className="flex gap-3 overflow-x-auto pb-1 showcase-strip-scroll"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`.showcase-strip-scroll::-webkit-scrollbar{display:none}`}</style>
      {items.map((item) => {
        /**
         * BG-P28b. A showcase card's accent marks an EARNED thing, so its
         * default is the light rather than `--action` — a pinned badge is not
         * a button. Callers may still override it per item.
         */
        const accent = item.accent ?? tokens.xp
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
                /* `--porthole` BEHIND a picture, `--recess` when there is
                   none. A two-stop ramp struck from an accent plus a dark-room
                   grey had no second stop that was legal on Exhibition; a
                   porthole slab with nothing in it is legal and still wrong,
                   because an empty well is the darkest object in a light room
                   and there are three of them in a row. */
                background: item.imageUrl
                  ? `${tokens.surface.well} center / cover no-repeat url(${item.imageUrl})`
                  : tokens.surface.input,
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
