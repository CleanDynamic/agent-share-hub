/**
 * ReblogCard — renders a reblog content_item in the feed.
 *
 * Used wherever feed cards appear: home feed, Discover, profile, search results.
 * A content_item where is_reblog=true uses this component.
 *
 * Structure:
 *   Row 1 — Reblog header (avatar, name, time, bookmark)
 *   Row 2 — Reblog title (if set)
 *   Row 3 — Quoted post (compact embedded card, always visible)
 *   Row 4 — First block preview (always shown)
 *   Row 5 — Thread expander (if more blocks exist)
 *   Row 6 — Stats row (views, downloads, comments, reblogs)
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Eye, Download, MessageSquare, Repeat2, ChevronDown, ChevronUp } from "lucide-react";
import { timeAgo, formatNum, difficultyColor } from "@/components/FeedItem";
import { TYPE_COLORS, displayContentType } from "@/lib/content-types";
import { ReblogComposer, type ReblogComposerOriginal } from "@/components/ReblogComposer";

// ── Quoted post card (embedded inside feed card) ──────────────

function QuotedPost({
  originalId,
}: {
  originalId: string;
}) {
  const navigate = useNavigate();
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const { data: original } = useQuery({
    queryKey: ["reblog_original_post", originalId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type, view_count, download_count, profiles!content_items_creator_id_fkey(username, display_name)")
        .eq("id", originalId)
        .maybeSingle();
      return data as any;
    },
    staleTime: 120_000,
    enabled: !!originalId,
  });

  if (!original) {
    return (
      <div
        className="rounded-[10px] border border-white/9 px-3 py-2.5 mt-2"
        style={{ background: "rgba(255,255,255,0.03)", borderLeft: "3px solid rgba(255,255,255,0.18)" }}
      >
        <p className="text-[12px] text-muted-foreground">Loading original post…</p>
      </div>
    );
  }

  const origProfile = original.profiles as any;
  const typeColor = original.content_type
    ? (TYPE_COLORS[original.content_type] ?? TYPE_COLORS["Failure Library"])
    : "bg-muted text-muted-foreground";

  return (
    <div
      className="rounded-[10px] border border-white/9 px-3 py-2.5 mt-2 cursor-pointer hover:bg-white/5 transition-colors"
      style={{ background: "rgba(255,255,255,0.03)", borderLeft: "3px solid rgba(255,255,255,0.18)" }}
      onClick={(e) => { stop(e); navigate(`/content/${originalId}`); }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className="h-5 w-5 rounded-full bg-primary/30 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
          {(origProfile?.display_name || origProfile?.username || "?").slice(0, 2).toUpperCase()}
        </div>
        <span className="text-[12px] font-bold text-foreground">
          {origProfile?.display_name || origProfile?.username}
        </span>
        <span className="text-[11px] text-muted-foreground">@{origProfile?.username}</span>
        {original.content_type && (
          <Badge variant="outline" className={`text-[9px] font-medium ml-0.5 ${typeColor}`}>
            {displayContentType(original.content_type)}
          </Badge>
        )}
      </div>
      <p className="text-[13px] font-semibold text-white line-clamp-2 mb-1">{original.title}</p>
      <p className="text-[11px] text-muted-foreground flex items-center gap-2">
        <span className="inline-flex items-center gap-1"><Eye className="h-2.5 w-2.5" />{formatNum(original.view_count ?? 0)}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1"><Download className="h-2.5 w-2.5" />{formatNum(original.download_count ?? 0)}</span>
      </p>
    </div>
  );
}

// ── First block preview ──────────────────────────────────────

function BlockPreview({ block }: { block: any }) {
  if (!block) return null;

  if (block.block_type === "image" && block.image_url) {
    const { data: urlData } = useQuery({
      queryKey: ["block_image_url", block.image_url],
      queryFn: async () => {
        const { data } = supabase.storage.from("content-files").getPublicUrl(block.image_url);
        return data.publicUrl;
      },
      staleTime: Infinity,
    });
    return (
      <img
        src={urlData}
        alt={block.image_description || ""}
        className="w-full rounded-lg mt-2 object-cover"
        style={{ maxHeight: 160 }}
      />
    );
  }

  if (block.block_type === "file") {
    return (
      <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
        <span>📎 {block.file_name || "File"}</span>
        {block.file_size_bytes && (
          <span className="text-[11px] text-muted-foreground/60">
            ({Math.round(block.file_size_bytes / 1024)}KB)
          </span>
        )}
      </div>
    );
  }

  // text or long_text
  const text = block.text_content || "";
  if (!text) return null;

  const formatting = block.formatting_type || (block.formatting?.type) || "paragraph";
  let preview = text;
  if (formatting === "bullets") {
    preview = text.split("\n").slice(0, 3).map((l: string) => `• ${l}`).join("\n");
  } else if (formatting === "numbers") {
    preview = text.split("\n").slice(0, 3).map((l: string, i: number) => `${i + 1}. ${l}`).join("\n");
  }

  return (
    <p className="text-[13px] text-foreground/85 mt-2 line-clamp-3 leading-relaxed whitespace-pre-line">
      {preview}
    </p>
  );
}

// ── Thread block renderer ────────────────────────────────────

function ThreadBlock({ block, index }: { block: any; index: number }) {
  const circleLabels = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  const label = circleLabels[index] ?? `(${index + 1})`;

  const text = block.text_content || "";
  const formatting = block.formatting_type || (block.formatting?.type) || "paragraph";
  let content = text;
  if (formatting === "bullets") {
    content = text.split("\n").map((l: string) => `• ${l}`).join("\n");
  } else if (formatting === "numbers") {
    content = text.split("\n").map((l: string, i: number) => `${i + 1}. ${l}`).join("\n");
  }

  return (
    <div className="flex gap-3 mt-3">
      <div className="flex flex-col items-center shrink-0">
        <span className="text-[12px] text-muted-foreground font-medium">{label}</span>
        <div className="w-[1px] flex-1 bg-[#2EC4B6]/30 mt-1" />
      </div>
      <div className="flex-1 pb-1">
        {block.block_type === "image" && block.image_url ? (
          <img
            src={block.image_url}
            alt={block.image_description || ""}
            className="w-full rounded-lg object-cover"
            style={{ maxHeight: 200 }}
          />
        ) : block.block_type === "file" ? (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
            <span>📎 {block.file_name || "File"}</span>
          </div>
        ) : (
          <p className="text-[13px] text-foreground/85 leading-relaxed whitespace-pre-line">{content}</p>
        )}
      </div>
    </div>
  );
}

// ── Main ReblogCard ──────────────────────────────────────────

interface ReblogCardProps {
  item: any; // content_item row with is_reblog=true and joined profiles
  compact?: boolean; // used in "Reblogs" tab of original post — no nested quoted card
  context?: "home" | "browse" | "category" | "profile";
}

export function ReblogCard({ item, compact = false, context = "home" }: ReblogCardProps) {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const qc = useQueryClient();
  const [threadExpanded, setThreadExpanded] = useState(false);
  const [reblogOpen, setReblogOpen] = useState(false);

  const profile = item.profiles as any;
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const reblogOfId: string | null = item.reblog_of_id ?? null;
  const threadCount: number = item.reblog_thread_count ?? 0;

  // Fetch thread blocks (all blocks for this reblog)
  const { data: allBlocks } = useQuery({
    queryKey: ["reblog_blocks", item.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_blocks")
        .select("*")
        .eq("content_id", item.id)
        .order("position", { ascending: true });
      return (data ?? []) as any[];
    },
    staleTime: 60_000,
    enabled: !!item.id,
  });

  const firstBlock = allBlocks?.[0] ?? null;
  const threadBlocks = allBlocks?.slice(1) ?? [];

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
  });

  // Whether current user has reblogged this reblog
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
    enabled: !!user?.id,
  });

  // Fetch original post info for composer
  const { data: originalPost } = useQuery({
    queryKey: ["reblog_original_post_full", item.id],
    queryFn: async () => {
      if (!reblogOfId) return null;
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type, view_count, download_count, creator_id, profiles!content_items_creator_id_fkey(username, display_name)")
        .eq("id", reblogOfId)
        .maybeSingle();
      return data as any;
    },
    staleTime: 120_000,
    enabled: !!reblogOfId,
  });

  const original: ReblogComposerOriginal = {
    id: item.id,
    title: item.title || (originalPost?.title ?? "Reblog"),
    creatorId: item.creator_id ?? profile?.id ?? "",
    creatorUsername: profile?.username ?? "unknown",
    creatorDisplayName: profile?.display_name,
    contentType: item.content_type,
    viewCount: item.view_count ?? 0,
    downloadCount: item.download_count ?? 0,
  };

  const postCategory = item.post_category || "blueprint";
  const categoryColors: Record<string, string> = {
    blog: "bg-[#F472B6]/15 text-[#F472B6] border-[#F472B6]/25",
    blueprint: "bg-primary/20 text-primary border-primary/25",
    bounty: "bg-[#374151]/20 text-[#9CA3AF] border-[#374151]/25",
  };

  return (
    <div
      onClick={() => navigate(`/content/${item.id}`)}
      className="px-4 py-3"
      data-visual-slot="feed-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        marginBottom: '8px',
        transition: 'border-color 0.15s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* ROW 1 — Reblog header */}
      <div className="flex items-start gap-2">
        {/* Reblog indicator */}
        <div className="flex items-center gap-1 mr-0.5 pt-0.5">
          <Repeat2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#2EC4B6" }} />
        </div>

        <div className="flex-1 min-w-0">
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

          {/* Badges */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-widest ${categoryColors[postCategory] ?? categoryColors.blueprint}`}>
              ↺ {postCategory.charAt(0).toUpperCase() + postCategory.slice(1)}
            </Badge>
            {item.content_type && item.content_type !== "Blog" && (
              <Badge variant="outline" className={`text-[9px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
                {displayContentType(item.content_type)}
              </Badge>
            )}
            {item.difficulty && item.difficulty !== "Any" && (
              <Badge variant="outline" className={`text-[9px] font-medium ${difficultyColor(item.difficulty)}`}>
                {item.difficulty}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ROW 2 — Reblog title (if set) */}
      {item.title && (
        <p className="text-[15px] font-bold text-white mt-2 line-clamp-2 ml-5">{item.title}</p>
      )}

      {/* ROW 3 — Quoted post (always visible, unless compact mode) */}
      {!compact && reblogOfId && (
        <div className="ml-5" onClick={stop}>
          <QuotedPost originalId={reblogOfId} />
        </div>
      )}

      {/* ROW 4 — First block preview (always shown) */}
      {firstBlock && (
        <div className="ml-5">
          <BlockPreview block={firstBlock} />
        </div>
      )}

      {/* ROW 5 — Thread expander */}
      {threadBlocks.length > 0 && (
        <div className="ml-5 mt-2">
          <button
            onClick={(e) => { stop(e); setThreadExpanded(!threadExpanded); }}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-full bg-white/5 border border-white/8"
          >
            {threadExpanded ? (
              <>Show less <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>Show thread ({threadBlocks.length} more) <ChevronDown className="h-3 w-3" /></>
            )}
          </button>

          {threadExpanded && (
            <div className="mt-2 pl-1 border-l border-[#2EC4B6]/20">
              {threadBlocks.map((block, i) => (
                <ThreadBlock key={block.id ?? i} block={block} index={i + 1} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ROW 6 — Stats row */}
      <div className="flex items-center justify-between mt-3 ml-5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-[3px] shrink-0">
            <Eye className="h-3 w-3" />{formatNum(item.view_count ?? 0)}
          </span>
          <span className="text-[#444450] shrink-0">·</span>
          <span className="inline-flex items-center gap-[3px] shrink-0">
            <Download className="h-3 w-3" />{formatNum(item.download_count ?? 0)}
          </span>
          <span className="text-[#444450] shrink-0">·</span>
          <span className="inline-flex items-center gap-[3px] shrink-0">
            <MessageSquare className="h-3 w-3" />{item.comment_count ?? 0}
          </span>
          <span className="text-[#444450] shrink-0">·</span>
          <span className="inline-flex items-center gap-[3px] shrink-0">
            <Repeat2 className="h-3 w-3" />{formatNum(reblogCount ?? 0)}
          </span>
        </div>

        {isLoggedIn && (
          <button
            onClick={(e) => { stop(e); setReblogOpen(true); }}
            className="text-[11px] font-medium transition-colors hover:opacity-80"
            style={{ color: userHasReblogged ? "#2EC4B6" : "#2EC4B6" }}
          >
            ↺ Reblog this
          </button>
        )}
      </div>

      {/* Reblog composer for this reblog */}
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
