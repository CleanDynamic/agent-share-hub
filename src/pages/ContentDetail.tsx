import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Navigate, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { reportError } from "@/lib/errors/report";
import { useToast } from "@/hooks/use-toast";
import { SeoHead } from "@/components/SeoHead";
import { Skeleton } from "@/components/ui/skeleton";
import { ContentDetailShell } from "@/components/content-detail/ContentDetailShell";
import { ResultsViewerSection } from "@/components/content-detail/ResultsViewerSection";
import { FloatingEngagementBar } from "@/components/content-detail/FloatingEngagementBar";
import { ArticleViewer } from "@/components/article/ArticleViewer";
import { StageTimeline } from "@/components/canvas/StageTimeline";
import { BlogView } from "@/components/blog/BlogView";
import { useCanvasDocument } from "@/hooks/useCanvasDocument";
import { resolvePostType } from "@/lib/content-types";
import {
  getPostForViewer,
  recordPostView,
  recordReadingProgress,
  getComments,
  postComment,
  reactToComment,
  useCommentsRealtime,
  exportToFormat,
} from "@/lib/content-detail";
import { AIExportMenu, type ExportFormat } from "@/components/content-detail/AIExportMenu";
import {
  PrimitiveCommentDrawer,
  type AnchorType,
  type AnchorPreview,
  type Comment as DrawerComment,
  type ReactionType,
  type CommentReactions,
} from "@/components/content-detail/PrimitiveCommentDrawer";
import { CommentDrawerProvider } from "@/components/content-detail/CommentDrawerContext";
import type { ThreadedComment } from "@/lib/content-detail/types";
import { supabase } from "@/integrations/supabase/client";
import { ReblogsListModal } from "@/components/reblog/ReblogsListModal";
import AttributionChip from "@/components/remix/AttributionChip";
import DescendantBadge from "@/components/remix/DescendantBadge";
import RemixButton from "@/components/remix/RemixButton";
import { useLineageParent, useRemixCount } from "@/lib/remix/hooks";
import { createRemix } from "@/lib/remix/createRemix";
import { REMIX_CREATE_ENABLED } from "@/lib/remix/flags";
import { scrollBehavior } from "@/lib/theme/motion";

const NORMALIZE_TYPE = (raw?: string | null): "blueprint" | "blog" => (raw === "blog" ? "blog" : "blueprint");

/** UX-11: requests (post_type "bounty") are gone; their address goes home. */
const isRetiredType = (raw?: string | null): boolean => raw === "bounty";

export default function ContentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const viewLoggedRef = useRef(false);
  const [searchParams] = useSearchParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["post_for_viewer", id, user?.id ?? null],
    queryFn: () => getPostForViewer({ slug: id!, viewerId: user?.id ?? null }),
    enabled: !!id,
  });

  const post = data?.post;
  const author = data?.author;
  const canvasDoc = useCanvasDocument(post?.id ?? null);

  // Page view logging — once per mount
  useEffect(() => {
    if (!post?.id || viewLoggedRef.current) return;
    viewLoggedRef.current = true;
    recordPostView({
      postId: post.id,
      viewerId: user?.id ?? null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      referrer: typeof document !== "undefined" ? document.referrer : null,
    });
  }, [post?.id, user?.id]);

  // Author follower stats
  const { data: authorStats } = useQuery({
    queryKey: ["author_stats", author?.id],
    queryFn: async () => {
      if (!author?.id) return { followerCount: 0, blueprintCount: 0 };
      const [{ count: followers }, { count: blueprints }] = await Promise.all([
        (supabase as any).from("follows").select("*", { count: "exact", head: true }).eq("followed_id", author.id),
        (supabase as any).from("content_items").select("*", { count: "exact", head: true }).eq("creator_id", author.id).eq("status", "approved"),
      ]);
      return {
        followerCount: followers ?? 0,
        blueprintCount: blueprints ?? 0,
      };
    },
    enabled: !!author?.id,
  });

  const postType = useMemo(
    () => NORMALIZE_TYPE((post as any)?.post_type),
    [post]
  );

  const shellPost = useMemo(() => {
    if (!post) return null;
    const tagsRaw = (post as any).custom_tags || (post as any).tags || [];
    const tags: string[] = Array.isArray(tagsRaw) ? tagsRaw : [];
    const wordCount = ((post as any).description ?? "").split(/\s+/).length;
    const readingMinutes = Math.max(1, Math.round(wordCount / 200));
    return {
      id: post.id as string,
      slug: ((post as any).slug as string) || (post.id as string),
      postType,
      title: (post.title as string) ?? "",
      description: ((post as any).description as string) ?? "",
      coverUrl: ((post as any).cover_image_url as string) || undefined,
      publishedAt: new Date(((post as any).published_at as string) || ((post as any).created_at as string) || Date.now()),
      readingMinutes: ((post as any).reading_minutes as number) ?? readingMinutes,
      domain: ((post as any).domain as string) || ((post as any).category as string) || "General",
      difficulty: ((post as any).difficulty as string) || "Intermediate",
      tags,
      stageCount: canvasDoc.stages?.length ?? 0,
      blockCount: canvasDoc.blocks?.length ?? 0,
      connectionCount: (canvasDoc as any).connections?.length ?? 0,
      derivedAuthorBio: (author?.derived_bio as string) ?? "",
    };
  }, [post, postType, canvasDoc.stages, canvasDoc.blocks, author?.derived_bio]);

  const shellAuthor = useMemo(() => {
    if (!author) return null;
    return {
      id: author.id,
      displayName: author.display_name || author.username || "User",
      handle: author.username || author.id.slice(0, 8),
      avatarUrl: author.avatar_url || "",
      isVerified: false,
      level: 1,
      customBio: author.bio || undefined,
      derivedBio: author.derived_bio || "",
      isFollowing: data?.viewer.isFollowing ?? false,
      isFollowedByCurrentUser: data?.viewer.isFollowing ?? false,
      stats: {
        blueprintCount: authorStats?.blueprintCount ?? 0,
        followerCount: authorStats?.followerCount ?? 0,
      },
    };
  }, [author, data?.viewer.isFollowing, authorStats]);

  const relatedPosts = useMemo(
    () =>
      (data?.relatedPosts ?? []).map((r: any) => ({
        id: r.id,
        slug: r.slug || r.id,
        title: r.title,
        coverUrl: r.cover_image_url || undefined,
        postType: NORMALIZE_TYPE(r.post_type),
        author: { displayName: "", avatarUrl: "" },
        readingMinutes: 3,
      })),
    [data?.relatedPosts]
  );

  // Reading progress persistence (throttled inside helper to 30s)
  const handleScrollProgress = (pct: number) => {
    if (!user?.id || !post?.id) return;
    recordReadingProgress({ readerId: user.id, postId: post.id, progressPct: pct });
  };

  // ─── Floating engagement bar: scroll-pause visibility ───
  const { toast } = useToast();
  const [barVisible, setBarVisible] = useState(false);
  const idleTimerRef = useRef<number | null>(null);
  const handleScrollActivity = useCallback(() => {
    setBarVisible(false);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setBarVisible(true), 800);
  }, []);
  useEffect(() => {
    // Show after initial settle
    idleTimerRef.current = window.setTimeout(() => setBarVisible(true), 800);
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  // ─── Engagement state ───
  const [hasLiked, setHasLiked] = useState(false);
  const [hasBookmarked, setHasBookmarked] = useState(false);
  const [hasReposted, setHasReposted] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [repostCount, setRepostCount] = useState(0);
  const [reblogsModalOpen, setReblogsModalOpen] = useState(false);

  useEffect(() => {
    if (!data?.viewer || !post) return;
    setHasLiked(data.viewer.hasLiked);
    setHasBookmarked(data.viewer.hasBookmarked);
    setHasReposted(data.viewer.hasReposted);
    setLikeCount(((post as any).like_count as number) ?? 0);
    setCommentCount(((post as any).comment_count as number) ?? 0);
    setRepostCount(((post as any).reblog_count as number) ?? ((post as any).repost_count as number) ?? 0);
  }, [data?.viewer, post]);

  // Phase 15.2 — Excerpt anchor highlight: when arriving with
  // ?excerpt-anchor=<blockId> or ?excerpt-text-hash=<hash>, scroll the
  // matching block into view and briefly pulse it.
  useEffect(() => {
    if (!post) return;
    const anchor = searchParams.get("excerpt-anchor");
    const hash = searchParams.get("excerpt-text-hash");
    if (!anchor && !hash) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      let target: HTMLElement | null = null;
      if (anchor) {
        target =
          (document.querySelector(`[data-source-block-id="${anchor}"]`) as HTMLElement | null) ||
          (document.querySelector(`[data-block-id="${anchor}"]`) as HTMLElement | null);
      }
      if (!target) {
        // Fallback: scroll to top of article body
        target = document.querySelector('[data-quotable="true"]') as HTMLElement | null;
      }
      if (!target) {
        // Retry shortly while body renders
        window.setTimeout(run, 200);
        return;
      }
      target.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
      if (anchor || hash) {
        target.classList.add("excerpt-pulse");
        window.setTimeout(() => target?.classList.remove("excerpt-pulse"), 1100);
      }
    };
    const t = window.setTimeout(run, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [post, searchParams]);

  const handleLike = useCallback(async () => {
    if (!user?.id || !post?.id) {
      toast({ title: "Sign in to like", variant: "destructive" });
      return;
    }
    const next = !hasLiked;
    setHasLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) {
        await (supabase as any).from("user_interactions").insert({
          user_id: user.id,
          content_id: post.id,
          interaction_type: "liked",
        } as any);
      } else {
        await (supabase as any)
          .from("user_interactions")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", post.id)
          .eq("interaction_type", "liked");
      }
    } catch (e) {
      // revert
      setHasLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  }, [hasLiked, post?.id, user?.id, toast]);

  const handleRepost = useCallback(async () => {
    if (!user?.id || !post?.id) {
      toast({ title: "Sign in to repost", variant: "destructive" });
      return;
    }
    const next = !hasReposted;
    setHasReposted(next);
    setRepostCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) {
        await (supabase as any).from("user_interactions").insert({
          user_id: user.id,
          content_id: post.id,
          interaction_type: "reposted",
        } as any);
      } else {
        await (supabase as any)
          .from("user_interactions")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", post.id)
          .eq("interaction_type", "reposted");
      }
    } catch {
      setHasReposted(!next);
      setRepostCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  }, [hasReposted, post?.id, user?.id, toast]);

  const handleBookmark = useCallback(
    async (_anchor: HTMLButtonElement) => {
      if (!user?.id || !post?.id) {
        toast({ title: "Sign in to save", variant: "destructive" });
        return;
      }
      // Phase 8 ShareMenu's Save-to-Library popover anchors here.
      // Stub: toggle a default-collection bookmark.
      const next = !hasBookmarked;
      setHasBookmarked(next);
      try {
        const { data: col } = await (supabase as any)
          .from("collections")
          .select("id")
          .eq("owner_id", user.id)
          .eq("is_default", true)
          .maybeSingle();
        if (!col?.id) return;
        if (next) {
          await (supabase as any).from("collection_items").insert({
            collection_id: col.id,
            content_id: post.id,
            added_by: user.id,
          } as any);
        } else {
          await (supabase as any)
            .from("collection_items")
            .delete()
            .eq("collection_id", col.id)
            .eq("content_id", post.id);
        }
      } catch {
        setHasBookmarked(!next);
      }
    },
    [hasBookmarked, post?.id, user?.id, toast]
  );

  const handleShare = useCallback(
    async (_anchor: HTMLButtonElement) => {
      const url = `${window.location.origin}/content/${(post as any)?.slug ?? post?.id}`;
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied" });
      } catch {
        toast({ title: "Copy failed", variant: "destructive" });
      }
    },
    [post, toast]
  );

  // ─── AI Export menu ───
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [exportBusy, setExportBusy] = useState<ExportFormat | null>(null);

  const handleExport = useCallback((anchor: HTMLButtonElement) => {
    setExportAnchor((prev) => (prev ? null : anchor));
  }, []);

  const triggerExport = useCallback(
    async (format: ExportFormat) => {
      if (!post?.id || !shellPost) return;
      const slug = shellPost.slug || post.id;
      const filenameBase = String(slug).split("/").join("-");
      try {
        setExportBusy(format);
        if (format === "ai-pdf") {
          toast({ title: "Generating AI-PDF…", description: "This can take a few seconds." });
        }
        const res = await exportToFormat({
          postId: post.id as string,
          format,
          exporterId: user?.id ?? null,
        });

        const downloadBlob = (data: BlobPart, mime: string, ext: string) => {
          const blob = new Blob([data], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${filenameBase}${ext}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        };

        switch (format) {
          case "markdown":
            downloadBlob(res.content ?? "", "text/markdown;charset=utf-8", ".md");
            toast({ title: "Markdown downloaded" });
            break;
          case "plain":
            downloadBlob(res.content ?? "", "text/plain;charset=utf-8", ".txt");
            toast({ title: "Plain text downloaded" });
            break;
          case "json":
            downloadBlob(res.content ?? "", "application/json;charset=utf-8", ".json");
            toast({ title: "JSON downloaded" });
            break;
          case "copy-json":
            try {
              await navigator.clipboard.writeText(res.content ?? "");
              toast({ title: "Copied to clipboard", description: "Paste into ChatGPT or Claude." });
            } catch {
              toast({ title: "Copy failed", variant: "destructive" });
            }
            break;
          case "pdf": {
            if (res.url) {
              window.open(res.url, "_blank", "noopener");
            } else {
              // Open print-ready HTML in a new window so the user can save as PDF.
              const w = window.open("", "_blank");
              if (w) {
                // SV-01: raw HTML on purpose. `res.content` is `payloadToHtml(payload)`, which escapes every word of the post.
                w.document.write(res.content ?? "");
                w.document.close();
                w.focus();
                setTimeout(() => w.print(), 250);
              }
            }
            toast({ title: "PDF ready", description: "Use your browser's Save as PDF." });
            break;
          }
          case "ai-pdf": {
            if (res.url) {
              const a = document.createElement("a");
              a.href = res.url;
              a.download = `${filenameBase}-ai.pdf`;
              a.target = "_blank";
              document.body.appendChild(a);
              a.click();
              a.remove();
              toast({ title: "AI-PDF downloaded" });
            } else {
              downloadBlob(res.content ?? "", "text/html;charset=utf-8", "-ai.html");
              toast({ title: "AI-PDF queued", description: "Renderer not yet available — HTML draft downloaded." });
            }
            break;
          }
        }
        setExportAnchor(null);
      } catch (e: any) {
        toast({ title: "Export failed", description: e?.message ?? "Try again.", variant: "destructive" });
      } finally {
        setExportBusy(null);
      }
    },
    [post?.id, shellPost, user?.id, toast]
  );

  // ─── Comment drawer state ───
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAnchor, setDrawerAnchor] = useState<{
    anchorType: AnchorType;
    anchorId: string;
    preview: AnchorPreview;
  } | null>(null);
  const [drawerThreads, setDrawerThreads] = useState<DrawerComment[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const reactionsToCounts = (rs: ThreadedComment["reactions"]): CommentReactions => {
    const out: CommentReactions = { thumbsup: 0, lightbulb: 0, heart: 0, eyes: 0 };
    for (const r of rs) {
      if (r.reaction in out) (out as any)[r.reaction] = r.count;
    }
    return out;
  };

  const toDrawerComment = useCallback(
    (c: ThreadedComment): DrawerComment => ({
      id: c.id,
      author: {
        id: c.author?.id ?? "unknown",
        displayName: c.author?.display_name || c.author?.username || "User",
        handle: c.author?.username || (c.author?.id ?? "user").slice(0, 8),
        avatarUrl: c.author?.avatar_url || undefined,
        role:
          c.author?.id && post && c.author.id === (post as any).creator_id
            ? "author"
            : null,
      },
      body: c.bodyText || "",
      reactions: reactionsToCounts(c.reactions),
      timestamp: new Date(c.createdAt),
      replies: (c.replies || []).map(toDrawerComment),
      isDeleted: !!(c as any).isDeleted,
      updatedAt: (c as any).updatedAt ? new Date((c as any).updatedAt) : undefined,
      likeCount: (c.reactions || []).find((r) => r.reaction === "heart")?.count ?? 0,
      hasLiked: !!(c.reactions || []).find((r) => r.reaction === "heart" && r.reactedByViewer),
      replyCount: (c as any).replyCount ?? (c.replies || []).length,
    }),
    [post]
  );

  const refetchDrawerThreads = useCallback(async () => {
    if (!drawerAnchor) return;
    setDrawerLoading(true);
    try {
      const { threads, total } = await getComments({
        anchorType: drawerAnchor.anchorType,
        anchorId: drawerAnchor.anchorId,
        sort: "newest",
        viewerId: user?.id ?? null,
      });
      setDrawerThreads(threads.map(toDrawerComment));
      // Keep post-level comment count badge in sync.
      if (drawerAnchor.anchorType === "post") setCommentCount(total);
    } catch (e) {
      reportError(e, { source: "content-detail", context: "drawer-comments", route: window.location.pathname });
    } finally {
      setDrawerLoading(false);
    }
  }, [drawerAnchor, user?.id, toDrawerComment]);

  useEffect(() => {
    if (drawerOpen && drawerAnchor) refetchDrawerThreads();
  }, [drawerOpen, drawerAnchor, refetchDrawerThreads]);

  // Deep-link: when ?comment= or ?thread= is present, auto-open the post-level
  // drawer so the target comment can be scrolled into view.
  const deepLinkParam = searchParams.get("comment") || searchParams.get("thread");
  useEffect(() => {
    if (!deepLinkParam || !post || !shellPost || drawerOpen) return;
    setDrawerAnchor({
      anchorType: "post",
      anchorId: (post as any).id,
      preview: { type: "post", title: shellPost.title },
    });
    setDrawerOpen(true);
  }, [deepLinkParam, post, shellPost, drawerOpen]);

  // Realtime: live updates for the currently-open anchor.
  useCommentsRealtime(
    drawerAnchor?.anchorType ?? "post",
    drawerAnchor?.anchorId ?? null,
    useCallback(() => {
      refetchDrawerThreads();
    }, [refetchDrawerThreads])
  );

  const openDrawer = useCallback(
    (args: { anchorType: AnchorType; anchorId: string; preview: AnchorPreview }) => {
      setDrawerAnchor(args);
      setDrawerOpen(true);
    },
    []
  );
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const drawerContextValue = useMemo(
    () => ({ open: openDrawer, close: closeDrawer }),
    [openDrawer, closeDrawer]
  );

  const handleComment = useCallback(() => {
    if (!post || !shellPost) return;
    openDrawer({
      anchorType: "post",
      anchorId: post.id as string,
      preview: { type: "post", title: shellPost.title },
    });
  }, [post, shellPost, openDrawer]);

  const handleDrawerPost = useCallback(
    async (text: string) => {
      if (!user?.id || !drawerAnchor) {
        toast({ title: "Sign in to comment", variant: "destructive" });
        return;
      }
      try {
        await postComment({
          anchorType: drawerAnchor.anchorType,
          anchorId: drawerAnchor.anchorId,
          authorId: user.id,
          body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
        });
        await refetchDrawerThreads();
      } catch (e: any) {
        toast({ title: "Could not post", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, drawerAnchor, refetchDrawerThreads, toast]
  );

  const handleDrawerReply = useCallback(
    async (parentId: string, text: string) => {
      if (!user?.id || !drawerAnchor) return;
      try {
        await postComment({
          anchorType: drawerAnchor.anchorType,
          anchorId: drawerAnchor.anchorId,
          parentCommentId: parentId,
          authorId: user.id,
          body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
        });
        await refetchDrawerThreads();
      } catch (e: any) {
        toast({ title: "Could not reply", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, drawerAnchor, refetchDrawerThreads, toast]
  );

  const handleDrawerReact = useCallback(
    async (commentId: string, reaction: ReactionType) => {
      if (!user?.id) {
        toast({ title: "Sign in to react", variant: "destructive" });
        return;
      }
      try {
        await reactToComment({ commentId, reactorId: user.id, reaction });
        await refetchDrawerThreads();
      } catch (e: any) {
        toast({ title: "Reaction failed", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, refetchDrawerThreads, toast]
  );

  const handleDrawerMore = useCallback((_commentId: string) => {
    // Menu UI is owned by the drawer; nothing to do here.
  }, []);

  const handleDrawerEdit = useCallback(
    async (commentId: string, text: string) => {
      try {
        const { updateComment } = await import("@/lib/content-detail");
        await updateComment({
          commentId,
          body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
        });
        await refetchDrawerThreads();
      } catch (e: any) {
        toast({ title: "Could not edit", description: e?.message, variant: "destructive" });
        throw e;
      }
    },
    [refetchDrawerThreads, toast],
  );

  const handleDrawerDelete = useCallback(
    async (commentId: string) => {
      try {
        const { softDeleteComment } = await import("@/lib/content-detail");
        await softDeleteComment({ commentId });
        await refetchDrawerThreads();
      } catch (e: any) {
        toast({ title: "Could not delete", description: e?.message, variant: "destructive" });
      }
    },
    [refetchDrawerThreads, toast],
  );

  const handleDrawerReport = useCallback(
    async (commentId: string) => {
      try {
        const { reportComment } = await import("@/lib/content-detail");
        await reportComment({ commentId });
        toast({ title: "Thanks", description: "We'll review this comment." });
      } catch (e: any) {
        toast({ title: "Could not report", description: e?.message, variant: "destructive" });
      }
    },
    [toast],
  );

  const handleEdit = useCallback(() => {
    if (!post) return;
    const t = NORMALIZE_TYPE((post as any).post_type);
    navigate(`/upload/${t}?draft=${post.id}`);
  }, [navigate, post]);

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isRetiredType((post as any)?.post_type)) return <Navigate to="/" replace />;

  if (error || !post || !shellPost || !shellAuthor) {
    return (
      <div className="py-20 px-6 text-center text-sm text-muted-foreground">
        This post doesn't exist or has been removed.
      </div>
    );
  }

  const isOwnPost = !!user?.id && user.id === (post as any).creator_id;

  // ─── Body renderer per post type ──────────────────────────────────────────
  let bodyNode: React.ReactNode = null;

  if (postType === "blog") {
    bodyNode = <BlogView item={post as any} />;
  } else {
    // blueprint — the article body renderer.
    if (!canvasDoc.loading && (post as any).article_body) {
      bodyNode = (
        <ArticleViewer
          content={(post as any).article_body}
          canvasDoc={canvasDoc}
        />
      );
    } else if (!canvasDoc.loading && canvasDoc.blocks.length > 0) {
      const resolved = resolvePostType(
        (post as any).post_category ?? null,
        (post as any).content_type ?? null
      );
      bodyNode = (
        <StageTimeline
          stages={canvasDoc.stages}
          blocks={canvasDoc.blocks}
          postType={resolved}
          showAnnotations={isOwnPost}
        />
      );
    } else if (canvasDoc.loading) {
      bodyNode = (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
          Loading…
        </div>
      );
    }
  }

  // Wrap body in a quotable surface so the QuotableSelectionOverlay can
  // resolve excerpt source post + block ids from text selections.
  if (post && bodyNode) {
    bodyNode = (
      <div
        data-quotable="true"
        data-source-post-id={(post as any).id}
        data-source-post-slug={(post as any).slug ?? ""}
      >
        <RemixLineageRow
          postId={(post as any).id as string}
          isRemixable={!!(post as any).is_remixable}
          isOwnPost={isOwnPost}
          remixerId={user?.id ?? null}
          onRemixed={(draftId, postType) => {
            const path = postType === "blog" ? "/upload/blog" : "/upload/blueprint";
            navigate(`${path}?draft=${draftId}`);
          }}
        />
        {bodyNode}
      </div>
    );
  }

  return (
    <CommentDrawerProvider value={drawerContextValue}>
      {(() => {
        const SITE = (import.meta as any).env?.VITE_SITE_URL || "https://neoscaleai.com";
        const postUrl = `${SITE}/b/${shellPost.slug}`;
        const authorUrl = shellAuthor?.handle ? `${SITE}/u/${shellAuthor.handle}` : `${SITE}/profile`;
        const schemaType = shellPost.postType === "blueprint" ? "TechArticle" : "Article";
        const articleLd: Record<string, any> = {
          "@context": "https://schema.org",
          "@type": schemaType,
          headline: shellPost.title,
          description: shellPost.description || shellPost.title,
          image: shellPost.coverUrl ? [shellPost.coverUrl] : undefined,
          datePublished: shellPost.publishedAt?.toISOString?.() ?? undefined,
          dateModified: ((post as any)?.updated_at as string) ?? shellPost.publishedAt?.toISOString?.() ?? undefined,
          author: {
            "@type": "Person",
            name: shellAuthor?.displayName ?? "Anonymous",
            url: authorUrl,
          },
          publisher: {
            "@type": "Organization",
            name: "buildgallery",
            url: SITE,
          },
          mainEntityOfPage: postUrl,
          keywords: (shellPost.tags ?? []).join(", "),
        };
        const breadcrumbLd = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Browse", item: `${SITE}/browse` },
            { "@type": "ListItem", position: 3, name: shellPost.title, item: postUrl },
          ],
        };
        return (
          <SeoHead
            title={`${shellPost.title} — buildgallery`}
            description={shellPost.description || shellPost.title}
            path={`/b/${shellPost.slug}`}
            image={shellPost.coverUrl}
            ogType="article"
            twitterCreator={shellAuthor?.handle}
            publishedTime={shellPost.publishedAt?.toISOString?.()}
            modifiedTime={((post as any)?.updated_at as string) ?? undefined}
            articleAuthor={shellAuthor?.displayName}
            articleTags={shellPost.tags}
            jsonLd={[articleLd, breadcrumbLd]}
          />
        );
      })()}
      <ContentDetailShell
        post={shellPost}
        author={shellAuthor}
        isOwnPost={isOwnPost}
        relatedPosts={relatedPosts}
        onBack={() => navigate(-1)}
        onAuthorClick={(authorId) => navigate(`/profile/${shellAuthor.handle || authorId}`)}
        onFollow={async (authorId) => {
          if (!user?.id) return;
          await (supabase as any).from("follows").insert({ follower_id: user.id, followed_id: authorId } as any);
        }}
        onUnfollow={async (authorId) => {
          if (!user?.id) return;
          await (supabase as any)
            .from("follows")
            .delete()
            .eq("follower_id", user.id)
            .eq("followed_id", authorId);
        }}
        onPostMenu={() => {
          // Anchor for AI export menu and post-level actions (Phase 10+)
        }}
        onScrollProgress={handleScrollProgress}
        onScrollActivity={handleScrollActivity}
        resultsSlot={
          <ResultsViewerSection
            contentItemId={post.id as string}
            postSlug={shellPost.slug}
          />
        }
      >
        {bodyNode}
      </ContentDetailShell>
      <FloatingEngagementBar
        post={{
          id: shellPost.id,
          postType: shellPost.postType,
          slug: shellPost.slug,
          hasLiked,
          hasBookmarked,
          hasReposted,
        }}
        counts={{ likes: likeCount, comments: commentCount, reposts: repostCount }}
        isOwnPost={isOwnPost}
        isVisible={barVisible}
        onLike={handleLike}
        onComment={handleComment}
        onRepost={handleRepost}
        onBookmark={handleBookmark}
        onShare={handleShare}
        onExport={handleExport}
        onEdit={isOwnPost ? handleEdit : undefined}
        onShowReblogsList={() => setReblogsModalOpen(true)}
      />
      <AIExportMenu
        isOpen={!!exportAnchor}
        anchorEl={exportAnchor}
        onClose={() => setExportAnchor(null)}
        post={{
          id: shellPost.id,
          slug: shellPost.slug,
          postType: shellPost.postType,
          title: shellPost.title,
        }}
        onExport={triggerExport}
        busyFormat={exportBusy}
      />
      {drawerAnchor && (
        <PrimitiveCommentDrawer
          isOpen={drawerOpen}
          onClose={closeDrawer}
          anchorType={drawerAnchor.anchorType}
          anchorId={drawerAnchor.anchorId}
          anchorPreview={drawerAnchor.preview}
          threads={drawerThreads}
          viewerId={user?.id ?? ""}
          postAuthorId={(post as any).creator_id ?? ""}
          onPost={handleDrawerPost}
          onReply={handleDrawerReply}
          onReact={handleDrawerReact}
          onMore={handleDrawerMore}
          onEdit={handleDrawerEdit}
          onDelete={handleDrawerDelete}
          onReport={handleDrawerReport}
          isLoading={drawerLoading}
          postSlug={shellPost?.slug ?? null}
          deepLinkCommentId={
            searchParams.get("comment") || searchParams.get("thread") || null
          }
        />
      )}
      {reblogsModalOpen && (
        <ReblogsListModal
          isOpen={reblogsModalOpen}
          onClose={() => setReblogsModalOpen(false)}
          postId={(post as any)?.id}
        />
      )}
    </CommentDrawerProvider>
  );
}

// ─── Remix lineage row (attribution chip + descendant badge + remix button) ───
function RemixLineageRow({
  postId,
  isRemixable,
  isOwnPost,
  remixerId,
  onRemixed,
}: {
  postId: string;
  isRemixable: boolean;
  isOwnPost: boolean;
  remixerId: string | null;
  onRemixed: (draftId: string, postType: "blueprint" | "blog") => void;
}) {
  const { data: parent } = useLineageParent(postId);
  const { data: remixCount = 0 } = useRemixCount(postId);
  // NS-P43 — remix creation is retired; Rebuild replaces it. One additive
  // condition on the affordance, exactly as NS-P42 guarded the reblog
  // buttons: the chip and the badge below still read the lineage of a post
  // derived before the freeze, and the row still renders for them.
  const showRemixButton =
    REMIX_CREATE_ENABLED && isRemixable && !isOwnPost && !!remixerId;
  if (!parent && remixCount === 0 && !showRemixButton) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        padding: "0 0 14px",
      }}
    >
      {parent && (
        <AttributionChip
          authorHandle={parent.authorHandle}
          title={parent.title}
          deleted={parent.deleted}
        />
      )}
      {remixCount > 0 && <DescendantBadge count={remixCount} interactive={false} />}
      {showRemixButton && (
        <div style={{ marginLeft: "auto" }}>
          <RemixButton
            onRemix={async () => {
              try {
                const res = await createRemix({ sourcePostId: postId, remixerId: remixerId! });
                onRemixed(res.draftId, res.postType === "blog" ? "blog" : "blueprint");
              } catch (err) {
                reportError(err, { source: "content-detail", context: "remix", route: window.location.pathname });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
