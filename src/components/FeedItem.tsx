import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Download, Eye, Star, StarHalf, MessageSquare, FolderOpen, ChevronDown, ChevronUp, Send as SendIcon, Repeat2, Heart } from "lucide-react";
import { TYPE_COLORS, displayContentType } from "@/lib/content-types";
import { FeedItemExpanded } from "@/components/FeedItemExpanded";
import { ShareToDMModal } from "@/components/dm/ShareToDMModal";
import { ReblogModal } from "@/components/ReblogModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/* ---- Helpers ---- */

export { TYPE_COLORS };

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

/* ---- What to Expect teaser extractor ---- */
function extractWteTeaser(item: any): string | null {
  const blocks = item.what_to_expect_blocks as any[] | null;
  if (blocks && Array.isArray(blocks) && blocks.length > 0) {
    const firstText = blocks.find((b: any) => b.block_type === "text" && b.text_content);
    if (firstText) {
      const text = (firstText.text_content as string).trim();
      return text.length > 80 ? text.slice(0, 77) + "…" : text;
    }
  }
  const plain = item.what_to_expect as string | null;
  if (plain) {
    const firstSentence = plain.split(/[.!?\n]/)[0]?.trim();
    if (firstSentence) {
      return firstSentence.length > 80 ? firstSentence.slice(0, 77) + "…" : firstSentence;
    }
  }
  return null;
}

/* ---- Tools + Use Cases Row ---- */
function ToolsUseCasesRow({ item }: { item: any }) {
  const tools = (item.ai_tools ?? []) as string[];
  const useCases = (item.use_cases ?? []) as string[];
  const customDesc = item.custom_use_case_description as string | null;

  if (tools.length === 0 && useCases.length === 0) return null;

  const otherToolName = item.other_tool_name as string | null;
  const displayTools = tools.slice(0, 2).map((t: string) =>
    t === "Other" && otherToolName ? otherToolName : t
  );
  const extraTools = tools.length - 2;
  const displayUseCases = useCases.slice(0, 2).map((uc: string) =>
    uc === "Other" && customDesc ? customDesc : uc
  );
  const extraUseCases = useCases.length - 2;

  const pillClass = "text-[10px] px-1.5 py-0.5 rounded bg-[hsl(240,14%,13%)] text-[hsl(240,7%,60%)]";

  return (
    <div className="flex items-center flex-wrap gap-1 mt-1">
      {displayTools.map((t) => (
        <span key={t} className={pillClass}>{t}</span>
      ))}
      {extraTools > 0 && <span className={pillClass}>+{extraTools} more</span>}
      {displayTools.length > 0 && displayUseCases.length > 0 && (
        <span className="text-[10px] text-muted-foreground/40">·</span>
      )}
      {displayUseCases.map((u, i) => (
        <span key={i} className={pillClass}>{u}</span>
      ))}
      {extraUseCases > 0 && <span className={pillClass}>+{extraUseCases} more</span>}
    </div>
  );
}

/* ---- Project indicator ---- */
function ProjectIndicator({ item, stop }: { item: any; stop: (e: React.MouseEvent) => void }) {
  const navigate = useNavigate();
  const proj = item._project as { id: string; title: string } | undefined;
  if (!proj) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer truncate max-w-[160px]"
      onClick={(e) => { stop(e); navigate(`/project/${proj.id}`); }}
    >
      <FolderOpen className="h-3 w-3 shrink-0" />
      <span className="truncate">{proj.title}</span>
    </span>
  );
}

/* ---- Like button ---- */
function LikeButton({ contentId, likeCount, stop }: { contentId: string; likeCount: number; stop: (e: React.MouseEvent) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);

  const { data: isLiked } = useQuery({
    queryKey: ["content_like", contentId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("content_likes" as any)
        .select("id")
        .eq("content_id", contentId)
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const liked = optimisticLiked ?? isLiked ?? false;
  const count = optimisticCount ?? likeCount;

  async function handleLike(e: React.MouseEvent) {
    stop(e);
    if (!user) return;

    const newLiked = !liked;
    setOptimisticLiked(newLiked);
    setOptimisticCount(newLiked ? count + 1 : Math.max(0, count - 1));

    try {
      if (newLiked) {
        await supabase.from("content_likes" as any).insert({ content_id: contentId, user_id: user.id } as any);
      } else {
        await supabase.from("content_likes" as any).delete().eq("content_id", contentId).eq("user_id", user.id);
      }
      queryClient.invalidateQueries({ queryKey: ["content_like", contentId, user.id] });
    } catch {
      setOptimisticLiked(!newLiked);
      setOptimisticCount(count);
    }
  }

  return (
    <button
      onClick={handleLike}
      className="inline-flex items-center gap-[3px] shrink-0 hover:text-foreground transition-colors"
      style={liked ? { color: "#E8571A" } : {}}
    >
      <Heart className={`h-3 w-3 ${liked ? "fill-current" : ""}`} />
      {count > 0 && <span>{formatNum(count)}</span>}
    </button>
  );
}

/* ---- Quoted Post Card (for reblog rendering) ---- */
function QuotedPostCard({ originalItem, stop }: { originalItem: any; stop: (e: React.MouseEvent) => void }) {
  const navigate = useNavigate();
  const creator = originalItem.profiles as any;
  const initials = (creator?.display_name || creator?.username || "?").slice(0, 2).toUpperCase();

  return (
    <div
      className="rounded-[10px] p-3 mt-2 cursor-pointer hover:bg-white/5 transition-colors"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10 }}
      onClick={(e) => { stop(e); navigate(`/content/${originalItem.id}`); }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-primary text-primary-foreground text-[9px]">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-[13px] font-bold text-foreground">{creator?.display_name || creator?.username}</span>
        <span className="text-[11px] text-muted-foreground">@{creator?.username}</span>
      </div>
      <div className="flex items-center gap-1 mb-1">
        <Badge variant="outline" className={`text-[9px] font-medium ${TYPE_COLORS[originalItem.content_type] ?? ""}`}>
          {displayContentType(originalItem.content_type)}
        </Badge>
        <Badge variant="outline" className={`text-[9px] font-medium ${difficultyColor(originalItem.difficulty)}`}>
          {originalItem.difficulty}
        </Badge>
      </div>
      <p className="text-[13px] font-bold text-foreground line-clamp-2">{originalItem.title}</p>
      {originalItem.cover_image_url && (
        <img
          src={originalItem.cover_image_url}
          alt=""
          loading="lazy"
          className="w-full rounded-md mt-1.5 object-cover"
          style={{ maxHeight: 120 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}

/* ---- Thread Inline Viewer ---- */
function ThreadPosts({ threadStarterId, totalPosts, stop }: { threadStarterId: string; totalPosts: number; stop: (e: React.MouseEvent) => void }) {
  const { data: posts } = useQuery({
    queryKey: ["thread_posts", threadStarterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(username, display_name)")
        .eq("thread_id", threadStarterId)
        .eq("status", "approved")
        .order("thread_position");
      return (data as any[]) ?? [];
    },
  });

  if (!posts || posts.length === 0) return null;

  return (
    <div className="mt-2 space-y-0 border-l-2 pl-3" style={{ borderColor: "#2EC4B6" }}>
      {posts.map((post: any) => (
        <div key={post.id} className="py-2 relative">
          <div className="absolute -left-[19px] top-3 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center">
            <Avatar className="h-4 w-4">
              <AvatarFallback className="bg-primary text-primary-foreground text-[8px]">
                {(post.profiles?.display_name || post.profiles?.username || "?")[0]}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] text-foreground leading-relaxed flex-1">{post.text_content}</p>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {post.thread_position} / {post.thread_total}
            </span>
          </div>
          {post.cover_image_url && (
            <img
              src={post.cover_image_url}
              alt=""
              className="w-full rounded-lg mt-1.5 object-cover"
              style={{ maxHeight: 160 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ---- Reblog Feed Card ---- */
function ReblogCard({ item, navState, stop }: { item: any; navState: any; stop: (e: React.MouseEvent) => void }) {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const profile = item.profiles as any;
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  // Fetch original post data
  const { data: originalItem } = useQuery({
    queryKey: ["reblog_original", item.reblog_of_content_id],
    queryFn: async () => {
      if (!item.reblog_of_content_id) return null;
      const { data } = await supabase
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(username, display_name)")
        .eq("id", item.reblog_of_content_id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!item.reblog_of_content_id,
  });

  const handleCardClick = () => {
    navigate(`/content/${item.id}`, { state: navState });
  };

  return (
    <div
      onClick={handleCardClick}
      className="px-4 py-3 border-b border-border cursor-pointer transition-colors duration-150 hover:bg-[hsl(0_0%_100%/0.03)]"
    >
      {/* Header row */}
      <div className="flex items-center gap-2" style={{ height: 36 }}>
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

      {/* Reblog label */}
      <div className="flex items-center gap-1 mt-1">
        <Repeat2 className="h-3 w-3" style={{ color: "#2EC4B6" }} />
        <span className="text-[11px]" style={{ color: "#2EC4B6" }}>Reblogged</span>
      </div>

      {/* Reblog comment */}
      {item.reblog_comment && (
        <p className="text-[14px] text-foreground italic mt-1 line-clamp-3">{item.reblog_comment}</p>
      )}

      {/* Quoted post card */}
      {originalItem ? (
        <QuotedPostCard originalItem={originalItem} stop={stop} />
      ) : (
        <div
          className="rounded-[10px] p-3 mt-2 text-xs text-muted-foreground"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          Original post unavailable
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
        <div onClick={stop}>
          <LikeButton contentId={item.id} likeCount={item.like_count ?? 0} stop={stop} />
        </div>
        <span className="text-[#444450]">·</span>
        <span className="inline-flex items-center gap-[3px]">
          <Eye className="h-3 w-3" />{formatNum(item.view_count ?? 0)}
        </span>
        {isLoggedIn && (
          <>
            <span className="text-[#444450]">·</span>
            <button
              onClick={(e) => { stop(e); }}
              className="inline-flex items-center gap-[3px] hover:text-foreground transition-colors"
            >
              <SendIcon className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Component ---- */

interface FeedItemProps {
  item: any;
  rank?: number;
  /** Where this feed item is rendered — controls density */
  context?: "home" | "browse" | "category" | "profile";
  /** Navigation state label for back button on detail page */
  navState?: { from: string; name?: string };
}

export function FeedItem({ item, rank, context = "home", navState }: FeedItemProps) {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reblogOpen, setReblogOpen] = useState(false);
  const [threadExpanded, setThreadExpanded] = useState(false);
  const profile = item.profiles as any;
  const starVal = roundedStars(Number(item.avg_rating) || 0, item.rating_count ?? 0);
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  const state = navState ?? { from: context === "browse" ? "browse" : "feed" };

  // Check if already reblogged by current user
  const { data: alreadyReblogged } = useQuery({
    queryKey: ["user_reblogged", item.id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("content_items")
        .select("id")
        .eq("reblog_of_content_id", item.id)
        .eq("creator_id", user.id)
        .eq("is_reblog", true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!item.id && !(item as any).is_reblog,
  });

  const handleCardClick = () => {
    navigate(`/content/${item.id}`, { state });
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const isLight = context === "home";
  const isBlog = item.content_type === "Blog";
  const isReblog = !!(item as any).is_reblog;
  const isThread = !!(item as any).is_thread_post && (item as any).thread_position === 1;

  // WTE teaser
  const wteTeaser = extractWteTeaser(item);

  // Render reblog cards differently
  if (isReblog) {
    return <ReblogCard item={item} navState={state} stop={stop} />;
  }

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

      {/* LINE 2 — Badges + project indicator */}
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <Badge variant="outline" className={`text-[10px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
          {displayContentType(item.content_type)}
        </Badge>
        <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(item.difficulty)}`}>
          {item.difficulty}
        </Badge>
        {/* Thread indicator */}
        {isThread && (
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
            🧵 Thread
          </span>
        )}
        {/* AI Tools subtype indicator */}
        {item.content_type === "AI Tools (LLMs)" && (item as any).tool_subtype === "local" && (
          <>
            <span className="text-[10px] text-muted-foreground/60">🖥️ Local</span>
            {(item as any).model_parameters && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(240,14%,13%)] text-[hsl(240,7%,60%)]">
                {(item as any).model_parameters}
              </span>
            )}
          </>
        )}
        {item.content_type === "AI Tools (LLMs)" && (item as any).tool_subtype === "api" && (
          <span className="text-[10px] text-muted-foreground/60">🌐 API</span>
        )}
        <ProjectIndicator item={item} stop={stop} />
      </div>

      {/* LINE 3 — Title */}
      <p className="text-sm font-semibold text-foreground leading-[1.3] mt-1 line-clamp-2">{item.title}</p>

      {/* LINE 3.5 — Hook subtitle (blogs only) */}
      {isBlog && item.description && (
        <p className="text-[13px] text-muted-foreground italic truncate mt-0.5">{item.description}</p>
      )}

      {/* LINE 4.25 — What to Expect teaser (non-blogs only) */}
      {!isBlog && wteTeaser && (
        <p className="text-[12px] italic mt-0.5 truncate" style={{ color: "#2EC4B6" }}>
          <Eye className="inline h-[10px] w-[10px] mr-1" style={{ verticalAlign: "middle" }} />
          <span className="opacity-70">Expect: </span>
          {wteTeaser}
        </p>
      )}

      {/* LINE 4.5 — Tools + Use Cases row (hidden on home/light feeds) */}
      {!isLight && <ToolsUseCasesRow item={item} />}

      {/* LINE 5 — Cover image */}
      {item.cover_image_url && (
        <img
          src={item.cover_image_url}
          alt={item.title}
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          className="w-full rounded-xl mt-2 block object-cover"
          style={{ maxHeight: 200 }}
        />
      )}

      {/* Thread expand control */}
      {isThread && (item as any).thread_total > 1 && (
        <div className="mt-2">
          <button
            onClick={(e) => { stop(e); setThreadExpanded(!threadExpanded); }}
            className="text-[12px] font-medium transition-colors"
            style={{ color: "#2EC4B6" }}
          >
            {threadExpanded
              ? "Collapse thread ▲"
              : `Show thread (${(item as any).thread_total} posts)`}
          </button>
          {threadExpanded && (
            <ThreadPosts
              threadStarterId={item.id}
              totalPosts={(item as any).thread_total}
              stop={stop}
            />
          )}
        </div>
      )}

      {/* LINE 6 — Stats + Show More */}
      {(() => {
        const canExpand = item.content_type !== "AI Tools (LLMs)" && !isBlog && !isThread;
        return (
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-nowrap overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <span className="inline-flex items-center gap-[3px] shrink-0"><Eye className="h-3 w-3" />{formatNum(item.view_count ?? 0)}</span>
              {!isBlog && !isThread && (
                <>
                  <span className="text-[#444450] shrink-0">·</span>
                  <span className="inline-flex items-center gap-[3px] shrink-0"><Download className="h-3 w-3" />{formatNum(item.download_count ?? 0)}</span>
                </>
              )}
              {isBlog && (item as any).estimated_read_minutes && (
                <>
                  <span className="text-[#444450] shrink-0">·</span>
                  <span className="inline-flex items-center gap-[3px] shrink-0 text-muted-foreground">~{(item as any).estimated_read_minutes} min read</span>
                </>
              )}
              {(item.rating_count ?? 0) > 0 && !isThread && (
                <>
                  <span className="text-[#444450] shrink-0">·</span>
                  <MiniStars value={starVal} />
                </>
              )}
              {isThread && (
                <>
                  <span className="text-[#444450] shrink-0">·</span>
                  <div onClick={stop}>
                    <LikeButton contentId={item.id} likeCount={item.like_count ?? 0} stop={stop} />
                  </div>
                </>
              )}
              {!isLight && (
                <>
                  <span className="text-[#444450] shrink-0">·</span>
                  <span className="inline-flex items-center gap-[3px] shrink-0"><MessageSquare className="h-3 w-3" />{item.comment_count ?? 0}</span>
                </>
              )}
              {isLoggedIn && !isReblog && (
                <>
                  <span className="text-[#444450] shrink-0">·</span>
                  <button
                    onClick={(e) => { stop(e); setReblogOpen(true); }}
                    className="inline-flex items-center gap-[3px] shrink-0 hover:text-foreground transition-colors"
                    title="Reblog"
                    style={alreadyReblogged ? { color: "#2EC4B6" } : {}}
                  >
                    <Repeat2 className="h-3 w-3" />
                  </button>
                  <span className="text-[#444450] shrink-0">·</span>
                  <button
                    onClick={(e) => { stop(e); setShareOpen(true); }}
                    className="inline-flex items-center gap-[3px] shrink-0 hover:text-foreground transition-colors"
                  >
                    <SendIcon className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
            {canExpand && (
              <button
                onClick={(e) => { stop(e); setExpanded(!expanded); }}
                className="inline-flex items-center gap-1 shrink-0 ml-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? "Show less" : "Show more"}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>
        );
      })()}

      {/* Expanded panel */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: expanded ? 500 : 0, opacity: expanded ? 1 : 0 }}
      >
        {expanded && (
          <div className="mt-2 pt-2 border-t border-border">
            <FeedItemExpanded
              contentId={item.id}
              description={item.description ?? null}
              whatToExpect={item.what_to_expect ?? null}
              whatToExpectBlocks={item.what_to_expect_blocks as any[] | null}
            />
          </div>
        )}
      </div>

      {/* Share to DM modal */}
      {shareOpen && (
        <ShareToDMModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          contentId={item.id}
          contentTitle={item.title}
        />
      )}

      {/* Reblog modal */}
      {reblogOpen && (
        <ReblogModal
          open={reblogOpen}
          onOpenChange={setReblogOpen}
          originalItem={{
            id: item.id,
            title: item.title,
            content_type: item.content_type,
            difficulty: item.difficulty,
            cover_image_url: (item as any).cover_image_url,
            created_at: item.created_at,
            creator_id: item.creator_id,
          }}
          originalCreator={{
            id: item.creator_id,
            username: (item.profiles as any)?.username || "unknown",
            display_name: (item.profiles as any)?.display_name || null,
          }}
          alreadyReblogged={alreadyReblogged ?? false}
        />
      )}
    </div>
  );
}
