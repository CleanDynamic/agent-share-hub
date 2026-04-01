import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Download, Eye, Star, StarHalf, MessageSquare, FolderOpen, ChevronDown, ChevronUp, Send as SendIcon, Repeat2 } from "lucide-react";
import { TYPE_COLORS, displayContentType } from "@/lib/content-types";
import { FeedItemExpanded } from "@/components/FeedItemExpanded";
import { ShareToDMModal } from "@/components/dm/ShareToDMModal";
import { useAuth } from "@/contexts/AuthContext";
import { BountyCard } from "@/components/BountyCard";
import { ReblogComposer, type ReblogComposerOriginal } from "@/components/ReblogComposer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/* ---- Helpers ---- */

export { TYPE_COLORS };

export function difficultyColor(level: string) {
  switch (level) {
    case "Beginner": return "bg-[#353439]/40 text-slate-400 border-white/8";
    case "Intermediate": return "bg-[#55e0d2]/10 text-[#55e0d2] border-[#55e0d2]/25";
    case "Advanced": return "bg-[#cb4300]/15 text-[#ffb59c] border-[#cb4300]/25";
    default: return "bg-[#353439]/20 text-slate-500 border-white/5";
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
  // Try what_to_expect_blocks first
  const blocks = item.what_to_expect_blocks as any[] | null;
  if (blocks && Array.isArray(blocks) && blocks.length > 0) {
    const firstText = blocks.find((b: any) => b.block_type === "text" && b.text_content);
    if (firstText) {
      const text = (firstText.text_content as string).trim();
      return text.length > 80 ? text.slice(0, 77) + "…" : text;
    }
  }
  // Fallback to plain text
  const plain = item.what_to_expect as string | null;
  if (plain) {
    const firstSentence = plain.split(/[.!?\n]/)[0]?.trim();
    if (firstSentence) {
      return firstSentence.length > 80 ? firstSentence.slice(0, 77) + "…" : firstSentence;
    }
  }
  return null;
}

/* ---- Tools + Use Cases + Topics Row ---- */
function ToolsUseCasesRow({ item }: { item: any }) {
  const tools = (item.ai_tools ?? []) as string[];
  const useCases = (item.use_cases ?? []) as string[];
  const topics = (item.topics ?? []) as string[];
  const customDesc = item.custom_use_case_description as string | null;

  if (tools.length === 0 && useCases.length === 0 && topics.length === 0) return null;

  const otherToolName = item.other_tool_name as string | null;
  const displayTools = tools.slice(0, 2).map((t: string) =>
    t === "Other" && otherToolName ? otherToolName : t
  );
  const extraTools = tools.length - 2;
  const displayUseCases = useCases.slice(0, 2).map((uc: string) =>
    uc === "Other" && customDesc ? customDesc : uc
  );
  const extraUseCases = useCases.length - 2;
  const displayTopics = topics.slice(0, 2);
  const extraTopics = topics.length - 2;

  const pillClass = "text-[10px] px-1.5 py-0.5 rounded bg-[hsl(240,14%,13%)] text-[hsl(240,7%,60%)]";
  const topicPillClass = "text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/70";

  return (
    <div className="flex items-center flex-wrap gap-1 mt-1">
      {displayTools.map((t) => (
        <span key={t} className={pillClass}>{t}</span>
      ))}
      {extraTools > 0 && <span className={pillClass}>+{extraTools} more</span>}
      {displayTools.length > 0 && (displayUseCases.length > 0 || displayTopics.length > 0) && (
        <span className="text-[10px] text-muted-foreground/40">·</span>
      )}
      {displayUseCases.map((u, i) => (
        <span key={i} className={pillClass}>{u}</span>
      ))}
      {extraUseCases > 0 && <span className={pillClass}>+{extraUseCases} more</span>}
      {displayTopics.length > 0 && displayUseCases.length > 0 && (
        <span className="text-[10px] text-muted-foreground/40">·</span>
      )}
      {displayTopics.map((t) => (
        <span key={t} className={topicPillClass}>{t}</span>
      ))}
      {extraTopics > 0 && <span className={topicPillClass}>+{extraTopics} more</span>}
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
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reblogOpen, setReblogOpen] = useState(false);
  const isBounty = !!(item as any).bounty_enabled;
  const profile = item.profiles as any;
  const starVal = roundedStars(Number(item.avg_rating) || 0, item.rating_count ?? 0);
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  const state = navState ?? { from: context === "browse" ? "browse" : "feed" };

  const handleCardClick = () => {
    navigate(`/content/${item.id}`, { state });
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const isLight = context === "home";
  const isBlog = item.content_type === "Blog";

  // Reblog count for this item
  const { data: reblogCount } = useQuery({
    queryKey: ["reblog_count", item.id],
    queryFn: async () => {
      const { count } = await (supabase
        .from("content_items")
        .select("id", { count: "exact", head: true }) as any)
        .eq("reblog_of_id", item.id)
        .eq("is_reblog", true)
        .eq("status", "approved");
      return count ?? 0;
    },
    staleTime: 60_000,
    enabled: !!item.id,
  });

  // Whether current user has reblogged this item
  const { data: userHasReblogged } = useQuery({
    queryKey: ["user_has_reblogged", item.id, user?.id],
    queryFn: async () => {
      const { data } = await (supabase
        .from("content_items")
        .select("id") as any)
        .eq("reblog_of_id", item.id)
        .eq("creator_id", user!.id)
        .eq("is_reblog", true)
        .maybeSingle();
      return !!data;
    },
    staleTime: 60_000,
    enabled: !!item.id && !!user?.id,
  });

  const original: ReblogComposerOriginal = {
    id: item.id,
    title: item.title,
    creatorId: item.creator_id ?? (item.profiles as any)?.id ?? "",
    creatorUsername: (item.profiles as any)?.username ?? "unknown",
    creatorDisplayName: (item.profiles as any)?.display_name,
    contentType: item.content_type,
    viewCount: item.view_count ?? 0,
    downloadCount: item.download_count ?? 0,
  };

  // WTE teaser
  const wteTeaser = extractWteTeaser(item);

  if (isBounty) {
    return <BountyCard item={item} rank={rank} context={context} navState={navState} />;
  }

  return (
    <div
      onClick={handleCardClick}
      data-visual-slot="feed-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        marginBottom: 14,
        padding: isLight ? '16px 16px 18px' : '18px 20px',
        transition: 'border-color 0.2s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* LINE 1 — Header row */}
      <div className="flex items-center gap-2" style={{ height: 34 }}>
        {rank != null && (
          <span style={{ fontSize: 18, fontWeight: 700, color: '#E8571A', minWidth: 32, flexShrink: 0 }}>
            {String(rank).padStart(2, "0")}
          </span>
        )}
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

      {/* LINE 2 — Badges + project indicator */}
      <div className="flex items-center flex-wrap" style={{ gap: 6, marginTop: 10 }}>
        <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-widest ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
          {displayContentType(item.content_type)}
        </Badge>
        <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider ${difficultyColor(item.difficulty)}`}>
          {item.difficulty}
        </Badge>
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
      <p className="line-clamp-2" style={{ fontSize: isLight ? 17 : 15, fontWeight: 600, color: 'rgba(255,255,255,0.90)', lineHeight: 1.25, marginTop: 10, fontFamily: isLight ? 'Georgia, serif' : 'inherit' }}>{item.title}</p>

      {/* LINE 3.5 — Hook subtitle (blogs only) */}
      {isBlog && item.description && (
        <p className="truncate" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontStyle: 'italic' }}>{item.description}</p>
      )}

      {/* LINE 4.25 — What to Expect teaser (non-blogs only) */}
      {!isBlog && wteTeaser && (
        <p className="text-[12px] italic mt-0.5 truncate" style={{ color: "#55e0d2" }}>
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
          className="w-full block object-cover"
          style={{ borderRadius: 14, marginTop: 12, maxHeight: isLight ? 280 : 240 }}
        />
      )}

      {/* LINE 6 — Stats + Show More */}
      {(() => {
        // Don't show expand for AI Tools, blogs
        const canExpand = item.content_type !== "AI Tools (LLMs)" && !isBlog;
        return (
          <div
            className="flex items-center justify-between"
            style={{ marginTop: 0, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div
              className="flex items-center flex-nowrap overflow-x-auto"
              style={{ gap: 16, scrollbarWidth: 'none', fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}
            >
              <span className="inline-flex items-center gap-1 shrink-0"><Eye style={{ width: 15, height: 15 }} />{formatNum(item.view_count ?? 0)}</span>
              {!isBlog && (
                <span className="inline-flex items-center gap-1 shrink-0"><Download style={{ width: 15, height: 15 }} />{formatNum(item.download_count ?? 0)}</span>
              )}
              {isBlog && (item as any).estimated_read_minutes && (
                <span className="inline-flex items-center gap-1 shrink-0">~{(item as any).estimated_read_minutes} min read</span>
              )}
              {(item.rating_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0"><MiniStars value={starVal} /></span>
              )}
              {!isLight && (
                <span className="inline-flex items-center gap-1 shrink-0"><MessageSquare style={{ width: 15, height: 15 }} />{item.comment_count ?? 0}</span>
              )}
              {isLoggedIn && (
                <>
                  <button
                    onClick={(e) => { stop(e); setShareOpen(true); }}
                    className="inline-flex items-center gap-1 shrink-0 transition-colors"
                    style={{ color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.70)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'}
                  >
                    <SendIcon style={{ width: 15, height: 15 }} />
                  </button>
                  <button
                    onClick={(e) => {
                      stop(e);
                      if (userHasReblogged) {
                        toast({ title: "You've already reblogged this" });
                      } else {
                        setReblogOpen(true);
                      }
                    }}
                    className="inline-flex items-center gap-1 shrink-0 transition-colors"
                    style={{ color: userHasReblogged ? "#2EC4B6" : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onMouseEnter={e => { if (!userHasReblogged) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.70)'; }}
                    onMouseLeave={e => { if (!userHasReblogged) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'; }}
                    title={userHasReblogged ? "You reblogged this" : "Reblog"}
                  >
                    <Repeat2 style={{ width: 15, height: 15, color: userHasReblogged ? "#2EC4B6" : "currentColor" }} />
                    {(reblogCount ?? 0) > 0 && <span>{formatNum(reblogCount ?? 0)}</span>}
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
              customTags={(item as any).custom_tags ?? (item as any).tags ?? []}
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

      {/* Reblog composer */}
      {reblogOpen && (
        <ReblogComposer
          open={reblogOpen}
          onOpenChange={setReblogOpen}
          original={original}
        />
      )}
    </div>
  );
}
