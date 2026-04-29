import { supabase } from "@/integrations/supabase/client";
import type { Primitive } from "./types";

/**
 * Returns up to `limit` blocks authored by this user, ranked by how often
 * other content_items reference the parent post (via blog_referenced_post_ids
 * or as a fork). A real implementation would track per-block references in a
 * dedicated table; until that exists we surface the top blocks of the author's
 * most-referenced posts as a reasonable proxy.
 */
export async function getMostReferenced(
  userId: string,
  limit: number
): Promise<Primitive[]> {
  if (!userId) return [];
  if (limit <= 0) return [];

  // 1. Pull all of this user's posts.
  const { data: posts } = await supabase
    .from("content_items")
    .select("id, title, slug, post_type")
    .eq("creator_id", userId);
  const postRows = (posts ?? []) as Array<{
    id: string;
    title: string;
    slug: string | null;
    post_type: string;
  }>;
  if (postRows.length === 0) return [];

  const postIds = postRows.map(p => p.id);
  const postById = new Map(postRows.map(p => [p.id, p]));

  // 2. Score each post by inbound references.
  const refCount = new Map<string, number>();
  for (const id of postIds) refCount.set(id, 0);

  const [{ data: referers }, { data: forks }] = await Promise.all([
    supabase
      .from("content_items")
      .select("blog_referenced_post_ids")
      .overlaps("blog_referenced_post_ids", postIds),
    supabase
      .from("content_items")
      .select("fork_of_content_id")
      .in("fork_of_content_id", postIds),
  ]);

  for (const row of (referers ?? []) as Array<{ blog_referenced_post_ids: string[] | null }>) {
    for (const id of row.blog_referenced_post_ids ?? []) {
      if (refCount.has(id)) refCount.set(id, (refCount.get(id) ?? 0) + 1);
    }
  }
  for (const row of (forks ?? []) as Array<{ fork_of_content_id: string | null }>) {
    if (row.fork_of_content_id && refCount.has(row.fork_of_content_id)) {
      refCount.set(
        row.fork_of_content_id,
        (refCount.get(row.fork_of_content_id) ?? 0) + 1
      );
    }
  }

  // 3. Pick the top posts and grab one representative block per post.
  const rankedPosts = Array.from(refCount.entries())
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (rankedPosts.length === 0) return [];

  const topIds = rankedPosts.map(([id]) => id);
  const { data: blocks } = await supabase
    .from("content_blocks")
    .select("id, content_id, block_type, text_content, position")
    .in("content_id", topIds)
    .order("position", { ascending: true });

  // First block (lowest position) per content_id.
  const firstBlockByPost = new Map<string, { id: string; block_type: string; text_content: string | null }>();
  for (const b of (blocks ?? []) as Array<{
    id: string;
    content_id: string;
    block_type: string;
    text_content: string | null;
  }>) {
    if (!firstBlockByPost.has(b.content_id)) {
      firstBlockByPost.set(b.content_id, {
        id: b.id,
        block_type: b.block_type,
        text_content: b.text_content,
      });
    }
  }

  return rankedPosts.map(([postId, count]) => {
    const parent = postById.get(postId);
    const block = firstBlockByPost.get(postId);
    const preview =
      (block?.text_content ?? parent?.title ?? "Untitled").slice(0, 140);
    return {
      blockId: block?.id ?? postId,
      blockType: block?.block_type ?? "post",
      preview,
      referenceCount: count,
      parent: parent
        ? {
            contentId: parent.id,
            title: parent.title,
            slug: parent.slug,
            postType: parent.post_type,
          }
        : null,
    };
  });
}
