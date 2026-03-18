import { Link, useNavigate } from "react-router-dom";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Download, Eye, Star, StarHalf, MessageSquare } from "lucide-react";

/* ---- Helpers ---- */

export const TYPE_COLORS: Record<string, string> = {
  "Prompt File": "bg-[#E8571A]/20 text-[#E8571A] border-[#E8571A]/25",
  "Prompt Tutorial": "bg-[#2EC4B6]/20 text-[#2EC4B6] border-[#2EC4B6]/25",
  "Agent Blueprint": "bg-[#7C3AED]/20 text-[#7C3AED] border-[#7C3AED]/25",
  "Workflow Template": "bg-[#2563EB]/20 text-[#3B82F6] border-[#2563EB]/25",
  "Agent Stack": "bg-[#DC2626]/20 text-[#EF4444] border-[#DC2626]/25",
  "Model Config Guide": "bg-[#16A34A]/20 text-[#22C55E] border-[#16A34A]/25",
  "Integration Guide": "bg-[#D97706]/20 text-[#F59E0B] border-[#D97706]/25",
  "Evaluation Framework": "bg-[#DB2777]/20 text-[#EC4899] border-[#DB2777]/25",
  "Failure Library": "bg-[#374151]/20 text-[#9CA3AF] border-[#374151]/25",
};

export function difficultyColor(level: string) {
  switch (level) {
    case "Beginner": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function roundedStars(avg: number, count: number): number {
  if (count === 0) return 0;
  if (avg >= 4.5) return 5;
  if (avg >= 4.1) return 4.5;
  if (avg >= 3.5) return 4;
  if (avg >= 3.1) return 3.5;
  if (avg >= 2.5) return 3;
  if (avg >= 2.1) return 2.5;
  if (avg >= 1.5) return 2;
  if (avg >= 1.1) return 1.5;
  return 1;
}

function MiniStars({ value }: { value: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(value)) stars.push(<Star key={i} className="h-[10px] w-[10px] fill-primary text-primary" />);
    else if (i - 0.5 === value) stars.push(<StarHalf key={i} className="h-[10px] w-[10px] fill-primary text-primary" />);
    else stars.push(<Star key={i} className="h-[10px] w-[10px] text-muted-foreground/30" />);
  }
  return <span className="inline-flex items-center gap-0.5">{stars}</span>;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ---- Component ---- */

interface FeedItemProps {
  item: any;
  rank?: number;
}

export function FeedItem({ item, rank }: FeedItemProps) {
  const navigate = useNavigate();
  const profile = item.profiles as any;
  const starVal = roundedStars(Number(item.avg_rating) || 0, item.rating_count ?? 0);
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  const handleCardClick = () => {
    navigate(`/content/${item.id}`);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={handleCardClick}
      className="px-4 py-3 border-b border-border cursor-pointer transition-colors duration-150 hover:bg-[hsl(0_0%_100%/0.03)] m-0"
    >
      {/* LINE 1 — Header row */}
      <div className="flex items-center gap-2" style={{ height: 36 }}>
        {rank != null && (
          <span className="text-[18px] font-bold text-primary shrink-0" style={{ minWidth: 32 }}>
            {String(rank).padStart(2, "0")}
          </span>
        )}
        <Link to={`/creator/${profile?.username}`} onClick={stop}>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <Link
          to={`/creator/${profile?.username}`}
          onClick={stop}
          className="text-sm font-semibold text-foreground hover:underline truncate"
        >
          {profile?.display_name || profile?.username || "Unknown"}
        </Link>
        <span className="text-[13px] text-muted-foreground truncate">@{profile?.username}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground shrink-0">{timeAgo(item.created_at)}</span>
        <div className="ml-auto shrink-0" onClick={stop}>
          <BookmarkButton contentId={item.id} />
        </div>
      </div>

      {/* LINE 2 — Badges */}
      <div className="flex gap-1.5 mt-1">
        <Badge variant="outline" className={`text-[10px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
          {item.content_type}
        </Badge>
        <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(item.difficulty)}`}>
          {item.difficulty}
        </Badge>
      </div>

      {/* LINE 3 — Title */}
      <p className="text-[15px] font-semibold text-foreground leading-[1.3] mt-1 line-clamp-2">{item.title}</p>

      {/* LINE 4 — Description */}
      {item.description && (
        <p className="text-[13px] text-muted-foreground truncate mt-0.5">{item.description}</p>
      )}

      {/* LINE 5 — Cover image */}
      {item.cover_image_url && (
        <img
          src={item.cover_image_url}
          alt={item.title}
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          className="w-full rounded-xl mt-2 block object-cover"
          style={{ maxHeight: 240 }}
        />
      )}

      {/* LINE 6 — Stats */}
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-nowrap overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <span className="inline-flex items-center gap-[3px] shrink-0"><Eye className="h-3 w-3" />{formatNum(item.view_count ?? 0)}</span>
        <span className="text-[#444450] shrink-0">·</span>
        <span className="inline-flex items-center gap-[3px] shrink-0"><Download className="h-3 w-3" />{formatNum(item.download_count ?? 0)}</span>
        {(item.rating_count ?? 0) > 0 && (
          <>
            <span className="text-[#444450] shrink-0">·</span>
            <MiniStars value={starVal} />
          </>
        )}
        <span className="text-[#444450] shrink-0">·</span>
        <span className="inline-flex items-center gap-[3px] shrink-0"><MessageSquare className="h-3 w-3" />{item.comment_count ?? 0}</span>
      </div>
    </div>
  );
}
