import { Link, useNavigate } from "react-router-dom";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, Users } from "lucide-react";
import { timeAgo, formatNum } from "@/components/FeedItem";
import { ReblogButton } from "@/components/ReblogButton";
import { useAuth } from "@/contexts/AuthContext";
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
  const { isLoggedIn } = useAuth();
  const profile = item.profiles as any;
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div style={{ width: "100%", marginBottom: "8px" }}>
    <div
      onClick={() => navigate(`/collections/${item.slug}`)}
      className="px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-[hsl(0_0%_100%/0.03)]"
    >
      {/* Header */}
      <div className="flex items-center gap-2" style={{ height: 36 }}>
        <Link to={`/creator/${profile?.username}`} onClick={stop}>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <Link to={`/creator/${profile?.username}`} onClick={stop} className="text-sm font-semibold text-foreground hover:underline truncate">
          {profile?.display_name || profile?.username || "Unknown"}
        </Link>
        <span className="text-[13px] text-muted-foreground truncate">@{profile?.username}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground shrink-0">{timeAgo(item.created_at)}</span>
        <div className="ml-auto shrink-0" onClick={stop}>
          <BookmarkButton contentId={item.id} />
        </div>
      </div>

      {/* Badge */}
      <div className="flex items-center gap-1.5 mt-1">
        <Badge variant="outline" className="text-[10px] font-medium bg-[#2EC4B6]/20 text-[#2EC4B6] border-[#2EC4B6]/25">
          Collection
        </Badge>
      </div>

      {/* Title + Description */}
      <p className="text-sm font-semibold text-foreground leading-[1.3] mt-1 line-clamp-2">{item.title}</p>
      {item.description && (
        <p className="text-[13px] text-muted-foreground truncate mt-0.5">{item.description}</p>
      )}

      {/* Mosaic */}
      {item._cover_images && item._cover_images.length > 0 && (
        <CoverMosaic images={item._cover_images} title={item.title} />
      )}

      {/* Blueprint count */}
      <p className="text-xs text-muted-foreground mt-1.5">{item.item_count} blueprint{item.item_count !== 1 ? "s" : ""}</p>

      {/* Stats */}
      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-[3px] shrink-0"><Users className="h-3 w-3" />{formatNum(item.follower_count)} followers</span>
        {isLoggedIn && (
          <>
            <span className="text-[#444450] shrink-0">·</span>
            <span onClick={stop}>
              <ReblogButton
                source={{
                  type: "collection",
                  id: item.id,
                  title: item.title,
                  creatorUsername: profile?.username ?? "unknown",
                  itemCount: item.item_count,
                  coverImages: item._cover_images,
                  slug: item.slug ?? undefined,
                }}
              />
            </span>
          </>
        )}
      </div>
    </div>
    </div>
  );
}
