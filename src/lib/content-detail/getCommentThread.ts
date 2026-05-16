import { supabase } from "@/integrations/supabase/client";
import type { AnchorType, AuthorInfo, ThreadedComment } from "./types";

/**
 * For deep-link / "Continued thread" navigation.
 *
 * Given a comment id, returns:
 *   • `ancestors` — the full chain from root to this comment (inclusive),
 *     ordered root → target.
 *   • `target` — the comment itself with its full descendant subtree
 *     attached (replies sorted chronologically).
 *
 * Descendants are bounded by `maxDepth` (default 20) to prevent runaway
 * recursion on pathological threads.
 */
export async function getCommentThread({
  commentId,
  maxDepth = 20,
}: {
  commentId: string;
  maxDepth?: number;
}): Promise<{ ancestors: ThreadedComment[]; target: ThreadedComment | null }> {
  // 1. Walk up the ancestor chain (root → target).
  const ancestorRows: any[] = [];
  let cursor: string | null = commentId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const { data, error } = await (supabase as any)
      .from("primitive_comments")
      .select(
        "id, anchor_type, anchor_id, parent_comment_id, author_id, body, body_text, is_edited, created_at, updated_at, deleted_at, reply_count",
      )
      .eq("id", cursor)
      .maybeSingle();
    if (error) throw error;
    if (!data) break;
    ancestorRows.unshift(data);
    cursor = data.parent_comment_id;
  }
  if (ancestorRows.length === 0) return { ancestors: [], target: null };

  const targetRow = ancestorRows[ancestorRows.length - 1];
  const { anchor_type, anchor_id } = targetRow;

  // 2. Pull the full descendant subtree iteratively (BFS) up to maxDepth.
  const descendants: any[] = [];
  let frontier: string[] = [targetRow.id];
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const { data, error } = await (supabase as any)
      .from("primitive_comments")
      .select(
        "id, anchor_type, anchor_id, parent_comment_id, author_id, body, body_text, is_edited, created_at, updated_at, deleted_at, reply_count",
      )
      .in("parent_comment_id", frontier);
    if (error) throw error;
    const batch = (data ?? []) as any[];
    if (batch.length === 0) break;
    descendants.push(...batch);
    frontier = batch.map((r) => r.id);
  }

  // 3. Fetch authors for everything in the response.
  const all = [...ancestorRows, ...descendants];
  const authorIds = Array.from(new Set(all.map((r) => r.author_id).filter(Boolean)));
  const { data: authors } = authorIds.length
    ? await (supabase as any)
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, derived_bio")
        .in("id", authorIds)
    : { data: [] as AuthorInfo[] };
  const authorMap = new Map<string, AuthorInfo>(
    ((authors ?? []) as AuthorInfo[]).map((a) => [a.id, a]),
  );

  const toNode = (r: any): ThreadedComment => ({
    id: r.id,
    anchor_type: r.anchor_type as AnchorType,
    anchor_id: r.anchor_id,
    parent_comment_id: r.parent_comment_id,
    author: authorMap.get(r.author_id) ?? null,
    body: r.body,
    bodyText: r.body_text ?? "",
    createdAt: r.created_at,
    isEdited: !!r.is_edited,
    isDeleted: !!r.deleted_at,
    reactions: [],
    replies: [],
    isUnread: false,
  });

  // 4. Build the target subtree from descendants.
  const subtreeMap = new Map<string, ThreadedComment>();
  const targetNode = toNode(targetRow);
  subtreeMap.set(targetNode.id, targetNode);
  for (const r of descendants) subtreeMap.set(r.id, toNode(r));
  for (const node of subtreeMap.values()) {
    if (node.id === targetNode.id) continue;
    const parent = node.parent_comment_id
      ? subtreeMap.get(node.parent_comment_id)
      : null;
    if (parent) parent.replies.push(node);
  }
  const sortReplies = (list: ThreadedComment[]) => {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    list.forEach((n) => sortReplies(n.replies));
  };
  sortReplies(targetNode.replies);

  // 5. Ancestor chain (root → target, excluding target itself).
  const ancestors = ancestorRows.slice(0, -1).map(toNode);
  void anchor_type;
  void anchor_id;

  return { ancestors, target: targetNode };
}
