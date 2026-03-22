import { Link, useNavigate } from "react-router-dom";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, Star, ClipboardList } from "lucide-react";
import { timeAgo, formatNum, roundedStars } from "@/components/FeedItem";
import { displayContentType } from "@/lib/content-types";
import { ReblogButton } from "@/components/ReblogButton";
import { useAuth } from "@/contexts/AuthContext";
interface ProjectFeedCardProps {
  item: {
    id: string;
    title: string;
    description?: string | null;
    cover_image_url?: string | null;
    view_count: number;
    created_at: string;
    approved_at?: string | null;
    profiles?: any;
    _component_count?: number;
    _component_types?: string[];
    _cover_images?: string[];
    package_price_enabled?: boolean;
    package_price_gbp?: number | null;
    avg_rating?: number;
    rating_count?: number;
  };
}

function CoverMosaic({ images, title }: { images: string[]; title: string }) {
  const cells = images.slice(0, 4);
  if (cells.length === 0) return null;
  return (
    <div className="w-full rounded-xl overflow-hidden mt-2 grid grid-cols-2 gap-[2px]" style={{ maxHeight: 200 }}>
      {cells.map((url, i) => (
        <img key={i} src={url} alt={`${title} item ${i + 1}`} loading="lazy" className="w-full h-[100px] object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ))}
    </div>
  );
}

export function ProjectFeedCard({ item }: ProjectFeedCardProps) {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const profile = item.profiles as any;
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const compTypes = (item._component_types ?? []).slice(0, 3);
  const extraTypes = (item._component_types ?? []).length - 3;
  const starVal = roundedStars(Number(item.avg_rating) || 0, item.rating_count ?? 0);

  return (
    <div style={{ width: "100%", marginBottom: "8px" }}>
    <div
      onClick={() => navigate(`/project/${item.id}`)}
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
        <span className="text-xs text-muted-foreground shrink-0">{timeAgo(item.approved_at || item.created_at)}</span>
        <div className="ml-auto shrink-0" onClick={stop}>
          <BookmarkButton contentId={item.id} />
        </div>
      </div>

      {/* Badge + component type pills */}
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <Badge variant="outline" className="text-[10px] font-medium bg-primary/20 text-primary border-primary/25">
          Project
        </Badge>
        {compTypes.map((t) => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(240,14%,13%)] text-[hsl(240,7%,60%)]">
            {displayContentType(t)}
          </span>
        ))}
        {extraTypes > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(240,14%,13%)] text-[hsl(240,7%,60%)]">+{extraTypes} more</span>
        )}
      </div>

      {/* Title + Description */}
      <p className="text-sm font-semibold text-foreground leading-[1.3] mt-1 line-clamp-2">{item.title}</p>
      {item.description && (
        <p className="text-[13px] text-muted-foreground truncate mt-0.5">{item.description}</p>
      )}

      {/* Cover */}
      {item.cover_image_url ? (
        <img src={item.cover_image_url} alt={item.title} loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          className="w-full rounded-xl mt-2 block object-cover" style={{ maxHeight: 200 }} />
      ) : item._cover_images && item._cover_images.length > 0 ? (
        <CoverMosaic images={item._cover_images} title={item.title} />
      ) : null}

      {/* Stats */}
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-[3px] shrink-0">
          <ClipboardList className="h-3 w-3" />{item._component_count ?? 0} blueprints
        </span>
        <span className="text-[#444450] shrink-0">·</span>
        <span className="inline-flex items-center gap-[3px] shrink-0"><Eye className="h-3 w-3" />{formatNum(item.view_count)}</span>
        {(item.rating_count ?? 0) > 0 && (
          <>
            <span className="text-[#444450] shrink-0">·</span>
            <span className="inline-flex items-center gap-[3px] shrink-0"><Star className="h-3 w-3 fill-primary text-primary" />{(item.avg_rating ?? 0).toFixed(1)}</span>
          </>
        )}
        {isLoggedIn && (
          <>
            <span className="text-[#444450] shrink-0">·</span>
            <span onClick={stop}>
              <ReblogButton
                source={{
                  type: "project",
                  id: item.id,
                  title: item.title,
                  creatorUsername: profile?.username ?? "unknown",
                  blueprintCount: item._component_count ?? 0,
                  coverUrl: item.cover_image_url ?? null,
                  packagePrice: item.package_price_enabled ? (item.package_price_gbp ?? null) : null,
                }}
              />
            </span>
          </>
        )}
        {item.package_price_enabled && item.package_price_gbp != null && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/25 font-medium">
            From £{item.package_price_gbp}
          </span>
        )}
      </div>
    </div>
    </div>
  );
}
