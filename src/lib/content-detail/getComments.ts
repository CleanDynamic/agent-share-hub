import { supabase } from "@/integrations/supabase/client";
import type {
  AnchorType,
  AuthorInfo,
  CommentReactionSummary,
  ThreadedComment,
} from "./types";

export type CommentSort = "newest" | "oldest" | "top";

export async function getComments({
  anchorType,
  anchorId,
  sort = "newest",
  viewerId,
}: {
  anchorType: AnchorType;
  anchorId: string;
  sort?: CommentSort;
  viewerId?: string | null;
}): Promise<{ threads: ThreadedComment[]; total: number }> {
  // 1. Fetch all comments for the anchor (flat). We pull deleted rows too so
  //    we can render "[Comment deleted]" placeholders for deleted parents that
  //    still have visible children; standalone deleted leaves are filtered out
  //    after the tree is built.
  const { data: rows, error } = await (supabase as any)
    .from("primitive_comments")
    .select(
      "id, anchor_type, anchor_id, parent_comment_id, author_id, body, body_text, is_edited, created_at, updated_at, deleted_at, reply_count",
    )
    .eq("anchor_type", anchorType)
    .eq("anchor_id", anchorId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const flat = (rows ?? []) as any[];
  const ids = flat.map((r) => r.id);
  const authorIds = Array.from(new Set(flat.map((r) => r.author_id).filter(Boolean)));

  // 2. Fetch authors + reactions + viewer reading_progress in parallel.
  const [authorsRes, reactionsRes, progressRes] = await Promise.all([
    authorIds.length > 0
      ? (supabase as any)
          .from("profiles")
          .select("id, username, display_name, avatar_url, bio, derived_bio")
          .in("id", authorIds)
      : Promise.resolve({ data: [] }),
    ids.length > 0
      ? (supabase as any)
          .from("primitive_comment_reactions")
          .select("comment_id, reactor_id, reaction")
          .in("comment_id", ids)
      : Promise.resolve({ data: [] }),
    viewerId && anchorType === "post"
      ? (supabase as any)
          .from("reading_progress")
          .select("last_read_at")
          .eq("reader_id", viewerId)
          .eq("post_id", anchorId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const authorMap = new Map<string, AuthorInfo>();
  for (const a of (authorsRes.data ?? []) as AuthorInfo[]) authorMap.set(a.id, a);

  const reactionMap = new Map<string, CommentReactionSummary[]>();
  const grouped = new Map<string, Map<string, { count: number; mine: boolean }>>();
  for (const r of (reactionsRes.data ?? []) as any[]) {
    if (!grouped.has(r.comment_id)) grouped.set(r.comment_id, new Map());
    const inner = grouped.get(r.comment_id)!;
    const cur = inner.get(r.reaction) ?? { count: 0, mine: false };
    cur.count += 1;
    if (viewerId && r.reactor_id === viewerId) cur.mine = true;
    inner.set(r.reaction, cur);
  }
  for (const [cid, inner] of grouped.entries()) {
    reactionMap.set(
      cid,
      Array.from(inner.entries()).map(([reaction, v]) => ({
        reaction,
        count: v.count,
        reactedByViewer: v.mine,
      })),
    );
  }

  const lastReadAt = (progressRes as any).data?.last_read_at
    ? new Date((progressRes as any).data.last_read_at).getTime()
    : 0;

  // 3. Build the tree.
  const nodeMap = new Map<string, ThreadedComment>();
  for (const r of flat) {
    nodeMap.set(r.id, {
      id: r.id,
      anchor_type: r.anchor_type,
      anchor_id: r.anchor_id,
      parent_comment_id: r.parent_comment_id,
      author: authorMap.get(r.author_id) ?? null,
      body: r.body,
      bodyText: r.body_text ?? "",
      createdAt: r.created_at,
      isEdited: !!r.is_edited,
      reactions: reactionMap.get(r.id) ?? [],
      replies: [],
      isUnread:
        !!viewerId &&
        r.author_id !== viewerId &&
        new Date(r.created_at).getTime() > lastReadAt,
    });
  }
  const roots: ThreadedComment[] = [];
  for (const node of nodeMap.values()) {
    if (node.parent_comment_id && nodeMap.has(node.parent_comment_id)) {
      nodeMap.get(node.parent_comment_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  // 4. Sort.
  const sorter = (a: ThreadedComment, b: ThreadedComment) => {
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (sort === "top") {
      const sa = a.reactions.reduce((s, r) => s + r.count, 0);
      const sb = b.reactions.reduce((s, r) => s + r.count, 0);
      if (sb !== sa) return sb - sa;
      return b.createdAt.localeCompare(a.createdAt);
    }
    return b.createdAt.localeCompare(a.createdAt);
  };
  const sortDeep = (list: ThreadedComment[]) => {
    list.sort(sorter);
    list.forEach((n) => sortDeep(n.replies));
  };
  sortDeep(roots);

  return { threads: roots, total: flat.length };
}
