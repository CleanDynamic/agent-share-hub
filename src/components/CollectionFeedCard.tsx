import { Link, useNavigate } from "react-router-dom";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, Users } from "lucide-react";
import { timeAgo, formatNum } from "@/components/FeedItem";

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
    <div className="w-full rounded-xl overflow-hidden mt-2 grid grid-cols-2 gap-[2px]" style={{ maxHeight: 200 }}>
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
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        marginBottom: 12,
        padding: '18px 20px',
        transition: 'border-color 0.2s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Header */}
      <div className="flex items-center gap-2" style={{ height: 34 }}>
        <Link to={`/creator/${profile?.username}`} onClick={stop}>
          <Avatar className="shrink-0" style={{ width: 34, height: 34 }}>
            <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <Link to={`/creator/${profile?.username}`} onClick={stop} className="hover:underline truncate" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.90)' }}>
          {profile?.display_name || profile?.username || "Unknown"}
        </Link>
        <span className="truncate" style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>@{profile?.username}</span>
        <span style={{ color: 'rgba(255,255,255,0.20)' }}>·</span>
        <span className="shrink-0" style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>{timeAgo(item.created_at)}</span>
        <div className="ml-auto shrink-0" onClick={stop}>
          <BookmarkButton contentId={item.id} />
        </div>
      </div>

      {/* Badge */}
      <div className="flex items-center gap-1.5 mt-1">
        <Badge variant="outline" className="text-[10px] font-medium bg-[#1F7A6D]/20 text-[#1F7A6D] border-[#1F7A6D]/25">
          Collection
        </Badge>
      </div>

      {/* Title + Description */}
      <p className="line-clamp-2" style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.90)', lineHeight: 1.3, marginTop: 10 }}>{item.title}</p>
      {item.description && (
        <p className="truncate" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{item.description}</p>
      )}

      {/* Mosaic */}
      {item._cover_images && item._cover_images.length > 0 && (
        <CoverMosaic images={item._cover_images} title={item.title} />
      )}

      {/* Stats row */}
      <div className="flex items-center" style={{ gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.12)', fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}>
        <span className="inline-flex items-center gap-1 shrink-0">{item.item_count} blueprint{item.item_count !== 1 ? "s" : ""}</span>
        <span className="inline-flex items-center gap-1 shrink-0"><Users style={{ width: 15, height: 15 }} />{formatNum(item.follower_count)} followers</span>
      </div>
    </div>
  );
}
