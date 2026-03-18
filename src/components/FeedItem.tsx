import { Link, useNavigate } from "react-router-dom";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Download, Eye, Star, StarHalf, MessageSquare } from "lucide-react";

/* ---- Helpers ---- */

export const TYPE_COLORS: Record<string, string> = {
  "Prompt File": "bg-[#E8571A]/15 text-[#E8571A] border-[#E8571A]/30",
  "Prompt Tutorial": "bg-[#2EC4B6]/15 text-[#2EC4B6] border-[#2EC4B6]/30",
  "Agent Blueprint": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Workflow Template": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Agent Stack": "bg-red-500/15 text-red-400 border-red-500/30",
  "Model Config Guide": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Integration Guide": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Evaluation Framework": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "Failure Library": "bg-muted text-muted-foreground border-border",
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
    if (i <= Math.floor(value)) stars.push(<Star key={i} className="h-2.5 w-2.5 fill-primary text-primary" />);
    else if (i - 0.5 === value) stars.push(<StarHalf key={i} className="h-2.5 w-2.5 fill-primary text-primary" />);
    else stars.push(<Star key={i} className="h-2.5 w-2.5 text-muted-foreground/30" />);
  }
  return <span className="inline-flex gap-0.5">{stars}</span>;
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
      className="px-4 py-3 border-b border-border cursor-pointer transition-colors duration-150 hover:bg-[hsl(0_0%_100%/0.03)]"
    >
      {/* LINE 1 — Header row */}
      <div className="flex items-center gap-2" style={{ height: 36 }}>
        {rank != null && (
          <span className="text-lg font-bold text-primary w-7 shrink-0">{String(rank).padStart(2, "0")}</span>
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

      {/* LINE 5 — Stats */}
      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" />{formatNum(item.view_count ?? 0)}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-0.5"><Download className="h-3 w-3" />{formatNum(item.download_count ?? 0)}</span>
        {(item.rating_count ?? 0) > 0 && (
          <>
            <span>·</span>
            <MiniStars value={starVal} />
          </>
        )}
        <span>·</span>
        <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{item.comment_count ?? 0}</span>
      </div>
    </div>
  );
}
