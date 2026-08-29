import { supabase } from "@/integrations/supabase/client";
import { resolveBountyByLegacyItem } from "@/lib/bounty/resolveLegacy";
import type {
  BountyCommentReactionSummary,
  DiscussionFilter,
  DiscussionSort,
  SolverProfile,
  ThreadedBountyComment,
} from "./types";

export async function getDiscussionThread(args: {
  bountyId: string;
  filter?: DiscussionFilter;
  sort?: DiscussionSort;
  viewerId?: string | null;
}): Promise<{
  comments: ThreadedBountyComment[];
  totalRoots: number;
  activeParticipants: number;
}> {
  const { bountyId, filter = "all", sort = "newest", viewerId } = args;

  // NS-P50. `bountyId` is the content_items id in the legacy bounty page's
  // route; every table read below keys on public.bounties. One resolve, reused
  // by the thread read, the read mark and the accepted-solver lookup.
  const bountyRowId = await resolveBountyByLegacyItem(bountyId);

  const { data: rows, error } = await (supabase as any)
    .from("bounty_discussion_comments")
    .select("*")
    .eq("bounty_id", bountyRowId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const flat = (rows ?? []) as any[];
  if (flat.length === 0) {
    return { comments: [], totalRoots: 0, activeParticipants: 0 };
  }

  const ids = flat.map((r) => r.id);
  const authorIds = Array.from(new Set(flat.map((r) => r.author_id)));

  const [bountyRes, authorsRes, reactionsRes, lastReadRes, acceptedSolversRes] =
    await Promise.all([
      (supabase as any)
        .from("content_items")
        .select("creator_id")
        .eq("id", bountyId)
        .maybeSingle(),
      (supabase as any)
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_trusted_solver")
        .in("id", authorIds),
      (supabase as any)
        .from("bounty_comment_reactions")
        .select("comment_id, reactor_id, reaction")
        .in("comment_id", ids),
      viewerId
        ? (supabase as any)
            .from("bounty_comment_last_read")
            .select("last_read_at")
            .eq("bounty_id", bountyRowId)
            .eq("user_id", viewerId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // This one named bounty_id already and was handed the content_items id,
      // so it has matched nothing since NS-P46 and every comment has rendered
      // without its "accepted solver" mark. The resolve is what fixes it.
      (supabase as any)
        .from("solutions")
        .select("solver_id")
        .eq("bounty_id", bountyRowId)
        .eq("status", "accepted"),
    ]);

  const bountyAuthorId = (bountyRes as any).data?.creator_id ?? null;
  const acceptedSolverIds = new Set<string>(
    ((acceptedSolversRes as any).data ?? []).map((r: any) => r.solver_id),
  );

  const profileMap = new Map<string, SolverProfile>();
  for (const p of (authorsRes.data ?? []) as SolverProfile[]) profileMap.set(p.id, p);

  const reactionGroups = new Map<string, Map<string, { count: number; mine: boolean }>>();
  for (const r of (reactionsRes.data ?? []) as any[]) {
    if (!reactionGroups.has(r.comment_id)) reactionGroups.set(r.comment_id, new Map());
    const inner = reactionGroups.get(r.comment_id)!;
    const cur = inner.get(r.reaction) ?? { count: 0, mine: false };
    cur.count += 1;
    if (viewerId && r.reactor_id === viewerId) cur.mine = true;
    inner.set(r.reaction, cur);
  }
  const reactionMap = new Map<string, BountyCommentReactionSummary[]>();
  for (const [cid, inner] of reactionGroups.entries()) {
    reactionMap.set(
      cid,
      Array.from(inner.entries()).map(([reaction, v]) => ({
        reaction,
        count: v.count,
        reactedByViewer: v.mine,
      })),
    );
  }

  const lastReadAt = (lastReadRes as any).data?.last_read_at
    ? new Date((lastReadRes as any).data.last_read_at).getTime()
    : 0;

  const nodeMap = new Map<string, ThreadedBountyComment>();
  for (const r of flat) {
    nodeMap.set(r.id, {
      id: r.id,
      bounty_id: r.bounty_id,
      parent_comment_id: r.parent_comment_id,
      author: profileMap.get(r.author_id) ?? null,
      body: r.body,
      taggedBountyAuthor: !!r.tagged_bounty_author,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      reactions: reactionMap.get(r.id) ?? [],
      replies: [],
      isUnread:
        !!viewerId &&
        r.author_id !== viewerId &&
        new Date(r.created_at).getTime() > lastReadAt,
      isFromBountyAuthor: r.author_id === bountyAuthorId,
      isFromAcceptedSolver: acceptedSolverIds.has(r.author_id),
    });
  }
  const roots: ThreadedBountyComment[] = [];
  for (const node of nodeMap.values()) {
    if (node.parent_comment_id && nodeMap.has(node.parent_comment_id)) {
      nodeMap.get(node.parent_comment_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  let filtered = roots;
  if (filter === "from_author") {
    filtered = roots.filter((r) => r.isFromBountyAuthor);
  } else if (filter === "from_solvers") {
    filtered = roots.filter((r) => r.isFromAcceptedSolver);
  } else if (filter === "mentions" && viewerId) {
    const handle = profileMap.get(viewerId)?.username;
    filtered = roots.filter(
      (r) =>
        r.taggedBountyAuthor ||
        (handle && r.body.toLowerCase().includes(`@${handle.toLowerCase()}`)),
    );
  } else if (filter === "unread") {
    filtered = roots.filter((r) => r.isUnread);
  }

  filtered.sort((a, b) => {
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (sort === "most_reactions") {
      const sa = a.reactions.reduce((s, r) => s + r.count, 0);
      const sb = b.reactions.reduce((s, r) => s + r.count, 0);
      if (sb !== sa) return sb - sa;
      return b.createdAt.localeCompare(a.createdAt);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  const activeParticipants = new Set(flat.map((r) => r.author_id)).size;

  return { comments: filtered, totalRoots: roots.length, activeParticipants };
}
