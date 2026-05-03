import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "@/lib/content-detail";
import { supabase } from "@/integrations/supabase/client";

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

  if (postType === "blog") {
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

  // Bounty extras placeholder — Phase 11 will mount BountySolutionsSection,
  // BountyDiscussionForum, ProvenanceOverview, BountyByline upgrades, and
  // InlineSolutionMarker components here.
  const bountyExtras =
    postType === "bounty" ? (
      // Phase 11 mounts here
      <div
        style={{
          marginTop: 32,
          padding: 24,
          borderRadius: 12,
          border: "1px dashed rgba(255,255,255,0.10)",
          textAlign: "center",
          fontSize: 12,
          color: "rgba(255,255,255,0.40)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Bounty solutions & discussion mount here — Phase 11
      </div>
    ) : null;

  return (
    <>
      <SeoHead
        title={`${shellPost.title} — NeoScale`}
        description={shellPost.description || shellPost.title}
        path={`/content/${shellPost.slug}`}
        image={shellPost.coverUrl}
        ogType="article"
      />
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
        resultsSlot={
          <ResultsViewerSection
            contentItemId={post.id as string}
            postSlug={shellPost.slug}
          />
        }
        bountyExtrasSlot={bountyExtras}
      >
        {bodyNode}
      </ContentDetailShell>
    </>
  );
}
