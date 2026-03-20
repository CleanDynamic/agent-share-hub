/**
 * ReblogFeedCard — renders a reblog content_item in the feed.
 *
 * The item has is_reblog=true and one of:
 *   reblog_of_content_id   → blueprint/blog reblog
 *   reblog_of_collection_id → collection reblog
 *   reblog_of_project_id   → project reblog
 *   quoted_reblog_id       → reblog-of-reblog (also has one of the above for the original source)
 */

import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, Heart, Repeat2 } from "lucide-react";
import { timeAgo, formatNum } from "@/components/FeedItem";
import { ReblogButton } from "@/components/ReblogButton";
import { TYPE_COLORS, displayContentType } from "@/lib/content-types";
import type { ReblogSource } from "@/components/ReblogModal";

// ── Compact quoted card variants ─────────────────────────────

function QuotedContentCard({
  title,
  contentType,
  creatorUsername,
  coverUrl,
  contentId,
}: {
  title: string;
  contentType?: string;
  creatorUsername: string;
  coverUrl?: string | null;
  contentId: string;
}) {
  const navigate = useNavigate();
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const typeColor = contentType ? (TYPE_COLORS[contentType] ?? TYPE_COLORS["Failure Library"]) : "bg-muted text-muted-foreground";

  return (
    <div
      className="rounded-lg border border-border bg-card/60 p-3 flex items-start gap-3 cursor-pointer hover:bg-card/80 transition-colors"
      onClick={(e) => { stop(e); navigate(`/content/${contentId}`); }}
    >
      <div className="flex-1 min-w-0">
        {contentType && (
          <Badge variant="outline" className={`text-[10px] font-medium mb-1 ${typeColor}`}>
            {displayContentType(contentType)}
          </Badge>
        )}
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        <p className="text-[12px] text-muted-foreground">by @{creatorUsername}</p>
      </div>
      {coverUrl && (
        <img
          src={coverUrl}
          alt={title}
          className="h-[56px] w-[56px] rounded-md object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}

function QuotedCollectionCard({
  id,
  title,
  creatorUsername,
  itemCount,
  coverImages,
  slug,
}: {
  id: string;
  title: string;
  creatorUsername: string;
  itemCount: number;
  coverImages?: string[];
  slug?: string | null;
}) {
  const navigate = useNavigate();
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const cells = (coverImages ?? []).slice(0, 4);

  return (
    <div
      className="rounded-lg border border-[#2EC4B6]/25 p-3 flex items-start gap-3 cursor-pointer hover:opacity-90 transition-opacity"
      style={{ background: "rgba(46,196,182,0.06)" }}
      onClick={(e) => { stop(e); navigate(slug ? `/collections/${slug}` : `/collections/${id}`); }}
    >
      <div className="flex-1 min-w-0">
        <Badge variant="outline" className="text-[10px] font-medium mb-1 bg-[#2EC4B6]/20 text-[#2EC4B6] border-[#2EC4B6]/25">
          Collection
        </Badge>
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        <p className="text-[12px] text-muted-foreground">by @{creatorUsername}</p>
        <p className="text-[11px] text-muted-foreground">{itemCount} blueprint{itemCount !== 1 ? "s" : ""}</p>
      </div>
      {cells.length > 0 && (
        <div className="grid grid-cols-2 gap-[2px] shrink-0" style={{ width: 56, height: 56 }}>
          {cells.map((url, i) => (
            <img key={i} src={url} alt="" className="w-full h-full object-cover"
              style={{ borderRadius: i === 0 ? "3px 0 0 0" : i === 1 ? "0 3px 0 0" : i === 2 ? "0 0 0 3px" : "0 0 3px 0" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuotedProjectCard({
  id,
  title,
  creatorUsername,
  blueprintCount,
  coverUrl,
  packagePrice,
}: {
  id: string;
  title: string;
  creatorUsername: string;
  blueprintCount: number;
  coverUrl?: string | null;
  packagePrice?: number | null;
}) {
  const navigate = useNavigate();
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className="rounded-lg border border-[#E8571A]/25 p-3 flex items-start gap-3 cursor-pointer hover:opacity-90 transition-opacity"
      style={{ background: "rgba(232,87,26,0.06)" }}
      onClick={(e) => { stop(e); navigate(`/project/${id}`); }}
    >
      <div className="flex-1 min-w-0">
        <Badge variant="outline" className="text-[10px] font-medium mb-1 bg-primary/20 text-primary border-primary/25">
          Project
        </Badge>
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        <p className="text-[12px] text-muted-foreground">by @{creatorUsername}</p>
        <p className="text-[11px] text-muted-foreground">
          {blueprintCount} blueprint{blueprintCount !== 1 ? "s" : ""}
          {packagePrice != null && ` · £${packagePrice}`}
        </p>
      </div>
      {coverUrl && (
        <img
          src={coverUrl}
          alt={title}
          className="h-[56px] w-[56px] rounded-md object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}

// ── Source fetcher hooks ──────────────────────────────────────

function useContentSource(id: string | null) {
  return useQuery({
    queryKey: ["reblog_source_content", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type, cover_image_url, is_reblog, reblog_of_content_id, reblog_of_collection_id, reblog_of_project_id, quoted_reblog_id, reblog_comment, profiles(username)")
        .eq("id", id!)
        .maybeSingle();
      return data as any;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

function useCollectionSource(id: string | null) {
  return useQuery({
    queryKey: ["reblog_source_collection", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collections")
        .select("id, title, slug, item_count, profiles(username)")
        .eq("id", id!)
        .maybeSingle();
      return data as any;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

function useProjectSource(id: string | null) {
  return useQuery({
    queryKey: ["reblog_source_project", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, cover_image_url, package_price_enabled, package_price_gbp, profiles(username)")
        .eq("id", id!)
        .maybeSingle();
      return data as any;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ── Main component ────────────────────────────────────────────

interface ReblogFeedCardProps {
  item: any; // content_item row with is_reblog=true, joined profiles
  context?: "home" | "browse" | "category" | "profile";
  navState?: { from: string; name?: string };
}

export function ReblogFeedCard({ item, context = "home" }: ReblogFeedCardProps) {
  const navigate = useNavigate();
  const profile = item.profiles as any;
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const contentId: string | null = item.reblog_of_content_id ?? null;
  const collectionId: string | null = item.reblog_of_collection_id ?? null;
  const projectId: string | null = item.reblog_of_project_id ?? null;
  const quotedReblogId: string | null = item.quoted_reblog_id ?? null;

  // Fetch source data based on what's set
  const { data: contentSource } = useContentSource(contentId);
  const { data: collectionSource } = useCollectionSource(collectionId);
  const { data: projectSource } = useProjectSource(projectId);
  const { data: quotedReblog } = useContentSource(quotedReblogId);

  // Build the ReblogSource for the ReblogButton (reblogging this reblog)
  const reblogSource: ReblogSource = contentId
    ? {
        type: "content",
        id: contentId,
        title: contentSource?.title ?? "Blueprint",
        creatorUsername: (contentSource?.profiles as any)?.username ?? "unknown",
        contentType: contentSource?.content_type,
        coverUrl: contentSource?.cover_image_url,
      }
    : collectionId
    ? {
        type: "collection",
        id: collectionId,
        title: collectionSource?.title ?? "Collection",
        creatorUsername: (collectionSource?.profiles as any)?.username ?? "unknown",
        itemCount: collectionSource?.item_count ?? 0,
        slug: collectionSource?.slug,
      }
    : projectId
    ? {
        type: "project",
        id: projectId,
        title: projectSource?.title ?? "Project",
        creatorUsername: (projectSource?.profiles as any)?.username ?? "unknown",
        blueprintCount: 0,
        coverUrl: projectSource?.cover_image_url,
        packagePrice: projectSource?.package_price_enabled ? projectSource?.package_price_gbp : null,
      }
    : {
        type: "reblog",
        reblogId: item.id,
        rebloggerUsername: profile?.username ?? "unknown",
        reblogComment: item.reblog_comment,
        originalType: "content",
        originalId: contentId ?? "",
        originalTitle: contentSource?.title ?? "Post",
        originalCreatorUsername: (contentSource?.profiles as any)?.username ?? "unknown",
      };

  const renderQuotedCard = () => {
    // Reblog-of-reblog: show the quoted reblog chain
    if (quotedReblogId && quotedReblog) {
      const qProfile = (quotedReblog.profiles as any);
      const origTitle =
        contentSource?.title ??
        collectionSource?.title ??
        projectSource?.title ??
        "Post";
      const origCreator =
        (contentSource?.profiles as any)?.username ??
        (collectionSource?.profiles as any)?.username ??
        (projectSource?.profiles as any)?.username ??
        "unknown";
      const origType: "content" | "collection" | "project" =
        collectionId ? "collection" : projectId ? "project" : "content";

      return (
        <div
          className="rounded-lg border border-border bg-card/50 p-3 space-y-2 cursor-pointer hover:bg-card/70 transition-colors"
          onClick={(e) => { stop(e); navigate(`/content/${quotedReblogId}`); }}
        >
          <p className="text-[11px] text-muted-foreground">
            @{qProfile?.username ?? "unknown"} reblogged:
          </p>
          {quotedReblog.reblog_comment && (
            <p className="text-[13px] italic text-foreground/80">{quotedReblog.reblog_comment}</p>
          )}
          <div className="rounded-md border border-border bg-background/50 p-2 flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] font-medium shrink-0 ${
                origType === "collection"
                  ? "bg-[#2EC4B6]/20 text-[#2EC4B6] border-[#2EC4B6]/25"
                  : origType === "project"
                  ? "bg-primary/20 text-primary border-primary/25"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {origType === "collection" ? "Collection" : origType === "project" ? "Project" : "Blueprint"}
            </Badge>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{origTitle}</p>
              <p className="text-[11px] text-muted-foreground">by @{origCreator}</p>
            </div>
          </div>
        </div>
      );
    }

    if (contentId && contentSource) {
      return (
        <QuotedContentCard
          title={contentSource.title}
          contentType={contentSource.content_type}
          creatorUsername={(contentSource.profiles as any)?.username ?? "unknown"}
          coverUrl={contentSource.cover_image_url}
          contentId={contentId}
        />
      );
    }

    if (collectionId && collectionSource) {
      return (
        <QuotedCollectionCard
          id={collectionId}
          title={collectionSource.title}
          creatorUsername={(collectionSource.profiles as any)?.username ?? "unknown"}
          itemCount={collectionSource.item_count ?? 0}
          slug={collectionSource.slug}
        />
      );
    }

    if (projectId && projectSource) {
      return (
        <QuotedProjectCard
          id={projectId}
          title={projectSource.title}
          creatorUsername={(projectSource.profiles as any)?.username ?? "unknown"}
          blueprintCount={0}
          coverUrl={projectSource.cover_image_url}
          packagePrice={projectSource.package_price_enabled ? projectSource.package_price_gbp : null}
        />
      );
    }

    return null;
  };

  return (
    <div
      onClick={() => navigate(`/content/${item.id}`)}
      className="px-4 py-3 border-b border-border cursor-pointer transition-colors duration-150 hover:bg-[hsl(0_0%_100%/0.03)]"
    >
      {/* Reblog header label */}
      <div className="flex items-center gap-1.5 mb-2">
        <Repeat2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#2EC4B6" }} />
        <span className="text-[11px] font-medium" style={{ color: "#2EC4B6" }}>Reblogged</span>
      </div>

      {/* Reblogger info row */}
      <div className="flex items-center gap-2 mb-2">
        <Link to={`/creator/${profile?.username}`} onClick={stop}>
          <Avatar className="h-8 w-8 shrink-0">
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
      </div>

      {/* Reblog comment */}
      {item.reblog_comment && (
        <p className="text-[13px] italic text-foreground/80 mb-2 px-1">{item.reblog_comment}</p>
      )}

      {/* Quoted card */}
      <div onClick={stop}>
        {renderQuotedCard()}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-[3px] shrink-0">
          <Eye className="h-3 w-3" />{formatNum(item.view_count ?? 0)}
        </span>
        <span className="text-[#444450] shrink-0">·</span>
        <span className="inline-flex items-center gap-[3px] shrink-0">
          <Heart className="h-3 w-3" />{formatNum(item.like_count ?? 0)}
        </span>
        <span className="text-[#444450] shrink-0">·</span>
        <span onClick={stop}>
          <ReblogButton source={reblogSource} />
        </span>
      </div>
    </div>
  );
}
