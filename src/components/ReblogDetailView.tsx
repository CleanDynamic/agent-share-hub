/**
 * ReblogDetailView — rendered inside ContentDetail when is_reblog=true.
 *
 * Layout:
 *  - Reblogger header (avatar, name, time, badges)
 *  - Title (if set)
 *  - Quoted original post card (full-width, links to original)
 *  - Thread blocks (all blocks shown, numbered, teal left line)
 *  - Action box (bookmark, comment, reblog this)
 *  - Tabs: Thread | Changelog | Tips | Comments
 *  - Creator card
 *  - Related posts
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/BookmarkButton";
import { CommentsSection } from "@/components/CommentsSection";
import { ChangelogTab } from "@/components/ChangelogTab";
import { TipsTab } from "@/components/TipsTab";
import { Eye, Download, MessageSquare, Repeat2, ExternalLink, ArrowLeft } from "lucide-react";
import { timeAgo, formatNum, difficultyColor } from "@/components/FeedItem";
import { TYPE_COLORS, displayContentType } from "@/lib/content-types";
import { ReblogComposer, type ReblogComposerOriginal } from "@/components/ReblogComposer";

// ── Quoted post card (large, detail page version) ───────────

function QuotedPostCardLarge({ originalId }: { originalId: string }) {
  const navigate = useNavigate();

  const { data: original } = useQuery({
    queryKey: ["reblog_original_post", originalId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, view_count, download_count, profiles!content_items_creator_id_fkey(username, display_name)")
        .eq("id", originalId)
        .maybeSingle();
      return data as any;
    },
    staleTime: 120_000,
    enabled: !!originalId,
  });

  if (!original) return null;

  const origProfile = original.profiles as any;
  const typeColor = original.content_type
    ? (TYPE_COLORS[original.content_type] ?? TYPE_COLORS["Failure Library"])
    : "bg-muted text-muted-foreground";

  return (
    <div
      className="rounded-xl border border-white/10 bg-white/3 px-4 py-3.5 mb-5"
      style={{ borderLeft: "3px solid rgba(255,255,255,0.20)" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-6 w-6 rounded-full bg-primary/30 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
          {(origProfile?.display_name || origProfile?.username || "?").slice(0, 2).toUpperCase()}
        </div>
        <span className="text-[14px] font-bold text-foreground">
          {origProfile?.display_name || origProfile?.username}
        </span>
        <span className="text-[13px] text-muted-foreground">@{origProfile?.username}</span>
        {original.content_type && (
          <Badge variant="outline" className={`text-[9px] font-medium ml-1 ${typeColor}`}>
            {displayContentType(original.content_type)}
          </Badge>
        )}
      </div>
      <p className="text-[16px] font-bold text-white line-clamp-2 mb-1">{original.title}</p>
      {original.description && (
        <p className="text-[13px] text-muted-foreground line-clamp-1 mb-2">{original.description}</p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground flex items-center gap-2">
          <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{formatNum(original.view_count ?? 0)}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" />{formatNum(original.download_count ?? 0)}</span>
        </p>
        <button
          onClick={() => navigate(`/content/${originalId}`)}
          className="text-[12px] font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
          style={{ color: "#1F7A6D" }}
        >
          View original post <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Thread block renderer ────────────────────────────────────

function DetailThreadBlock({ block, index }: { block: any; index: number }) {
  const circleLabels = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];
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
    <div className="flex gap-4 mb-4">
      <div className="flex flex-col items-center shrink-0 w-6">
        <span className="text-[14px] text-[#1F7A6D] font-medium">{label}</span>
        {index < 19 && <div className="w-[1px] flex-1 bg-[#1F7A6D]/25 mt-1" />}
      </div>
      <div className="flex-1 pb-1 min-w-0">
        {block.block_type === "image" && block.image_url ? (
          <img
            src={block.image_url}
            alt={block.image_description || ""}
            className="w-full rounded-xl object-cover"
            style={{ maxHeight: 320 }}
          />
        ) : block.block_type === "file" ? (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground bg-white/5 rounded-lg px-3 py-2.5 border border-white/8">
            <span>📎 {block.file_name || "File"}</span>
            {block.file_size_bytes && (
              <span className="text-[11px] text-muted-foreground/60">
                ({Math.round(block.file_size_bytes / 1024)}KB)
              </span>
            )}
          </div>
        ) : (
          <p className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-line">{content}</p>
        )}
      </div>
    </div>
  );
}

// ── Main ReblogDetailView ────────────────────────────────────

type DetailTab = "thread" | "changelog" | "tips" | "comments";

interface ReblogDetailViewProps {
  item: any; // content_item with is_reblog=true
}

export function ReblogDetailView({ item }: ReblogDetailViewProps) {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<DetailTab>("thread");
  const [reblogOpen, setReblogOpen] = useState(false);

  const creator = item.profiles as any;
  const initials = (creator?.display_name || creator?.username || "?").slice(0, 2).toUpperCase();
  const reblogOfId: string | null = (item as any).reblog_of_id ?? null;
  const postCategory: string = (item as any).post_category || "blueprint";

  const categoryColors: Record<string, string> = {
    blog: "bg-[#F472B6]/15 text-[#F472B6] border-[#F472B6]/25",
    blueprint: "bg-primary/20 text-primary border-primary/25",
    bounty: "bg-[#374151]/20 text-[#9CA3AF] border-[#374151]/25",
  };

  // Fetch thread blocks
  const { data: blocks } = useQuery({
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
  });

  // Reblog count
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

  // Whether user has reblogged this
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

  const original: ReblogComposerOriginal = {
    id: item.id,
    title: item.title || "Reblog",
    creatorId: item.creator_id ?? creator?.id ?? "",
    creatorUsername: creator?.username ?? "unknown",
    creatorDisplayName: creator?.display_name,
    contentType: item.content_type,
    viewCount: item.view_count ?? 0,
    downloadCount: item.download_count ?? 0,
  };

  const TABS: { key: DetailTab; label: string }[] = [
    { key: "thread", label: "Thread" },
    { key: "changelog", label: "Changelog" },
    { key: "tips", label: "Tips" },
    { key: "comments", label: `Comments (${item.comment_count ?? 0})` },
  ];

  return (
    <div className="pb-16">
      {/* Reblog indicator */}
      <div className="flex items-center gap-1.5 mb-3">
        <Repeat2 className="h-4 w-4" style={{ color: "#1F7A6D" }} />
        <span className="text-[13px] font-semibold" style={{ color: "#1F7A6D" }}>Reblog</span>
      </div>

      {/* Reblogger header */}
      <div className="flex items-center gap-3 mb-3">
        <Link to={`/creator/${creator?.username}`}>
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-[11px]">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/creator/${creator?.username}`} className="text-[18px] font-bold text-foreground hover:underline">
              {creator?.display_name || creator?.username}
            </Link>
            <span className="text-[14px]" style={{ color: "#1F7A6D" }}>@{creator?.username}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-[14px] text-muted-foreground">{timeAgo(item.created_at)}</span>
          </div>
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
        <div className="shrink-0">
          <BookmarkButton contentId={item.id} />
        </div>
      </div>

      {/* Reblog title (if set) */}
      {item.title && (
        <h1 className="text-[24px] font-bold text-white mb-4 leading-tight">{item.title}</h1>
      )}

      {/* Quoted original post card */}
      {reblogOfId && <QuotedPostCardLarge originalId={reblogOfId} />}

      {/* Action box */}
      <div className="flex items-center gap-3 mb-5 py-3 px-4 rounded-xl bg-white/3 border border-white/8 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />{formatNum(item.view_count ?? 0)}
        </div>
        <span className="text-white/20">·</span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Download className="h-4 w-4" />{formatNum(item.download_count ?? 0)}
        </div>
        <span className="text-white/20">·</span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />{item.comment_count ?? 0}
        </div>
        <span className="text-white/20">·</span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Repeat2 className="h-4 w-4" />{formatNum(reblogCount ?? 0)}
        </div>
        {isLoggedIn && (
          <>
            <div className="ml-auto" />
            <button
              onClick={() => setReblogOpen(true)}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
              style={{
                color: userHasReblogged ? "#1F7A6D" : "#1F7A6D",
                borderColor: userHasReblogged ? "#1F7A6D" : "rgba(31,122,109,0.4)",
              }}
            >
              ↺ Reblog this
            </button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/8 mb-5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.key
                ? "text-foreground border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Thread tab */}
      {activeTab === "thread" && (
        <div>
          {(!blocks || blocks.length === 0) ? (
            <p className="text-[14px] text-muted-foreground italic">No thread content.</p>
          ) : (
            <div className="mt-2">
              {blocks.map((block, i) => (
                <DetailThreadBlock key={block.id ?? i} block={block} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Changelog tab */}
      {activeTab === "changelog" && <ChangelogTab contentId={item.id} contentTitle={item.title} creatorId={item.creator_id} currentVersion={(item as any).current_version ?? "1.0"} />}

      {/* Tips tab */}
      {activeTab === "tips" && <TipsTab contentId={item.id} isEligible={true} />}

      {/* Comments tab */}
      {activeTab === "comments" && <CommentsSection contentId={item.id} contentTitle={item.title} commentCount={(item as any).comment_count ?? 0} isEligible={true} />}

      {/* Creator card */}
      <div className="mt-8 p-4 rounded-xl bg-white/3 border border-white/8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Reblogged by</p>
        <div className="flex items-center gap-3">
          <Link to={`/creator/${creator?.username}`}>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{initials}</AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <Link to={`/creator/${creator?.username}`} className="font-semibold text-foreground hover:underline">
              {creator?.display_name || creator?.username}
            </Link>
            <p className="text-[13px] text-muted-foreground">@{creator?.username}</p>
          </div>
          <div className="ml-auto">
            <Button size="sm" variant="outline" asChild>
              <Link to={`/creator/${creator?.username}`}>View profile</Link>
            </Button>
          </div>
        </div>
      </div>

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
