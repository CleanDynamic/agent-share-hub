"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useReblogCompose } from "@/contexts/ReblogComposeContext";
import { useShareMenu } from "@/components/share/ShareMenuProvider";
import { likeReblog } from "@/lib/reblog/likeReblog";
import { bookmarkReblog } from "@/lib/reblog/bookmarkReblog";
import { deleteReblog } from "@/lib/reblog/deleteReblog";
import {
  ReblogFeedCard,
  type Engagement,
  type Reblog,
} from "@/components/reblog/ReblogFeedCard";
import type { EmbeddedOriginalCardPost } from "@/components/reblog/EmbeddedOriginalCard";
import {
  PrimitiveCommentDrawer,
  type AnchorType,
} from "@/components/content-detail/PrimitiveCommentDrawer";

/**
 * Raw reblog row shape returned by feed queries.
 * Joined with reblogger profile + embedded original post.
 */
export interface FeedReblogRow {
  id: string;
  slug: string;
  text: string | null;
  media_kind: "image" | "video" | null;
  media_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  reblog_count?: number | null;
  like_count?: number | null;
  comment_count?: number | null;
  bookmark_count?: number | null;
  parent_reblog_id?: string | null;
  root_original_post_id?: string | null;
  original_post_id: string;
  reblogger_id: string;
  viewer_has_liked?: boolean;
  viewer_has_bookmarked?: boolean;
  viewer_has_reblogged?: boolean;
  reblogger?: {
    id?: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
  embedded_original?: {
    id: string;
    slug: string;
    title: string;
    description?: string | null;
    post_type?: string | null;
    cover_image_url?: string | null;
    created_at?: string | null;
    creator_id?: string | null;
    author?: {
      username?: string | null;
      display_name?: string | null;
      avatar_url?: string | null;
    } | null;
  } | null;
}

interface FeedReblogAdapterProps {
  row: FeedReblogRow;
  variant?: "feed" | "profile-zone";
}

function mapPostType(t?: string | null): EmbeddedOriginalCardPost["postType"] {
  const x = (t ?? "").toLowerCase();
  if (x === "blog" || x === "discussion") return "blog";
  if (x === "bounty") return "bounty";
  return "blueprint";
}

export function FeedReblogAdapter({ row, variant = "feed" }: FeedReblogAdapterProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openReblog } = useReblogCompose();
  const shareMenu = useShareMenu();

  // Optimistic local engagement state.
  const [engagement, setEngagement] = useState<Engagement>({
    likeCount: row.like_count ?? 0,
    hasLiked: !!row.viewer_has_liked,
    commentCount: row.comment_count ?? 0,
    reblogCount: row.reblog_count ?? 0,
    hasReblogged: !!row.viewer_has_reblogged,
    bookmarkCount: row.bookmark_count ?? 0,
    hasBookmarked: !!row.viewer_has_bookmarked,
  });
  const [commentsOpen, setCommentsOpen] = useState(false);

  const reblogger = row.reblogger ?? {};
  const reblog: Reblog = {
    id: row.id,
    slug: row.slug,
    text: row.text ?? "",
    media:
      row.media_kind && row.media_url
        ? {
            kind: row.media_kind,
            url: row.media_url,
            thumbnailUrl: row.thumbnail_url ?? undefined,
          }
        : undefined,
    rebloggerDisplayName: reblogger.display_name || reblogger.username || "Unknown",
    rebloggerHandle: reblogger.username || "unknown",
    rebloggerAvatarUrl: reblogger.avatar_url || "",
    publishedAt: row.created_at,
  };

  const embedded: EmbeddedOriginalCardPost | null = row.embedded_original
    ? {
        id: row.embedded_original.id,
        slug: row.embedded_original.slug,
        postType: mapPostType(row.embedded_original.post_type),
        title: row.embedded_original.title,
        description: row.embedded_original.description ?? undefined,
        authorDisplayName:
          row.embedded_original.author?.display_name ||
          row.embedded_original.author?.username ||
          "Unknown",
        authorHandle: row.embedded_original.author?.username
          ? `@${row.embedded_original.author.username}`
          : "@unknown",
        authorAvatarUrl: row.embedded_original.author?.avatar_url || "",
        publishedAt: row.embedded_original.created_at || row.created_at,
        coverUrl: row.embedded_original.cover_image_url ?? undefined,
      }
    : null;

  const requireAuth = () => {
    if (!user) {
      toast.error("Sign in to do that");
      navigate("/login");
      return false;
    }
    return true;
  };

  const handleLike = async () => {
    if (!requireAuth()) return;
    const wasLiked = engagement.hasLiked;
    setEngagement((s) => ({
      ...s,
      hasLiked: !wasLiked,
      likeCount: s.likeCount + (wasLiked ? -1 : 1),
    }));
    try {
      await likeReblog({ reblogId: row.id, likerId: user!.id });
    } catch (e) {
      setEngagement((s) => ({
        ...s,
        hasLiked: wasLiked,
        likeCount: s.likeCount + (wasLiked ? 1 : -1),
      }));
      toast.error("Couldn't update like");
    }
  };

  const handleBookmark = async () => {
    if (!requireAuth()) return;
    const was = engagement.hasBookmarked;
    setEngagement((s) => ({
      ...s,
      hasBookmarked: !was,
      bookmarkCount: s.bookmarkCount + (was ? -1 : 1),
    }));
    try {
      await bookmarkReblog({ reblogId: row.id, bookmarkerId: user!.id });
    } catch (e) {
      setEngagement((s) => ({
        ...s,
        hasBookmarked: was,
        bookmarkCount: s.bookmarkCount + (was ? 1 : -1),
      }));
      toast.error("Couldn't update bookmark");
    }
  };

  const handleReblogChain = () => {
    if (!requireAuth()) return;
    // Reblog this reblog → chain via parent_reblog_id, original_post_id = root.
    openReblog({
      id: row.original_post_id,
      slug: row.embedded_original?.slug,
      title: row.embedded_original?.title ?? "Reblog",
      description: row.embedded_original?.description ?? null,
      post_type: row.embedded_original?.post_type ?? null,
      cover_image_url: row.embedded_original?.cover_image_url ?? null,
      created_at: row.embedded_original?.created_at ?? null,
      creator_id: row.embedded_original?.creator_id ?? null,
      author: row.embedded_original?.author ?? null,
      parent_reblog_id: row.id,
      root_original_post_id: row.root_original_post_id ?? row.original_post_id,
    });
  };

  const handleShare = () => {
    shareMenu.openShareMenu({
      contentId: row.id,
      title: `Reblog by @${reblog.rebloggerHandle}`,
      url: `${window.location.origin}/b/${reblog.slug}`,
    } as any);
  };

  const handleMore = async () => {
    const isOwner = user?.id === row.reblogger_id;
    if (isOwner && window.confirm("Delete this reblog?")) {
      try {
        await deleteReblog({ reblogId: row.id, rebloggerId: user!.id } as any);
        toast.success("Reblog deleted");
      } catch {
        toast.error("Couldn't delete");
      }
    } else {
      navigator.clipboard?.writeText(`${window.location.origin}/b/${reblog.slug}`);
      toast.success("Link copied");
    }
  };

  return (
    <>
      <ReblogFeedCard
        reblog={reblog}
        engagement={engagement}
        embeddedOriginal={embedded}
        variant={variant}
        onReblogClick={handleReblogChain}
        onLikeClick={handleLike}
        onCommentClick={() => setCommentsOpen(true)}
        onBookmarkClick={handleBookmark}
        onShareClick={handleShare}
        onRebloggerClick={() =>
          navigate(`/profile/${reblogger.username ?? row.reblogger_id}`)
        }
        onOriginalClick={() => {
          if (row.embedded_original?.slug) {
            navigate(`/b/${row.embedded_original.slug}`);
          }
        }}
        onMore={handleMore}
      />

      {commentsOpen && (
        <PrimitiveCommentDrawer
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          anchorType={"post" as AnchorType /* TODO: widen to 'reblog' */}
          anchorId={row.id}
          anchorPreview={{
            type: "post",
            title: reblog.text?.slice(0, 80) || "Reblog",
          } as any}
          threads={[]}
          viewerId={user?.id ?? ""}
          postAuthorId={row.reblogger_id}
          onPost={() => {}}
          onReply={() => {}}
          onReact={() => {}}
          onMore={() => {}}
          isLoading={false}
        />
      )}
    </>
  );
}
