// The legacy portfolio card — repainted for BG-P25, not replaced.
//
// WHY IT SURVIVES. This renders `content_items`: the work published through the
// previous upload editor, before builds existed. `GalleryCard` reads a build
// record — nodes, media, a plaque, a completeness — and none of those columns
// exist on a row this card is given, so pointing it at one would produce a card
// with an empty everything. A creator's older work is still their work and has
// to keep looking like it belongs on the same wall, which is what a repaint is
// for.
//
// THE NINE PLACEHOLDER ACCENTS RESOLVE INTO THE NINE CATEGORIES. `TYPE_ACCENT`
// was a private hue per content type — a second palette answering the question
// `LEGACY_BADGE_CATEGORY` already answers, and answering it differently: a
// Prompt File was brown here and instruction-orange on its badge two lines
// below. Both now come from one table, so the letter in the thumbnail and the
// badge beside it are the same colour, and a type the table does not carry
// lands on the measured fallback pair rather than on an invented grey.
//
// THE CARD'S SURFACE LEAVES THE LEGACY `:root` BLOCK. `var(--surface)`,
// `var(--border)` and `var(--border-hover)` are the old dark paint — white
// alphas that resolve to an invisible card on the Exhibition ground. They are
// shared with surfaces this prompt does not own, so the names stay where they
// are and this file stops reading them.

import { useNavigate } from "react-router-dom";
import { Eye, Download, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DIFFICULTY_LABEL_CLASS,
  LEGACY_BADGE_CATEGORY,
  TYPE_COLORS,
  displayContentType,
} from "@/lib/content-types";
import { categoryFill } from "@/lib/theme/category";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, tabular, type } from "@/lib/theme/type";

// BG-P05. Difficulty is not a part category and carries no colour: one
// uncoloured mono label, defined once in @/lib/content-types.
const DIFFICULTY_STYLES: Record<string, string> = {
  Beginner: DIFFICULTY_LABEL_CLASS,
  Intermediate: DIFFICULTY_LABEL_CLASS,
  Advanced: DIFFICULTY_LABEL_CLASS,
  Any: DIFFICULTY_LABEL_CLASS,
};

export function formatCount(n: number): string {
  if (n >= 10000) return Math.round(n / 1000) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

interface PortfolioCardProps {
  item: {
    id: string;
    title: string;
    content_type: string;
    difficulty: string;
    cover_image_url?: string | null;
    view_count: number;
    download_count: number;
    avg_rating: number;
    rating_count: number;
  };
}

export function PortfolioCard({ item }: PortfolioCardProps) {
  const navigate = useNavigate();
  /* One table, both halves of the pair. The fill is the measured ground and
     the colour is the ink that was measured against it — using one without the
     other is a pairing nobody checked. */
  const accent = categoryFill(LEGACY_BADGE_CATEGORY[item.content_type] ?? "");
  const typeColor = TYPE_COLORS[item.content_type] || "";
  const diffStyle = DIFFICULTY_STYLES[item.difficulty] || DIFFICULTY_STYLES.Any;

  return (
    <div
      onClick={() => navigate(`/content/${item.id}`)}
      className="flex overflow-hidden"
      data-visual-slot="feed-card"
      style={{
        background: t.glass,
        border: `1px solid ${t.glassBorder}`,
        borderRadius: r.card,
        marginBottom: '8px',
        transition: 'border-color 160ms cubic-bezier(.2,.6,.35,1)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = t.line)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = t.glassBorder)}
    >
      {/* Thumbnail */}
      <div className="w-[140px] shrink-0 min-h-[120px]">
        {item.cover_image_url ? (
          <img
            src={item.cover_image_url}
            alt=""
            className="w-full h-full object-cover block"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: accent.background }}
          >
            {/* The display face is legal at 32px — well above the 20px floor
                below which Bodoni's hairlines shimmer. */}
            <span style={{ ...type.cardTitle, fontSize: 32, color: accent.color }}>
              {(item.content_type || "?")[0]}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col justify-between flex-1 p-3.5 min-w-0">
        <div>
          {/* Badges */}
          <div className="flex items-center gap-1.5 mb-2">
            <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 h-5 ${typeColor}`}>
              {displayContentType(item.content_type)}
            </Badge>
            {item.difficulty && item.difficulty !== "Any" && (
              <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 h-5 ${diffStyle}`}>
                {item.difficulty}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3
            className="line-clamp-2"
            style={{ ...body, fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: t.text, margin: 0 }}
          >
            {item.title}
          </h3>
        </div>

        {/* Stats */}
        {/* Counts, in the data face with tabular figures so a column of these
            cards lines its numbers up. */}
        <div
          className="flex items-center gap-3 pt-2.5"
          style={{ ...dataText, ...tabular, fontSize: 13, color: t.text2 }}
        >
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" /> {formatCount(item.view_count)}
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" /> {formatCount(item.download_count)}
          </span>
          {item.rating_count > 0 && (
            <span className="flex items-center gap-1">
              {/* A lamp, not amber type — and the figure beside it stays
                  `--text2` like every other count in the row. */}
              <Star className="h-3.5 w-3.5" style={{ fill: t.lit, color: t.lit }} />
              <span>{item.avg_rating.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
