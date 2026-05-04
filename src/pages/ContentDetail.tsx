import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  getProvenance,
  getSolutions,
  voteOnSolution,
  forkSolution,
  acceptSolution,
  getDiscussionThread,
  postDiscussionComment,
  reactToComment as reactToBountyComment,
  markBountyDiscussionRead,
  useBountySolutionUpdates,
  useBountyDiscussionUpdates,
} from "@/lib/bounty-solver";
import {
  BountyDiscussionForum,
  type DiscussionFilterValue,
  type DiscussionSortValue,
  type DiscussionComment,
  type ReactionType as DiscussionReactionType,
} from "@/components/bounty/BountyDiscussionForum";
import { BountyProvenanceProvider } from "@/components/bounty/BountyProvenanceContext";
import { BountyByline, type SolverInfo } from "@/components/bounty/BountyByline";
import { ProvenanceOverview } from "@/components/bounty/ProvenanceOverview";
import { OriginalSolutionDialog } from "@/components/bounty/OriginalSolutionDialog";
import { AcceptSolutionDialog } from "@/components/bounty/AcceptSolutionDialog";
import {
  BountySolutionsSection,
  type SolutionItem,
  type SolutionSlot,
} from "@/components/bounty/BountySolutionsSection";
import { BountyCompetitionHeader, type BountyCompetitionHeaderBounty } from "@/components/bounty-competition/BountyCompetitionHeader";
import { MetaBountyHeader } from "@/components/bounty-competition/MetaBountyHeader";
import { MetaBountyBody } from "@/components/bounty-competition/MetaBountyBody";
import { getMetaBountyState } from "@/lib/bounty-competition/getMetaBountyState";
import { SolverLeaderboard, type Contributor as LbContributor, type ActivityEvent as LbActivity } from "@/components/bounty-competition/SolverLeaderboard";
import { BountyManagementPanelContainer } from "@/components/bounty-competition/BountyManagementPanelContainer";
import { getLeaderboard } from "@/lib/bounty-competition/getLeaderboard";
import { getLeaderboardActivity } from "@/lib/bounty-competition/getLeaderboardActivity";
import { useLeaderboardUpdates } from "@/lib/bounty-competition/realtime";
import { getBountyAnalytics } from "@/lib/bounty-competition/getBountyAnalytics";
import { markSolutionReviewStatus } from "@/lib/bounty-competition/markSolutionReviewStatus";
import { extendBountyDeadline } from "@/lib/bounty-competition/extendBountyDeadline";
import { createBountyThread, createDirectThread } from "@/lib/messaging";
import { useShareMenu } from "@/components/share/ShareMenuProvider";
import { useQueryClient } from "@tanstack/react-query";

const NORMALIZE_TYPE = (raw?: string | null): "blueprint" | "blog" | "bounty" => {
  if (raw === "blog") return "blog";
  if (raw === "bounty") return "bounty";
  return "blueprint";
};

export default function ContentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const viewLoggedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const shareMenu = useShareMenu();

  const solutionFilter = (searchParams.get("solutionFilter") as string) || "all";
  const solutionSort = (searchParams.get("solutionSort") as any) || "most_votes";
  const discussionFilter = (searchParams.get("discussionFilter") as DiscussionFilterValue) || "all";
  const discussionSort = (searchParams.get("discussionSort") as DiscussionSortValue) || "newest";
  const [composerExpanded, setComposerExpanded] = useState(false);

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
      if (!author?.id) return { followerCount: 0, blueprintCount: 0, bountiesSolved: 0 };
      const [{ count: followers }, { count: blueprints }] = await Promise.all([
        (supabase as any).from("follows").select("*", { count: "exact", head: true }).eq("followed_id", author.id),
        (supabase as any).from("content_items").select("*", { count: "exact", head: true }).eq("creator_id", author.id).eq("status", "approved"),
      ]);
      return {
        followerCount: followers ?? 0,
        blueprintCount: blueprints ?? 0,
        bountiesSolved: 0,
      };
    },
    enabled: !!author?.id,
  });

  const postType = useMemo(
    () => NORMALIZE_TYPE((post as any)?.post_type),
    [post]
  );

  // ─── Bounty: provenance + per-slot solution counts ───
  const isBounty = postType === "bounty";
  const isMeta = isBounty && !!(post as any)?.bounty_is_meta;
  const spawnedFromMetaId = isBounty
    ? ((post as any)?.bounty_meta_parent_id as string | null) ?? null
    : null;
  const { data: metaState, refetch: refetchMeta } = useQuery({
    queryKey: ["meta_bounty_state", post?.id],
    queryFn: () => getMetaBountyState(post!.id as string),
    enabled: !!post?.id && isMeta,
  });
  const { data: provenanceData, refetch: refetchProvenance } = useQuery({
    queryKey: ["bounty_provenance", post?.id],
    queryFn: () => getProvenance(post!.id as string),
    enabled: !!post?.id && isBounty,
  });
  const { data: solutionsData, refetch: refetchSolutions } = useQuery({
    queryKey: ["bounty_solutions", post?.id, user?.id ?? null, solutionFilter, solutionSort],
    queryFn: () =>
      getSolutions({
        bountyId: post!.id as string,
        slotId: solutionFilter,
        sort: solutionSort,
        viewerId: user?.id ?? null,
      }),
    enabled: !!post?.id && isBounty,
  });

  // Realtime: refetch solutions on any change (votes, new submissions, accepts)
  useBountySolutionUpdates(
    isBounty ? (post?.id as string | undefined) : undefined,
    useCallback(() => {
      void refetchSolutions();
    }, [refetchSolutions]),
  );

  // Discussion forum data
  const discussionApiFilter = useMemo(() => {
    switch (discussionFilter) {
      case "author": return "from_author" as const;
      case "solvers": return "from_solvers" as const;
      case "me": return "mentions" as const;
      case "unread": return "unread" as const;
      default: return "all" as const;
    }
  }, [discussionFilter]);
  const discussionApiSort = useMemo(() => {
    if (discussionSort === "reactions") return "most_reactions" as const;
    return discussionSort;
  }, [discussionSort]);

  const { data: discussionData, refetch: refetchDiscussion } = useQuery({
    queryKey: [
      "bounty_discussion",
      post?.id,
      user?.id ?? null,
      discussionApiFilter,
      discussionApiSort,
    ],
    queryFn: () =>
      getDiscussionThread({
        bountyId: post!.id as string,
        filter: discussionApiFilter,
        sort: discussionApiSort,
        viewerId: user?.id ?? null,
      }),
    enabled: !!post?.id && isBounty,
  });

  useBountyDiscussionUpdates(
    isBounty ? (post?.id as string | undefined) : undefined,
    useCallback(() => {
      void refetchDiscussion();
    }, [refetchDiscussion]),
  );

  // Mark discussion read once when entering a bounty page.
  const discussionReadOnceRef = useRef(false);
  useEffect(() => {
    if (
      isBounty &&
      user?.id &&
      post?.id &&
      !discussionReadOnceRef.current
    ) {
      discussionReadOnceRef.current = true;
      void markBountyDiscussionRead({
        bountyId: post.id as string,
        userId: user.id,
      }).catch(() => {});
    }
  }, [isBounty, user?.id, post?.id]);

  const bountyStatus: "open" | "closed" | "solved" = useMemo(() => {
    const raw = (post as any)?.bounty_status as string | undefined;
    if (raw === "solved" || (post as any)?.bounty_solved_at) return "solved";
    if (raw === "closed") return "closed";
    return "open";
  }, [post]);

  const slotSolutionCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of solutionsData?.solutions ?? []) {
      out[s.slot_id] = (out[s.slot_id] ?? 0) + 1;
    }
    return out;
  }, [solutionsData]);

  const slotAcceptance = useMemo(() => {
    const out: Record<string, { solver: any; acceptedAt: string; slotKind: "stage" | "block"; solutionId?: string }> = {};
    const profileById = new Map<string, any>();
    for (const e of provenanceData?.acceptedSolvers ?? []) {
      if (e.user) profileById.set(e.user.id, e.user);
    }
    for (const e of provenanceData?.acceptedSolvers ?? []) {
      out[e.slotId] = {
        solver: e.user,
        acceptedAt: e.acceptedAt,
        slotKind: e.slotKind,
      };
    }
    // Also attach solutionId from solutions table where status = accepted
    for (const s of solutionsData?.solutions ?? []) {
      if (s.status === "accepted" && out[s.slot_id]) {
        out[s.slot_id].solutionId = s.id;
      }
    }
    return out;
  }, [provenanceData, solutionsData]);

  const [bylineExpanded, setBylineExpanded] = useState(false);
  const [originalDialog, setOriginalDialog] = useState<{
    slotId: string;
    slotKind: "stage" | "block";
    original: any;
    current: any;
  } | null>(null);
  const [acceptDialog, setAcceptDialog] = useState<{
    solutionId: string;
    solverHandle: string;
    solverDisplayName?: string;
    slotName: string;
    remainingSlotsAfter: number;
    isLastSlot: boolean;
  } | null>(null);
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const [solvedPulse, setSolvedPulse] = useState(false);

  const handleViewOriginalSolution = useCallback(
    async (slotId: string) => {
      const acc = slotAcceptance[slotId];
      if (!acc) return;
      const sol = (solutionsData?.solutions ?? []).find(
        (s) => s.slot_id === slotId && s.status === "accepted"
      );
      const grids = ((post as any)?.stage_grids ?? {}) as any;
      const current =
        acc.slotKind === "stage" ? grids?.stages?.[slotId] : grids?.blocks?.[slotId];
      setOriginalDialog({
        slotId,
        slotKind: acc.slotKind,
        original: sol?.content_payload ?? null,
        current,
      });
    },
    [slotAcceptance, solutionsData, post]
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
      bountyMeta:
        postType === "bounty"
          ? {
              reward: ((post as any).bounty_reward as number) ?? 0,
              daysLeft: 0,
              isSolved: !!(post as any).bounty_solved_at,
              slotsTotal: ((post as any).bounty_slots_total as number) ?? 1,
              slotsFilled: ((post as any).bounty_slots_filled as number) ?? 0,
            }
          : undefined,
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
      isTrustedSolver: !!author.is_trusted_solver,
      isFollowing: data?.viewer.isFollowing ?? false,
      isFollowedByCurrentUser: data?.viewer.isFollowing ?? false,
      stats: {
        blueprintCount: authorStats?.blueprintCount ?? 0,
        followerCount: authorStats?.followerCount ?? 0,
        bountiesSolved: authorStats?.bountiesSolved ?? 0,
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

  useEffect(() => {
    if (!data?.viewer || !post) return;
    setHasLiked(data.viewer.hasLiked);
    setHasBookmarked(data.viewer.hasBookmarked);
    setHasReposted(data.viewer.hasReposted);
    setLikeCount(((post as any).like_count as number) ?? 0);
    setCommentCount(((post as any).comment_count as number) ?? 0);
    setRepostCount(((post as any).reblog_count as number) ?? ((post as any).repost_count as number) ?? 0);
  }, [data?.viewer, post]);

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
            : c.author?.is_trusted_solver
            ? "trusted_solver"
            : null,
      },
      body: c.bodyText || "",
      reactions: reactionsToCounts(c.reactions),
      timestamp: new Date(c.createdAt),
      replies: (c.replies || []).map(toDrawerComment),
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
      console.warn("[drawer] getComments failed", e);
    } finally {
      setDrawerLoading(false);
    }
  }, [drawerAnchor, user?.id, toDrawerComment]);

  useEffect(() => {
    if (drawerOpen && drawerAnchor) refetchDrawerThreads();
  }, [drawerOpen, drawerAnchor, refetchDrawerThreads]);

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
    // Edit / Delete / Report menu — wired in a follow-up step.
  }, []);

  const handleSubmitSolution = useCallback(() => {
    const el = document.querySelector("[data-bounty-solutions-anchor]") as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleScrollToDiscussion = useCallback(() => {
    const el = document.querySelector("[data-bounty-discussion-anchor]") as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleAskAuthor = useCallback(async () => {
    if (!user?.id || !post) {
      navigate("/login");
      return;
    }
    const authorId = (post as any).creator_id as string;
    if (!authorId || authorId === user.id) return;
    try {
      const threadId = await createBountyThread(post.id as string, authorId);
      navigate(`/messages?thread=${threadId}`);
    } catch (e: any) {
      toast({ title: "Could not start conversation", description: e?.message ?? String(e), variant: "destructive" });
    }
  }, [user?.id, post, navigate, toast]);

  // ─── Bounty solutions UI state ───
  const [expandedSolutionIds, setExpandedSolutionIds] = useState<Set<string>>(new Set());
  const handleToggleExpandSolution = useCallback((solutionId: string) => {
    setExpandedSolutionIds((prev) => {
      const next = new Set(prev);
      if (next.has(solutionId)) next.delete(solutionId);
      else next.add(solutionId);
      return next;
    });
  }, []);

  // Build the slot list from the bounty's stage_grids (any slot ever marked
  // missing — including those that have since been filled by an accepted
  // solution).
  const bountySlots: SolutionSlot[] = useMemo(() => {
    if (!isBounty || !post) return [];
    const grids = ((post as any).stage_grids ?? {}) as any;
    const out: SolutionSlot[] = [];
    const stagesObj = grids.stages ?? {};
    const blocksObj = grids.blocks ?? {};
    const acceptedSlotIds = new Set(
      (provenanceData?.acceptedSolvers ?? []).map((e) => e.slotId),
    );
    for (const [sid, raw] of Object.entries(stagesObj)) {
      const v = raw as any;
      if (v?.is_missing || acceptedSlotIds.has(sid)) {
        out.push({
          id: sid,
          kind: "stage",
          name: v?.stage_name || v?.name || v?.title || "Missing stage",
          missingDescription: v?.missing_description || v?.description || "",
        });
      }
    }
    for (const [bid, raw] of Object.entries(blocksObj)) {
      const v = raw as any;
      if (v?.is_missing || acceptedSlotIds.has(bid)) {
        out.push({
          id: bid,
          kind: "block",
          name: v?.title || v?.name || "Missing block",
          missingDescription: v?.missing_description || v?.description || "",
        });
      }
    }
    return out;
  }, [isBounty, post, provenanceData]);

  // Map solver Solution rows → SolutionItem cards.
  const solutionItems: SolutionItem[] = useMemo(() => {
    const rows = solutionsData?.solutions ?? [];
    return rows.map((s) => {
      const payload = (s.content_payload ?? {}) as any;
      let preview: SolutionItem["contentPreview"] = { type: "other" };
      if (s.slot_kind === "stage") {
        const blocks = Array.isArray(payload?.blocks) ? payload.blocks : [];
        preview = {
          type: "stage",
          stageNodes: blocks.slice(0, 12).map((b: any, i: number) => ({
            x: Number(b?.position?.col ?? i),
            y: Number(b?.position?.row ?? 0),
            type: String(b?.type ?? "default"),
          })),
          blockTypes: Array.from(
            new Set(blocks.map((b: any) => String(b?.type ?? "default"))),
          ).slice(0, 6) as string[],
        };
      } else {
        const t = String(payload?.type ?? "");
        if (t === "prompt") {
          preview = { type: "prompt", text: String(payload?.content ?? payload?.text ?? "") };
        } else if (t === "code") {
          preview = {
            type: "code",
            text: String(payload?.content ?? payload?.code ?? ""),
            language: String(payload?.language ?? "javascript"),
          };
        } else {
          preview = { type: "other" };
        }
      }
      return {
        id: s.id,
        slotId: s.slot_id,
        solverUser: {
          id: s.solver?.id ?? s.solver_id,
          displayName: s.solver?.display_name || s.solver?.username || "Solver",
          handle: s.solver?.username || (s.solver?.id ?? s.solver_id).slice(0, 8),
          avatarUrl: s.solver?.avatar_url || "",
          isTrustedSolver: !!s.solver?.is_trusted_solver,
        },
        solverNote: s.solver_note ?? "",
        contentPreview: preview,
        voteCount: s.vote_count ?? 0,
        hasVoted: !!s.hasVoted,
        iWouldImplementCount: s.i_would_implement_count ?? 0,
        hasIWouldImplement: !!s.hasIWouldImplement,
        commentCount: s.commentCount ?? 0,
        isAccepted: s.status === "accepted",
        isOwnSolution: !!user?.id && user.id === s.solver_id,
        createdAt: s.created_at,
      } as SolutionItem;
    });
  }, [solutionsData, user?.id]);

  const isBountyAuthor = !!user?.id && !!post && user.id === ((post as any).creator_id as string);

  // ============== Bounty Management Panel ==============
  const [managePanelOpen, setManagePanelOpen] = useState(false);
  const [criteriaSaving, setCriteriaSaving] = useState(false);

  const { data: manageAnalytics, refetch: refetchManageAnalytics } = useQuery({
    queryKey: ["bounty_management_analytics", post?.id, user?.id ?? null],
    queryFn: () => getBountyAnalytics(post!.id as string, user!.id as string),
    enabled: !!post?.id && isBounty && isBountyAuthor && managePanelOpen,
    staleTime: 30_000,
  });

  // Handlers for solutions section.
  const updateSolutionsCache = useCallback(
    (updater: (prev: any) => any) => {
      queryClient.setQueryData(
        ["bounty_solutions", post?.id, user?.id ?? null, solutionFilter, solutionSort],
        (prev: any) => {
          if (!prev) return prev;
          return updater(prev);
        },
      );
    },
    [queryClient, post?.id, user?.id, solutionFilter, solutionSort],
  );

  const handleVoteSolution = useCallback(
    async (solutionId: string) => {
      if (!user?.id) {
        toast({ title: "Sign in to vote", variant: "destructive" });
        return;
      }
      // Optimistic
      updateSolutionsCache((prev) => ({
        ...prev,
        solutions: prev.solutions.map((s: any) =>
          s.id === solutionId
            ? {
                ...s,
                hasVoted: !s.hasVoted,
                vote_count: Math.max(0, (s.vote_count ?? 0) + (s.hasVoted ? -1 : 1)),
              }
            : s,
        ),
      }));
      try {
        await voteOnSolution({ solutionId, voterId: user.id, voteKind: "upvote" });
      } catch (e: any) {
        toast({ title: "Vote failed", description: e?.message, variant: "destructive" });
        void refetchSolutions();
      }
    },
    [user?.id, updateSolutionsCache, refetchSolutions, toast],
  );

  const handleIWouldImplement = useCallback(
    async (solutionId: string) => {
      if (!user?.id) {
        toast({ title: "Sign in to vote", variant: "destructive" });
        return;
      }
      updateSolutionsCache((prev) => ({
        ...prev,
        solutions: prev.solutions.map((s: any) =>
          s.id === solutionId
            ? {
                ...s,
                hasIWouldImplement: !s.hasIWouldImplement,
                i_would_implement_count: Math.max(
                  0,
                  (s.i_would_implement_count ?? 0) + (s.hasIWouldImplement ? -1 : 1),
                ),
              }
            : s,
        ),
      }));
      try {
        await voteOnSolution({
          solutionId,
          voterId: user.id,
          voteKind: "i_would_implement",
        });
      } catch (e: any) {
        toast({ title: "Failed", description: e?.message, variant: "destructive" });
        void refetchSolutions();
      }
    },
    [user?.id, updateSolutionsCache, refetchSolutions, toast],
  );

  const handleShareSolution = useCallback(
    (solutionId: string, anchorEl: HTMLElement | null) => {
      if (!post || !shellPost) return;
      const url = `${window.location.origin}/b/${shellPost.slug}#solution-${solutionId}`;
      const fallbackAnchor = (anchorEl ?? document.getElementById(`solution-${solutionId}`)) as HTMLElement | null;
      shareMenu.openShareMenu({
        contentType: "blueprint",
        contentId: solutionId,
        contentMeta: { title: `Solution on ${shellPost.title}`, parentSlug: shellPost.slug },
        anchorEl:
          fallbackAnchor ??
          ({ getBoundingClientRect: () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) } as DOMRect) } as any),
      });
      void navigator.clipboard.writeText(url).catch(() => {});
    },
    [post, shellPost, shareMenu],
  );

  const handleSaveSolution = useCallback(
    (solutionId: string) => {
      handleShareSolution(solutionId, null);
    },
    [handleShareSolution],
  );

  const handleForkSolution = useCallback(
    async (solutionId: string) => {
      if (!user?.id) {
        toast({ title: "Sign in to fork", variant: "destructive" });
        return;
      }
      try {
        const { newDraftId } = await forkSolution({ solutionId, forkerId: user.id });
        toast({ title: "Forked into a new draft" });
        navigate(`/upload/blueprint?draft=${newDraftId}`);
      } catch (e: any) {
        toast({ title: "Fork failed", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, navigate, toast],
  );

  const handleAcceptSolution = useCallback(
    (solutionId: string) => {
      if (!user?.id) return;
      const sol = solutionItems.find((s) => s.id === solutionId);
      if (!sol) return;
      const slot = bountySlots.find((s) => s.id === sol.slotId);
      const totalSlots = bountySlots.length || 0;
      const acceptedCount = Object.keys(slotAcceptance).length;
      const remainingSlotsAfter = Math.max(0, totalSlots - acceptedCount - 1);
      const isLastSlot = totalSlots > 0 && remainingSlotsAfter === 0;
      setAcceptDialog({
        solutionId,
        solverHandle: sol.solverUser.handle,
        solverDisplayName: sol.solverUser.displayName,
        slotName: slot?.name ?? "this slot",
        remainingSlotsAfter,
        isLastSlot,
      });
    },
    [user?.id, solutionItems, bountySlots, slotAcceptance],
  );

  const confirmAcceptSolution = useCallback(async () => {
    if (!user?.id || !acceptDialog) return;
    const { solutionId, solverHandle, isLastSlot } = acceptDialog;
    setAcceptSubmitting(true);
    try {
      await acceptSolution({ solutionId, accepterId: user.id });
      toast({
        title: "Solution accepted",
        description: `@${solverHandle} is now a co-author.`,
      });
      setAcceptDialog(null);
      if (isLastSlot) {
        setSolvedPulse(true);
        window.setTimeout(() => setSolvedPulse(false), 700);
      }
      void refetchSolutions();
      void refetchProvenance();
      void queryClient.invalidateQueries({ queryKey: ["post_for_viewer", id, user.id] });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (/already.*accepted/i.test(msg) || /conflict/i.test(msg)) {
        toast({
          title: "This slot was already solved. Refreshing…",
          variant: "destructive",
        });
        setAcceptDialog(null);
        void refetchSolutions();
        void refetchProvenance();
        void queryClient.invalidateQueries({ queryKey: ["post_for_viewer", id, user.id] });
      } else {
        toast({ title: "Accept failed", description: msg, variant: "destructive" });
      }
    } finally {
      setAcceptSubmitting(false);
    }
  }, [
    user?.id,
    acceptDialog,
    id,
    refetchSolutions,
    refetchProvenance,
    queryClient,
    toast,
  ]);

  const handlePromoteToBlueprint = useCallback(() => {
    toast({
      title: "Coming soon",
      description: "The bounty stays as the canonical record.",
    });
  }, [toast]);

  // ============== Bounty Manage Handlers ==============
  const handleManageReject = useCallback(
    async (solutionId: string) => {
      if (!user?.id || !post?.id) return;
      try {
        await markSolutionReviewStatus({
          bountyId: post.id as string,
          solutionId,
          authorId: user.id,
          status: "rejected",
        });
        toast({ title: "Marked rejected (private to you)" });
        void refetchManageAnalytics();
      } catch (e: any) {
        toast({ title: "Could not reject", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, post?.id, toast, refetchManageAnalytics],
  );

  const handleManageShortlist = useCallback(
    async (solutionId: string) => {
      if (!user?.id || !post?.id) return;
      try {
        await markSolutionReviewStatus({
          bountyId: post.id as string,
          solutionId,
          authorId: user.id,
          status: "shortlisted",
        });
        toast({ title: "Shortlisted" });
        void refetchManageAnalytics();
      } catch (e: any) {
        toast({ title: "Could not shortlist", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, post?.id, toast, refetchManageAnalytics],
  );

  const handleManageMessageUser = useCallback(
    async (otherUserId: string) => {
      if (!user?.id) return;
      if (otherUserId === user.id) return;
      try {
        const threadId = await createDirectThread(otherUserId);
        navigate(`/messages?thread=${threadId}`);
      } catch (e: any) {
        toast({ title: "Could not open thread", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, navigate, toast],
  );

  const handleManageExtendDeadline = useCallback(
    async (days: number) => {
      if (!user?.id || !post?.id) return;
      const current = (post as any).bounty_deadline as string | null;
      const base = current ? new Date(current) : new Date();
      base.setDate(base.getDate() + days);
      try {
        await extendBountyDeadline({
          bountyId: post.id as string,
          extenderUserId: user.id,
          newDeadline: base.toISOString(),
        });
        toast({ title: `Deadline extended by ${days} days` });
        void queryClient.invalidateQueries({ queryKey: ["post_for_viewer", id, user.id] });
      } catch (e: any) {
        toast({ title: "Could not extend", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, post, id, toast, queryClient],
  );

  const handleManageUpdateCriteria = useCallback(
    async (text: string) => {
      if (!user?.id || !post?.id) return;
      if (criteriaSaving) return;
      setCriteriaSaving(true);
      try {
        const { error } = await (supabase as any)
          .from("content_items")
          .update({ bounty_acceptance_criteria: text } as any)
          .eq("id", post.id as string);
        if (error) throw error;
        void queryClient.invalidateQueries({ queryKey: ["post_for_viewer", id, user.id] });
      } catch (e: any) {
        toast({ title: "Could not save criteria", description: e?.message, variant: "destructive" });
      } finally {
        setCriteriaSaving(false);
      }
    },
    [user?.id, post?.id, criteriaSaving, id, queryClient, toast],
  );

  const handleManagePauseToggle = useCallback(
    async (paused: boolean) => {
      if (!user?.id || !post?.id) return;
      try {
        const { error } = await (supabase as any)
          .from("content_items")
          .update({ bounty_submissions_paused: paused } as any)
          .eq("id", post.id as string);
        if (error) throw error;
        toast({ title: paused ? "Submissions paused" : "Submissions reopened" });
        void queryClient.invalidateQueries({ queryKey: ["post_for_viewer", id, user.id] });
      } catch (e: any) {
        toast({ title: "Update failed", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, post?.id, id, queryClient, toast],
  );

  const handleManageCloseBounty = useCallback(async () => {
    if (!user?.id || !post?.id) return;
    try {
      const { error } = await (supabase as any)
        .from("content_items")
        .update({ bounty_status: "closed" } as any)
        .eq("id", post.id as string);
      if (error) throw error;
      toast({ title: "Bounty closed" });
      setManagePanelOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["post_for_viewer", id, user.id] });
    } catch (e: any) {
      toast({ title: "Close failed", description: e?.message, variant: "destructive" });
    }
  }, [user?.id, post?.id, id, queryClient, toast]);

  const handleManagePreviewSolution = useCallback(
    (solutionId: string) => {
      // Scroll to the solution and let the solutions section reveal it.
      const el = document.querySelector(`[data-solution-id="${solutionId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        const next = new URLSearchParams(searchParams);
        next.set("solution", solutionId);
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const handleSubmitFirstSolution = useCallback(
    (slotId: string) => {
      if (!shellPost) return;
      const slot = bountySlots.find((s) => s.id === slotId);
      const kind = slot?.kind ?? "stage";
      navigate(`/b/${shellPost.slug}/solve/${slotId}?kind=${kind}`);
    },
    [shellPost, bountySlots, navigate],
  );

  const handleFilterChange = useCallback(
    (slotId: string | "all") => {
      const next = new URLSearchParams(searchParams);
      if (slotId === "all") next.delete("solutionFilter");
      else next.set("solutionFilter", slotId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const handleSortChange = useCallback(
    (sort: string) => {
      const next = new URLSearchParams(searchParams);
      if (sort === "most_votes") next.delete("solutionSort");
      else next.set("solutionSort", sort);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Deep-link: if URL hash is #solution-{id}, scroll + auto-expand.
  useEffect(() => {
    if (!isBounty || !solutionsData) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash.startsWith("#solution-")) return;
    const sid = hash.replace("#solution-", "");
    setExpandedSolutionIds((prev) => {
      if (prev.has(sid)) return prev;
      const next = new Set(prev);
      next.add(sid);
      return next;
    });
    const t = window.setTimeout(() => {
      document.getElementById(`solution-${sid}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [isBounty, solutionsData]);


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

  if (isMeta) {
    bodyNode = metaState ? (
      <MetaBountyBody
        meta={metaState}
        viewerId={user?.id ?? null}
        onPledged={() => void refetchMeta()}
      />
    ) : (
      <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.20)", fontSize: 13 }}>
        Loading meta-bounty…
      </div>
    );
  } else if (postType === "blog") {
    bodyNode = <BlogView item={post as any} />;
  } else {
    // blueprint or bounty — same article body renderer, with bounty using
    // existing renderers (Phase 5 missing-slot static badges remain).
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
        <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.20)", fontSize: 13 }}>
          Loading…
        </div>
      );
    }
  }

  // Spawned-from-meta attribution banner (for spawned bounties)
  if (spawnedFromMetaId && !isMeta) {
    bodyNode = (
      <>
        <SpawnedFromMetaBanner parentId={spawnedFromMetaId} />
        {bodyNode}
      </>
    );
  }


  // Build SolverInfo[] for byline + provenance overview
  const solversInfo: SolverInfo[] = useMemo(() => {
    const accepted = provenanceData?.acceptedSolvers ?? [];
    return accepted
      .filter((e) => !!e.user)
      .map((e) => ({
        id: e.user!.id,
        displayName: e.user!.display_name || e.user!.username || "Solver",
        handle: e.user!.username || e.user!.id.slice(0, 8),
        avatarUrl: e.user!.avatar_url || "",
        slotName: e.slotName || `${e.slotKind}`,
        acceptedAt: relativeShort(e.acceptedAt),
        isTrustedSolver: !!e.user!.is_trusted_solver,
      }));
  }, [provenanceData]);

  const bountyAuthorMeta = useMemo(() => {
    if (!shellAuthor) return null;
    return {
      id: shellAuthor.id,
      displayName: shellAuthor.displayName,
      handle: shellAuthor.handle,
      avatarUrl: shellAuthor.avatarUrl,
    };
  }, [shellAuthor]);

  const bountyByline =
    isBounty && bountyAuthorMeta ? (
      <BountyByline
        bountyAuthor={bountyAuthorMeta}
        solvers={solversInfo}
        isExpanded={bylineExpanded}
        onToggleExpand={() => setBylineExpanded((v) => !v)}
        onViewProvenance={() => {
          const el = document.querySelector("[data-provenance-overview]") as HTMLElement | null;
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onAuthorClick={(authorId) => navigate(`/profile/${shellAuthor?.handle || authorId}`)}
      />
    ) : null;

  // Discussion data mapping + handlers
  const acceptedSolverIds = useMemo(
    () => (provenanceData?.acceptedSolvers ?? []).map((e) => e.user?.id).filter(Boolean) as string[],
    [provenanceData],
  );
  const justPostedIdsRef = useRef<Set<string>>(new Set());
  const mapDiscussion = useCallback(
    (rows: any[]): DiscussionComment[] =>
      rows.map((r) => ({
        id: r.id,
        author: {
          id: r.author?.id ?? "unknown",
          displayName: r.author?.display_name || r.author?.username || "User",
          handle: r.author?.username || (r.author?.id ?? "user").slice(0, 8),
          avatarUrl: r.author?.avatar_url ?? null,
          isTrustedSolver: !!r.author?.is_trusted_solver,
        },
        content: r.body,
        timestamp: new Date(r.createdAt),
        reactions: (r.reactions ?? [])
          .filter((x: any) => ["upvote", "lightbulb", "heart"].includes(x.reaction))
          .map((x: any) => ({
            type: x.reaction as DiscussionReactionType,
            count: x.count,
            hasReacted: !!x.reactedByViewer,
          })),
        replies: r.replies ? mapDiscussion(r.replies) : [],
        isUnread: !!r.isUnread,
        isFromBountyAuthor: !!r.isFromBountyAuthor,
        isFromAcceptedSolver: !!r.isFromAcceptedSolver,
        isJustPosted: justPostedIdsRef.current.has(r.id),
      })),
    [],
  );
  const discussionThreads = useMemo(
    () => mapDiscussion(discussionData?.comments ?? []),
    [discussionData, mapDiscussion],
  );

  const handleDiscussionPost = useCallback(
    async (text: string, options: { tagBountyAuthor?: boolean }) => {
      if (!user?.id || !post?.id) {
        toast({ title: "Sign in to post", variant: "destructive" });
        return;
      }
      try {
        const row = await postDiscussionComment({
          bountyId: post.id as string,
          authorId: user.id,
          body: text,
          taggedBountyAuthor: !!options.tagBountyAuthor,
        });
        if (row?.id) justPostedIdsRef.current.add(row.id);
        await refetchDiscussion();
      } catch (e: any) {
        toast({ title: "Post failed", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, post?.id, refetchDiscussion, toast],
  );

  const handleDiscussionReply = useCallback(
    async (parentId: string, text: string) => {
      if (!user?.id || !post?.id) {
        toast({ title: "Sign in to reply", variant: "destructive" });
        return;
      }
      try {
        const row = await postDiscussionComment({
          bountyId: post.id as string,
          authorId: user.id,
          body: text,
          parentCommentId: parentId,
        });
        if (row?.id) justPostedIdsRef.current.add(row.id);
        await refetchDiscussion();
      } catch (e: any) {
        toast({ title: "Reply failed", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, post?.id, refetchDiscussion, toast],
  );

  const handleDiscussionReact = useCallback(
    async (commentId: string, reaction: DiscussionReactionType) => {
      if (!user?.id) {
        toast({ title: "Sign in to react", variant: "destructive" });
        return;
      }
      try {
        await reactToBountyComment({ commentId, reactorId: user.id, reaction });
        await refetchDiscussion();
      } catch (e: any) {
        toast({ title: "Reaction failed", description: e?.message, variant: "destructive" });
      }
    },
    [user?.id, refetchDiscussion, toast],
  );

  const handleDiscussionMore = useCallback(
    (commentId: string) => {
      void navigator.clipboard?.writeText(
        `${window.location.origin}${window.location.pathname}#discussion-${commentId}`,
      );
      toast({ title: "Link copied" });
    },
    [toast],
  );

  const handleDiscussionFilterChange = useCallback(
    (f: DiscussionFilterValue) => {
      const next = new URLSearchParams(searchParams);
      if (f === "all") next.delete("discussionFilter");
      else next.set("discussionFilter", f);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const handleDiscussionSortChange = useCallback(
    (s: DiscussionSortValue) => {
      const next = new URLSearchParams(searchParams);
      if (s === "newest") next.delete("discussionSort");
      else next.set("discussionSort", s);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const bountyExtras =
    isBounty ? (
      <>
        {solversInfo.length > 0 && bountyAuthorMeta && (
          <div
            data-provenance-overview
            style={{
              transition: "box-shadow 600ms ease-out",
              boxShadow: solvedPulse
                ? "0 0 0 2px rgba(46,196,182,0.55), 0 0 32px rgba(46,196,182,0.35)"
                : "none",
              borderRadius: 12,
            }}
          >
            <ProvenanceOverview
              bountyAuthor={{
                ...bountyAuthorMeta,
                postedAt: relativeShort(
                  ((post as any)?.published_at as string) ||
                    ((post as any)?.created_at as string) ||
                    new Date().toISOString()
                ),
              }}
              solvers={solversInfo}
              onSolverClick={(id) => {
                const s = solversInfo.find((x) => x.id === id);
                navigate(`/profile/${s?.handle || id}`);
              }}
              onLearnMore={() => navigate("/about/provenance")}
            />
            {isBountyAuthor && bountyStatus === "solved" && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handlePromoteToBlueprint}
                  className="px-3 py-1.5 rounded text-xs font-semibold border border-teal-500/40 text-teal-300 hover:bg-teal-500/10"
                >
                  Promote to blueprint
                </button>
              </div>
            )}
          </div>
        )}
        <div data-bounty-solutions-anchor />
        <BountySolutionsSection
          slots={bountySlots}
          solutions={solutionItems}
          filterSlotId={solutionFilter}
          onFilterChange={handleFilterChange}
          sort={solutionSort}
          onSortChange={handleSortChange}
          onVote={handleVoteSolution}
          onIWouldImplement={handleIWouldImplement}
          onShareSolution={handleShareSolution}
          onSaveSolution={handleSaveSolution}
          onForkSolution={handleForkSolution}
          onAccept={handleAcceptSolution}
          onSubmitFirstSolution={handleSubmitFirstSolution}
          isBountyAuthor={isBountyAuthor}
          bountyStatus={bountyStatus}
          viewerId={user?.id ?? null}
          expandedIds={expandedSolutionIds}
          onToggleExpand={handleToggleExpandSolution}
        />
        {acceptDialog && (
          <AcceptSolutionDialog
            open={!!acceptDialog}
            onOpenChange={(o) => {
              if (!o) setAcceptDialog(null);
            }}
            solverHandle={acceptDialog.solverHandle}
            solverDisplayName={acceptDialog.solverDisplayName}
            slotName={acceptDialog.slotName}
            remainingSlotsAfter={acceptDialog.remainingSlotsAfter}
            isLastSlot={acceptDialog.isLastSlot}
            onConfirm={confirmAcceptSolution}
            submitting={acceptSubmitting}
          />
        )}
        <div data-bounty-discussion-anchor />
        <BountyDiscussionForum
          bountyId={post?.id as string}
          bountyAuthorId={(post as any)?.creator_id as string}
          acceptedSolverIds={acceptedSolverIds}
          threads={discussionThreads}
          filter={discussionFilter}
          sort={discussionSort}
          onFilterChange={handleDiscussionFilterChange}
          onSortChange={handleDiscussionSortChange}
          onPost={handleDiscussionPost}
          onReply={handleDiscussionReply}
          onReact={handleDiscussionReact}
          onMore={handleDiscussionMore}
          composerExpanded={composerExpanded}
          onToggleComposer={() => setComposerExpanded((v) => !v)}
          viewerId={user?.id ?? null}
        />
      </>
    ) : null;

  // ─── Solver Leaderboard (Phase 11) ───
  const lbSortRaw = (searchParams.get("lbSort") as string) || "votes";
  const lbSort = ["votes", "submissions", "accepted", "newest"].includes(lbSortRaw) ? lbSortRaw : "votes";
  const setLbSort = useCallback(
    (s: string) => {
      const next = new URLSearchParams(searchParams);
      if (s === "votes") next.delete("lbSort");
      else next.set("lbSort", s);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const [lbContributors, setLbContributors] = useState<LbContributor[]>([]);
  const [lbActivity, setLbActivity] = useState<LbActivity[]>([]);
  const [lbHighlightId, setLbHighlightId] = useState<string | null>(null);
  const [isWideViewport, setIsWideViewport] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
  );
  useEffect(() => {
    const onResize = () => setIsWideViewport(window.innerWidth >= 1280);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    if (!isBounty || !post?.id) return;
    const sortMap: Record<string, "votes" | "submissions" | "acceptances" | "rank"> = {
      votes: "votes",
      submissions: "submissions",
      accepted: "acceptances",
      newest: "rank",
    };
    try {
      const [entries, acts] = await Promise.all([
        getLeaderboard({ bountyId: post.id as string, sort: sortMap[lbSort], limit: 20 }),
        getLeaderboardActivity(post.id as string, 5),
      ]);
      setLbContributors((prev) => {
        const next: LbContributor[] = entries.map((e) => ({
          rank: e.rank,
          user: {
            id: e.profile?.id ?? e.userId,
            displayName: e.profile?.displayName || e.profile?.username || "Anonymous",
            handle: e.profile?.username || "user",
            avatarUrl: e.profile?.avatarUrl || "",
            isTrustedSolver: !!e.profile?.isTrustedSolver,
          },
          voteCount: e.voteTotal,
          submissionCount: e.submissionCount,
          acceptedCount: e.acceptanceCount,
          hasActiveDraft: e.hasActiveDraft,
          publicActiveDraft: true,
        }));
        // Detect rank change → highlight 600ms
        if (prev.length > 0) {
          const prevMap = new Map(prev.map((c) => [c.user.id, c.rank]));
          const moved = next.find((c) => prevMap.has(c.user.id) && prevMap.get(c.user.id) !== c.rank);
          if (moved) {
            setLbHighlightId(moved.user.id);
            setTimeout(() => setLbHighlightId(null), 600);
          }
        }
        return next;
      });
      setLbActivity(acts);
    } catch (e) {
      console.warn("[leaderboard] refresh failed", e);
    }
  }, [isBounty, post?.id, lbSort]);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  useLeaderboardUpdates(isBounty ? (post?.id as string | undefined) : undefined, refreshLeaderboard);

  const leaderboardNarrow = useMemo(() => {
    if (!isBounty || !post?.id || isWideViewport) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <SolverLeaderboard
          bountyId={post.id as string}
          variant="narrow"
          contributors={lbContributors}
          sort={lbSort}
          onSortChange={setLbSort}
          onContributorClick={(uid) => {
            const c = lbContributors.find((x) => x.user.id === uid);
            navigate(`/profile/${c?.user.handle || uid}`);
          }}
          recentActivity={lbActivity}
          onViewAll={() => navigate(`/b/${shellPost?.slug ?? post.id}/leaderboard`)}
          isLive
          highlightedUserId={lbHighlightId}
        />
      </div>
    );
  }, [isBounty, post, isWideViewport, lbContributors, lbSort, setLbSort, lbActivity, lbHighlightId, navigate, shellPost?.slug]);

  // ─── Bounty competition header (Phase 11) ───
  const bountyHeaderNode = useMemo(() => {
    if (!isBounty || !post) return null;
    if (isMeta) {
      if (!metaState) return null;
      return (
        <MetaBountyHeader
          meta={{
            id: metaState.bountyId,
            title: metaState.title,
            description: metaState.description ?? "",
            totalPledged: metaState.totalPledged,
            totalPledgers: metaState.totalPledgers,
            fundingDeadline: metaState.fundingDeadline,
            subBountyCount: metaState.subBounties.length,
            spawnedCount: metaState.subBounties.filter((s) => !!s.spawnedBountyId).length,
          }}
        />
      );
    }
    const submissionCount =
      ((post as any).bounty_total_submissions as number | null) ??
      solutionItems.length;
    const activeSolverCount =
      ((post as any).bounty_active_solvers as number | null) ??
      new Set(solutionItems.map((s) => (s.solverUser as any)?.id).filter(Boolean)).size;
    const commentCount =
      ((post as any).comment_count as number | null) ??
      discussionThreads.length;
    const slotsTotal =
      ((post as any).bounty_total_slots as number | null) ??
      bountySlots.length;
    const slotsSolved =
      ((post as any).bounty_solved_count as number | null) ??
      Object.keys(slotAcceptance).length;

    let derivedStatus: "open" | "closed" | "solved" | "partially_solved" =
      bountyStatus;
    if (
      bountyStatus === "open" &&
      slotsTotal > 0 &&
      slotsSolved > 0 &&
      slotsSolved < slotsTotal
    ) {
      derivedStatus = "partially_solved";
    }

    const rewardRaw = (post as any).bounty_reward_type as string | null;
    const rewardType: "cash" | "token" | "kudos" | "none" =
      rewardRaw === "cash" || rewardRaw === "token" || rewardRaw === "kudos"
        ? rewardRaw
        : (post as any).bounty_reward
          ? "cash"
          : "none";

    const deadlineRaw = (post as any).bounty_deadline as string | null;
    const createdRaw =
      ((post as any).published_at as string | null) ||
      ((post as any).created_at as string | null) ||
      new Date().toISOString();
    const solvedRaw = (post as any).bounty_solved_at as string | null;

    const headerBounty: BountyCompetitionHeaderBounty = {
      id: post.id as string,
      slug: ((post as any).slug as string) ?? (post.id as string),
      title: ((post as any).title as string) ?? "Untitled bounty",
      description: ((post as any).description as string) ?? "",
      status: derivedStatus,
      sequentialId: ((post as any).bounty_sequential_id as number) ?? 0,
      rewardType,
      rewardAmount: ((post as any).bounty_reward as number) ?? undefined,
      rewardCurrency:
        ((post as any).bounty_reward_currency as string) ?? undefined,
      deadline: deadlineRaw ? new Date(deadlineRaw) : null,
      submissionCount,
      activeSolverCount,
      commentCount,
      slotsTotal,
      slotsSolved,
      createdAt: new Date(createdRaw),
      solvedAt: solvedRaw ? new Date(solvedRaw) : null,
    };

    const missingSlots = bountySlots.filter(
      (s) => !slotAcceptance[s.id],
    );

    const onSubmit = () => {
      if (missingSlots.length === 1 && shellPost) {
        const slot = missingSlots[0];
        navigate(`/b/${shellPost.slug}/solve/${slot.id}?kind=${slot.kind}`);
      } else {
        handleSubmitSolution();
      }
    };

    return (
      <>
        <BountyCompetitionHeader
          bounty={headerBounty}
          isOwnBounty={isBountyAuthor}
          onSubmitSolution={onSubmit}
          onDiscussion={handleScrollToDiscussion}
          onAskAuthor={handleAskAuthor}
          onManageBounty={() => setManagePanelOpen(true)}
          onPromoteToBlueprint={handlePromoteToBlueprint}
        />
        {leaderboardNarrow}
      </>
    );
  }, [
    isBounty,
    isMeta,
    metaState,
    post,
    solutionItems,
    discussionThreads,
    bountySlots,
    slotAcceptance,
    bountyStatus,
    isBountyAuthor,
    shellPost,
    navigate,
    handleSubmitSolution,
    handleScrollToDiscussion,
    handleAskAuthor,
    handlePromoteToBlueprint,
    toast,
    leaderboardNarrow,
  ]);

  return (
    <CommentDrawerProvider value={drawerContextValue}>
      <BountyProvenanceProvider
        value={{
          bountySlug: shellPost.slug,
          bountyId: shellPost.id,
          bountyStatus,
          slotSolutionCounts,
          slotAcceptance,
          bountyAuthor: provenanceData?.bountyAuthor ?? null,
          acceptedSolvers: provenanceData?.acceptedSolvers ?? [],
          onViewOriginalSolution: handleViewOriginalSolution,
        }}
      >
      {(() => {
        const SITE = (import.meta as any).env?.VITE_SITE_URL || "https://neoscaleai.com";
        const postUrl = `${SITE}/b/${shellPost.slug}`;
        const authorUrl = shellAuthor?.handle ? `${SITE}/u/${shellAuthor.handle}` : `${SITE}/profile`;
        const schemaType =
          shellPost.postType === "bounty"
            ? "Question"
            : shellPost.postType === "blueprint"
            ? "TechArticle"
            : "Article";
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
            name: "NeoScale",
            url: SITE,
          },
          mainEntityOfPage: postUrl,
          keywords: (shellPost.tags ?? []).join(", "),
        };
        if (shellPost.postType === "bounty") {
          articleLd.answerCount = (data?.bountySolvers ?? []).length;
          articleLd.acceptedAnswer = (post as any)?.bounty_solved_at
            ? { "@type": "Answer", text: "Accepted solution available" }
            : undefined;
        }
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
            title={`${shellPost.title} — NeoScale`}
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
        bountySolvers={data?.bountySolvers ?? []}
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
        bountyExtrasSlot={bountyExtras}
        headerSlot={bountyHeaderNode}
        bylineSlot={bountyByline}
      >
        {bodyNode}
      </ContentDetailShell>
      {isBounty && isWideViewport && shellPost && (
        <div
          style={{
            position: "fixed",
            top: 96,
            right: 24,
            width: 320,
            maxHeight: "calc(100vh - 140px)",
            overflow: "auto",
            zIndex: 30,
          }}
        >
          <SolverLeaderboard
            bountyId={post!.id as string}
            variant="desktop"
            contributors={lbContributors}
            sort={lbSort}
            onSortChange={setLbSort}
            onContributorClick={(uid) => {
              const c = lbContributors.find((x) => x.user.id === uid);
              navigate(`/profile/${c?.user.handle || uid}`);
            }}
            recentActivity={lbActivity}
            onViewAll={() => navigate(`/b/${shellPost.slug}/leaderboard`)}
            isLive
            highlightedUserId={lbHighlightId}
          />
        </div>
      )}
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
        onSubmitSolution={shellPost.postType === "bounty" ? handleSubmitSolution : undefined}
        onEdit={isOwnPost ? handleEdit : undefined}
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
          isLoading={drawerLoading}
        />
      )}
      {originalDialog && (
        <OriginalSolutionDialog
          open={!!originalDialog}
          onClose={() => setOriginalDialog(null)}
          original={originalDialog.original}
          current={originalDialog.current}
          slotKind={originalDialog.slotKind}
          slotId={originalDialog.slotId}
        />
      )}
      {isBounty && post && (
        <BountyManagementPanelContainer
          open={managePanelOpen}
          onClose={() => setManagePanelOpen(false)}
          isAuthor={isBountyAuthor}
          post={post as any}
          analytics={manageAnalytics}
          solutionsRaw={solutionsData?.solutions ?? []}
          bountySlots={bountySlots}
          bountyStatus={bountyStatus}
          onAcceptSolution={handleAcceptSolution}
          onRejectSolution={handleManageReject}
          onShortlistSolution={handleManageShortlist}
          onPreviewSolution={handleManagePreviewSolution}
          onMessageUser={handleManageMessageUser}
          onExtendDeadline={handleManageExtendDeadline}
          onUpdateAcceptanceCriteria={handleManageUpdateCriteria}
          onPauseSubmissions={() => handleManagePauseToggle(true)}
          onResumeSubmissions={() => handleManagePauseToggle(false)}
          onCloseBounty={handleManageCloseBounty}
          onPromoteToBlueprint={handlePromoteToBlueprint}
        />
      )}
      </BountyProvenanceProvider>
    </CommentDrawerProvider>
  );
}


function SpawnedFromMetaBanner({ parentId }: { parentId: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["spawned_from_meta", parentId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("content_items")
        .select("id, title")
        .eq("id", parentId)
        .single();
      return data as { id: string; title: string } | null;
    },
    enabled: !!parentId,
  });
  if (!data) return null;
  return (
    <div
      onClick={() => navigate(`/content/${parentId}`)}
      style={{
        background: "rgba(124,58,237,0.08)",
        border: "1px solid rgba(124,58,237,0.25)",
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 16,
        fontFamily: "Inter, sans-serif",
        fontSize: 12,
        color: "rgba(255,255,255,0.75)",
        cursor: "pointer",
      }}
    >
      Spawned from meta-bounty:{" "}
      <span style={{ color: "#A78BFA", fontWeight: 600 }}>{data.title}</span>
    </div>
  );
}


function relativeShort(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const day = 86400_000;
    if (diff < day) return "today";
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
