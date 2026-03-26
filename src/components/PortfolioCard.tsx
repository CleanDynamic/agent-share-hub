import { useNavigate } from "react-router-dom";
import { Eye, Download, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { displayContentType, TYPE_COLORS } from "@/lib/content-types";

/** Accent colours per type for placeholder thumbnails */
const TYPE_ACCENT: Record<string, string> = {
  "Prompt File": "#E8571A",
  "Agent Blueprint": "#7C3AED",
  "Workflow Template": "#3B82F6",
  "Agent Stack": "#EF4444",
  "Model Config Guide": "#22C55E",
  "Integration Guide": "#F59E0B",
  "Evaluation Framework": "#EC4899",
  "Failure Library": "#9CA3AF",
  "AI Tools (LLMs)": "#A78BFA",
};

const DIFFICULTY_STYLES: Record<string, string> = {
  Beginner: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  Intermediate: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  Advanced: "bg-red-500/15 text-red-400 border-red-500/25",
  Any: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
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
  const accent = TYPE_ACCENT[item.content_type] || "#9999AA";
  const typeColor = TYPE_COLORS[item.content_type] || "";
  const diffStyle = DIFFICULTY_STYLES[item.difficulty] || DIFFICULTY_STYLES.Any;

  return (
    <div
      onClick={() => navigate(`/content/${item.id}`)}
      className="flex overflow-hidden rounded-2xl border border-[#1E1E2A] bg-[#111118] cursor-pointer transition-all duration-150 hover:border-[rgba(232,87,26,0.4)] hover:bg-[#13131C]"
      data-visual-slot="portfolio-card"
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
            style={{ backgroundColor: accent + "33" }}
          >
            <span className="text-[32px] font-bold" style={{ color: accent }}>
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
          <h3 className="text-[15px] font-semibold text-foreground leading-[1.3] line-clamp-2">
            {item.title}
          </h3>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 pt-2.5 text-[13px] text-[#9999AA]">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" /> {formatCount(item.view_count)}
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" /> {formatCount(item.download_count)}
          </span>
          {item.rating_count > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-[#E8571A] text-[#E8571A]" />
              <span>{item.avg_rating.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
