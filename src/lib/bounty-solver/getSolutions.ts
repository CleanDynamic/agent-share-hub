import { supabase } from "@/integrations/supabase/client";
import type { Solution, SolutionWithMeta, SolutionsSort, SolverProfile } from "./types";

export async function getSolutions(args: {
  bountyId: string;
  slotId?: string | "all";
  sort?: SolutionsSort;
  viewerId?: string | null;
}): Promise<{ solutions: SolutionWithMeta[]; total: number }> {
  const { bountyId, slotId = "all", sort = "most_votes", viewerId } = args;

  let q = (supabase as any)
    .from("solutions")
    .select("*")
    .eq("bounty_id", bountyId)
    .in("status", ["submitted", "accepted"]);
  if (slotId && slotId !== "all") q = q.eq("slot_id", slotId);
  if (sort === "mine" && viewerId) q = q.eq("solver_id", viewerId);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Solution[];
  if (rows.length === 0) return { solutions: [], total: 0 };

  const solverIds = Array.from(new Set(rows.map((r) => r.solver_id)));
  const ids = rows.map((r) => r.id);

  const [profilesRes, votesRes, commentsRes] = await Promise.all([
    (supabase as any)
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_trusted_solver")
      .in("id", solverIds),
    viewerId
      ? (supabase as any)
          .from("solution_votes")
          .select("solution_id, vote_kind")
          .eq("voter_id", viewerId)
          .in("solution_id", ids)
      : Promise.resolve({ data: [] }),
    (supabase as any)
      .from("solution_comments")
      .select("solution_id")
      .in("solution_id", ids),
  ]);

  const profileMap = new Map<string, SolverProfile>();
  for (const p of (profilesRes.data ?? []) as SolverProfile[]) profileMap.set(p.id, p);

  const voteSet = new Set<string>(); // `${solutionId}::${kind}`
  for (const v of (votesRes.data ?? []) as any[]) {
    voteSet.add(`${v.solution_id}::${v.vote_kind}`);
  }

  const commentCounts = new Map<string, number>();
  for (const c of (commentsRes.data ?? []) as any[]) {
    commentCounts.set(c.solution_id, (commentCounts.get(c.solution_id) ?? 0) + 1);
  }

  const enriched: SolutionWithMeta[] = rows.map((r) => ({
    ...r,
    solver: profileMap.get(r.solver_id) ?? null,
    hasVoted: voteSet.has(`${r.id}::upvote`),
    hasIWouldImplement: voteSet.has(`${r.id}::i_would_implement`),
    commentCount: commentCounts.get(r.id) ?? 0,
  }));

  enriched.sort((a, b) => {
    if (sort === "newest") return b.created_at.localeCompare(a.created_at);
    if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
    if (sort === "mine") return b.created_at.localeCompare(a.created_at);
    // most_votes
    if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
    return b.created_at.localeCompare(a.created_at);
  });

  return { solutions: enriched, total: enriched.length };
}
