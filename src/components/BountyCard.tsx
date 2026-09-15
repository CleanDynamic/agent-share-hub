import { Link, useNavigate } from "react-router-dom";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, MessageSquare } from "lucide-react";
import { TYPE_COLORS, TYPE_COLOR_FALLBACK, displayContentType } from "@/lib/content-types";
import { timeAgo, formatNum, difficultyColor } from "@/components/FeedItem";
import { useLegacyMeTooCount } from "@/lib/bounty/legacyMeToo";
import { feedback } from "@/lib/theme/motion";

/* ── Helpers ────────────────────────────────────────────────── */

function bountyStatusColor(status: string): { bg: string; border: string; text: string; emoji: string } {
  switch (status) {
    /* Claimed is work in progress, and the part category for a produced
       thing is artefact — 6.41:1 on Exhibition and 7.65:1 on Dusk. Amber was
       the old paint for it and cannot carry the label at all. */
    case "claimed": return { bg: "color-mix(in srgb, var(--cat-artefact) 12%, transparent)", border: "var(--cat-artefact)", text: "var(--cat-artefact)", emoji: "🟡" };
    case "solved":  return { bg: "color-mix(in srgb, var(--cat-configuration) 12%, transparent)",  border: "var(--cat-configuration)", text: "var(--cat-configuration)", emoji: "🟢" };
    default:        return { bg: "color-mix(in srgb, var(--cat-breakage) 12%, transparent)",  border: "var(--cat-breakage)", text: "var(--cat-breakage)", emoji: "🔴" };
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
  // NS-P54. content_items.bounty_me_too_count stopped moving when the migration
  // dropped that leg of the counter trigger, so it is now the FALLBACK — the
  // value the column froze at — and the live number comes from
  // bounties.me_too_count, resolved through bounties.legacy_item_id. The hook
  // renders the frozen value first and never blocks this card on the lookup.
  //
  // On the project this repository points at the column does not exist at all
  // (42703, measured by the NS-P44 audit), so this fallback is 0 there and the
  // "N have this" line has never rendered; the hook is what will make it render
  // once the header table is applied.
  const frozenMeTooCount = (item as any).bounty_me_too_count ?? 0;
  const meTooCount = useLegacyMeTooCount(item.id as string, frozenMeTooCount);
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
        border: '1px solid var(--line)',
        borderLeft: `3px solid ${sc.border}`,
        borderRadius: 'var(--radius-card)',
        marginBottom: 12,
        transition: feedback("border-color"),
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}
    >
      {/* TOP BAR */}
      <div
        className="flex items-center justify-between px-3 h-8 text-[10px] font-bold uppercase tracking-widest"
        style={{ background: sc.bg }}
      >
        <span style={{ color: sc.text }}>{sc.emoji} BOUNTY · {status.toUpperCase()}</span>
        {tipGbp && tipGbp > 0 && (
          <span className="text-[var(--cat-artefact)] font-semibold">💰 £{tipGbp}</span>
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
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}
          >
            {profile?.display_name || profile?.username || "Unknown"}
          </Link>
          <span className="truncate" style={{ fontSize: 12, color: 'var(--text2)' }}>@{profile?.username}</span>
          <span style={{ color: 'var(--text2)' }}>·</span>
          <span className="shrink-0" style={{ fontSize: 12, color: 'var(--text2)' }}>{timeAgo(item.created_at)}</span>
          <div className="ml-auto shrink-0" onClick={stop}>
            <BookmarkButton contentId={item.id} />
          </div>
        </div>

        {/* ROW 2 — Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-widest ${TYPE_COLOR_FALLBACK}`}>
            {displayContentType(item.content_type)}
          </Badge>
          {item.difficulty && item.difficulty !== "Any" && (
            <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider ${difficultyColor(item.difficulty)}`}>
              {item.difficulty}
            </Badge>
          )}
        </div>

        {/* ROW 3 — Title */}
        <p className="line-clamp-2" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginTop: 10 }}>{item.title}</p>

        {/* ROW 4 — The Gap Preview */}
        {gap && (
          <div
            className="text-[11px] leading-snug truncate px-2.5 py-1.5 rounded-md"
            style={{
              background: "color-mix(in srgb, var(--evidence) 4%, transparent)",
              borderLeft: "2px solid color-mix(in srgb, var(--evidence) 30%, transparent)",
            }}
          >
            <span className="text-[var(--evidence)] opacity-70 uppercase tracking-wider mr-1">Needs:</span>
            <span className="text-muted-foreground">{gap}</span>
          </div>
        )}

        {/* ROW 5 — Stats */}
        <div className="flex items-center justify-between" style={{ paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div className="flex items-center" style={{ gap: 16, fontSize: 12, fontWeight: 400, color: 'var(--text2)' }}>
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
            style={{ color: "var(--evidence)" }}
          >
            Respond ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
