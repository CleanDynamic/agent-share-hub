import { Link, useNavigate } from "react-router-dom";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, Users } from "lucide-react";
import { timeAgo, formatNum } from "@/components/FeedItem";

import { elevation } from "@/lib/theme/elevation";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { data as dataText } from "@/lib/theme/type";
import { feedback } from "@/lib/theme/motion";

interface CollectionFeedCardProps {
  item: {
    id: string;
    title: string;
    description?: string | null;
    slug?: string | null;
    item_count: number;
    follower_count: number;
    created_at: string;
    profiles?: any;
    _cover_images?: string[];
  };
}

function CoverMosaic({ images, title }: { images: string[]; title: string }) {
  const cells = images.slice(0, 4);
  if (cells.length === 0) return null;

  return (
    <div className="w-full overflow-hidden mt-2 grid grid-cols-2 gap-[2px]" style={{ maxHeight: 200, borderRadius: r.media }}>
      {cells.map((url, i) => (
        <img
          key={i}
          src={url}
          alt={`${title} item ${i + 1}`}
          loading="lazy"
          className="w-full h-[100px] object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ))}
    </div>
  );
}

export function CollectionFeedCard({ item }: CollectionFeedCardProps) {
  const navigate = useNavigate();
  const profile = item.profiles as any;
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={() => navigate(`/collections/${item.slug}`)}
      data-visual-slot="feed-card"
      style={{
        // BG-P18. `--surface` and `--border` are the legacy `:root` pair — a 3%
        // white and a 14% white, fixed for a dark page. `--glass` on a `--line`
        // hairline at `--r-card` is the theme's own answer to the same three
        // questions, and it is what puts this card in the same room as the
        // build card beside it in the feed. Not `--card-frame`: that token is
        // half of the build card's two-layer pair and means "the record", which
        // this is not.
        background: t.glass,
        ...elevation.flat,
        borderRadius: r.card,
        marginBottom: 12,
        padding: '18px 20px',
        transition: feedback("border-color"),
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}
    >
      {/* Header */}
      <div className="flex items-center gap-2" style={{ height: 34 }}>
        <Link to={`/creator/${profile?.username}`} onClick={stop}>
          <Avatar className="shrink-0" style={{ width: 34, height: 34 }}>
            <AvatarFallback className="text-[10px]" style={{ background: t.action, color: t.onAction }}>{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <Link to={`/creator/${profile?.username}`} onClick={stop} className="hover:underline truncate" style={{ fontSize: 13, fontWeight: 500, color: t.text }}>
          {profile?.display_name || profile?.username || "Unknown"}
        </Link>
        <span className="truncate" style={{ ...dataText, fontSize: 12, color: t.text2 }}>@{profile?.username}</span>
        <span style={{ color: t.text2 }}>·</span>
        <span className="shrink-0" style={{ ...dataText, fontSize: 12, color: t.text2 }}>{timeAgo(item.created_at)}</span>
        <div className="ml-auto shrink-0" onClick={stop}>
          <BookmarkButton contentId={item.id} />
        </div>
      </div>

      {/* Badge */}
      <div className="flex items-center gap-1.5 mt-1">
        {/* BG-P18. The fourteen legacy content-type badge colours are retired
            by the theme: a content type is not a part category, and nothing
            that is not a part category carries one of the nine hues. `secondary`
            is the kit's neutral chip — `--recess` under `--text2` — which is
            what the theme says a label with no category resolves to. */}
        <Badge variant="secondary">Collection</Badge>
      </div>

      {/* Title + Description */}
      <p className="line-clamp-2" style={{ fontSize: 15, fontWeight: 600, color: t.text, lineHeight: 1.3, marginTop: 10 }}>{item.title}</p>
      {item.description && (
        <p className="truncate" style={{ fontSize: 12, color: t.text2, marginTop: 4 }}>{item.description}</p>
      )}

      {/* Mosaic */}
      {item._cover_images && item._cover_images.length > 0 && (
        <CoverMosaic images={item._cover_images} title={item.title} />
      )}

      {/* Stats row */}
      <div className="flex items-center" style={{ gap: 16, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}`, fontSize: 12, fontWeight: 400, color: t.text2 }}>
        <span className="inline-flex items-center gap-1 shrink-0">{item.item_count} blueprint{item.item_count !== 1 ? "s" : ""}</span>
        <span className="inline-flex items-center gap-1 shrink-0"><Users style={{ width: 15, height: 15 }} />{formatNum(item.follower_count)} followers</span>
      </div>
    </div>
  );
}
