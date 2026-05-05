import { Link, useNavigate } from "react-router-dom";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, MessageSquare } from "lucide-react";
import { TYPE_COLORS, displayContentType } from "@/lib/content-types";
import { timeAgo, formatNum, difficultyColor } from "@/components/FeedItem";

/* ── Helpers ────────────────────────────────────────────────── */

function bountyStatusColor(status: string): { bg: string; border: string; text: string; emoji: string } {
  switch (status) {
    case "claimed": return { bg: "rgba(217,119,6,0.12)", border: "#F59E0B", text: "#F59E0B", emoji: "🟡" };
    case "solved":  return { bg: "rgba(22,163,74,0.12)",  border: "#22C55E", text: "#22C55E", emoji: "🟢" };
    default:        return { bg: "rgba(220,38,38,0.12)",  border: "#EF4444", text: "#EF4444", emoji: "🔴" };
  }
}

/* ── Component ──────────────────────────────────────────────── */

interface BountyCardProps {
  item: any;
  rank?: number;
  context?: "home" | "browse" | "category" | "profile";
  navState?: { from: string; name?: string };
}

export function BountyCard({ item, context = "home", navState }: BountyCardProps) {
  const navigate = useNavigate();
  const profile = item.profiles as any;
  const status: string = (item as any).bounty_status ?? "open";
  const sc = bountyStatusColor(status);
  const tipGbp = (item as any).bounty_tip_gbp as number | null;
  const gap = (item as any).bounty_gap as string | null;
  const meTooCount = (item as any).bounty_me_too_count ?? 0;
  const responsesCount = (item as any)._response_count ?? 0;
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();
  const state = navState ?? { from: context === "browse" ? "browse" : "feed" };

  const handleCardClick = () => {
    navigate(`/content/${item.id}?tab=responses`, { state });
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={handleCardClick}
      className="overflow-hidden"
      data-visual-slot="feed-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${sc.border}`,
        borderRadius: 'var(--radius-card)',
        marginBottom: 12,
        transition: 'border-color 0.2s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* TOP BAR */}
      <div
        className="flex items-center justify-between px-3 h-8 text-[10px] font-bold uppercase tracking-widest"
        style={{ background: sc.bg }}
      >
        <span style={{ color: sc.text }}>{sc.emoji} BOUNTY · {status.toUpperCase()}</span>
        {tipGbp && tipGbp > 0 && (
          <span className="text-amber-400 font-semibold">💰 £{tipGbp}</span>
        )}
      </div>

      {/* CARD BODY */}
      <div style={{ padding: '18px 20px' }} className="space-y-2">
        {/* ROW 1 — Header */}
        <div className="flex items-center gap-2" style={{ height: 34 }}>
          <Link to={`/creator/${profile?.username}`} onClick={stop}>
            <Avatar className="shrink-0" style={{ width: 34, height: 34 }}>
              <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{initials}</AvatarFallback>
            </Avatar>
          </Link>
          <Link
            to={`/creator/${profile?.username}`}
            onClick={stop}
            className="hover:underline truncate"
            style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.90)' }}
          >
            {profile?.display_name || profile?.username || "Unknown"}
          </Link>
          <span className="truncate" style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>@{profile?.username}</span>
          <span style={{ color: 'rgba(255,255,255,0.20)' }}>·</span>
          <span className="shrink-0" style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>{timeAgo(item.created_at)}</span>
          <div className="ml-auto shrink-0" onClick={stop}>
            <BookmarkButton contentId={item.id} />
          </div>
        </div>

        {/* ROW 2 — Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-widest ${TYPE_COLORS["Failure Library"]}`}>
            {displayContentType(item.content_type)}
          </Badge>
          {item.difficulty && item.difficulty !== "Any" && (
            <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider ${difficultyColor(item.difficulty)}`}>
              {item.difficulty}
            </Badge>
          )}
        </div>

        {/* ROW 3 — Title */}
        <p className="line-clamp-2" style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.90)', lineHeight: 1.3, marginTop: 10 }}>{item.title}</p>

        {/* ROW 4 — The Gap Preview */}
        {gap && (
          <div
            className="text-[11px] leading-snug truncate px-2.5 py-1.5 rounded-md"
            style={{
              background: "rgba(31,122,109,0.04)",
              borderLeft: "2px solid rgba(31,122,109,0.3)",
            }}
          >
            <span className="text-[#1F7A6D] opacity-70 uppercase tracking-wider mr-1">Needs:</span>
            <span className="text-muted-foreground">{gap}</span>
          </div>
        )}

        {/* ROW 5 — Stats */}
        <div className="flex items-center justify-between" style={{ paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <div className="flex items-center" style={{ gap: 16, fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}>
            <span className="flex items-center gap-1">
              <Eye style={{ width: 15, height: 15 }} />{formatNum(item.view_count ?? 0)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare style={{ width: 15, height: 15 }} />{responsesCount} responses
            </span>
            {meTooCount > 0 && (
              <span>🙋 {meTooCount} have this</span>
            )}
          </div>
          <Link
            to={`/content/${item.id}?tab=responses`}
            onClick={stop}
            className="text-xs font-medium hover:underline"
            style={{ color: "#1F7A6D" }}
          >
            Respond ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
