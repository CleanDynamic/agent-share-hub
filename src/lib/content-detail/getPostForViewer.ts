import { supabase } from "@/integrations/supabase/client";
import type { PostForViewer, AuthorInfo, RelatedPost, ViewerState } from "./types";

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: PostForViewer; at: number }>();

function cacheKey(slug: string, viewerId?: string | null) {
  return `${slug}::${viewerId ?? "anon"}`;
}

async function fetchAuthor(id: string): Promise<AuthorInfo | null> {
  const { data } = await (supabase as any)
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, derived_bio")
    .eq("id", id)
    .maybeSingle();
  return (data as AuthorInfo) ?? null;
}

async function fetchRelated(post: any): Promise<RelatedPost[]> {
  if (!post?.id) return [];
  const { data } = await (supabase as any)
    .from("content_items")
    .select("id, title, slug, post_type, cover_image_url")
    .neq("id", post.id)
    .eq("status", "approved")
    .eq("post_type", post.post_type)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []) as RelatedPost[];
}

async function fetchViewerState(post: any, viewerId?: string | null): Promise<ViewerState> {
  const empty: ViewerState = {
    hasLiked: false,
    hasBookmarked: false,
    hasReposted: false,
    isFollowing: false,
    readingProgressPct: 0,
  };
  if (!viewerId || !post?.id) return empty;

  const [interactions, bookmark, reading, follow] = await Promise.all([
    (supabase as any)
      .from("user_interactions")
      .select("interaction_type")
      .eq("user_id", viewerId)
      .eq("content_id", post.id),
    (supabase as any)
      .from("collection_items")
      .select("id")
      .eq("added_by", viewerId)
      .eq("content_id", post.id)
      .limit(1),
    (supabase as any)
      .from("reading_progress")
      .select("last_progress_pct")
      .eq("reader_id", viewerId)
      .eq("post_id", post.id)
      .maybeSingle(),
    (supabase as any)
      .from("follows")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", post.creator_id)
      .limit(1),
  ]);

  const types = new Set<string>(((interactions.data ?? []) as any[]).map((r) => r.interaction_type));
  return {
    hasLiked: types.has("liked"),
    hasReposted: types.has("reblogged") || types.has("reposted"),
    hasBookmarked: ((bookmark.data ?? []) as any[]).length > 0,
    isFollowing: ((follow.data ?? []) as any[]).length > 0,
    readingProgressPct: (reading.data as any)?.last_progress_pct ?? 0,
  };
}

async function fetchBountyExtras(post: any) {
  if (post?.post_type !== "bounty") {
    return { bountySolvers: [] as AuthorInfo[], solutions: [], discussionRoots: [], provenance: [] };
  }
  // Solutions: any content_item with fork_of_content_id pointing here
  const { data: solutions } = await (supabase as any)
    .from("content_items")
    .select("id, title, slug, creator_id, status, created_at")
    .eq("fork_of_content_id", post.id)
    .order("created_at", { ascending: false });

  const solverIds = Array.from(
    new Set(((solutions ?? []) as any[]).map((s) => s.creator_id).filter(Boolean)),
  );
  let bountySolvers: AuthorInfo[] = [];
  if (solverIds.length > 0) {
    const { data: profs } = await (supabase as any)
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, derived_bio")
      .in("id", solverIds);
    bountySolvers = (profs ?? []) as AuthorInfo[];
  }

  // Discussion roots: top-level primitive_comments anchored to the post
  const { data: roots } = await (supabase as any)
    .from("primitive_comments")
    .select("id, author_id, body_text, created_at")
    .eq("anchor_type", "post")
    .eq("anchor_id", post.id)
    .is("parent_comment_id", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    bountySolvers,
    solutions: (solutions ?? []) as any[],
    discussionRoots: (roots ?? []) as any[],
    provenance: [], // placeholder for future provenance chain
  };
}

export async function getPostForViewer({
  slug,
  viewerId,
}: {
  slug: string;
  viewerId?: string | null;
}): Promise<PostForViewer> {
  const key = cacheKey(slug, viewerId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  // Resolve post by slug OR id
  const { data: postBySlug } = await (supabase as any)
    .from("content_items")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  let post = postBySlug;
  if (!post) {
    const { data: postById } = await (supabase as any)
      .from("content_items")
      .select("*")
      .eq("id", slug)
      .maybeSingle();
    post = postById;
  }
  if (!post) throw new Error(`Post not found: ${slug}`);

  const [author, related, viewer, bounty] = await Promise.all([
    fetchAuthor(post.creator_id),
    fetchRelated(post),
    fetchViewerState(post, viewerId),
    fetchBountyExtras(post),
  ]);

  const result: PostForViewer = {
    post,
    author: author ?? {
      id: post.creator_id,
      username: null,
      display_name: null,
      avatar_url: null,
      bio: null,
      derived_bio: null,
    },
    bountySolvers: bounty.bountySolvers,
    relatedPosts: related,
    viewer,
    solutions: bounty.solutions,
    discussionRoots: bounty.discussionRoots,
    provenance: bounty.provenance,
  };

  cache.set(key, { value: result, at: Date.now() });
  return result;
}

export function clearPostForViewerCache(slug?: string) {
  if (!slug) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) if (k.startsWith(`${slug}::`)) cache.delete(k);
}
