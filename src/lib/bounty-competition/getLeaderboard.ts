import { supabase } from "@/integrations/supabase/client";
import type { LeaderboardEntry, LeaderboardSort } from "./types";
import { refreshLeaderboardCache } from "./refreshLeaderboardCache";

const STALE_MS = 5 * 60 * 1000;

interface GetLeaderboardArgs {
  bountyId: string;
  sort?: LeaderboardSort;
  limit?: number;
  offset?: number;
}

export async function getLeaderboard({
  bountyId,
  sort = "rank",
  limit = 25,
  offset = 0,
}: GetLeaderboardArgs): Promise<LeaderboardEntry[]> {
  // Stale check on most-recent computed_at
  const { data: meta } = await (supabase as any)
    .from("solver_leaderboard_cache")
    .select("computed_at")
    .eq("bounty_id", bountyId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const computedAt = (meta as any)?.computed_at as string | undefined;
  const isStale =
    !computedAt || Date.now() - new Date(computedAt).getTime() > STALE_MS;
  if (isStale) {
    try {
      await refreshLeaderboardCache(bountyId);
    } catch (e) {
      console.warn("[getLeaderboard] inline refresh failed", e);
    }
  }

  const orderColumn =
    sort === "votes"
      ? "vote_total"
      : sort === "submissions"
        ? "submission_count"
        : sort === "acceptances"
          ? "acceptance_count"
          : sort === "recent"
            ? "computed_at"
            : "rank";
  const ascending = sort === "rank";

  const { data: rows, error } = await (supabase as any)
    .from("solver_leaderboard_cache")
    .select(
      "user_id, rank, vote_total, submission_count, acceptance_count, computed_at",
    )
    .eq("bounty_id", bountyId)
    .order(orderColumn, { ascending })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const entries = (rows ?? []) as any[];
  const userIds = entries.map((r) => r.user_id);
  if (userIds.length === 0) return [];

  const [{ data: profiles }, { data: drafts }] = await Promise.all([
    (supabase as any)
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_trusted_solver")
      .in("id", userIds),
    (supabase as any)
      .from("solutions")
      .select("solver_id")
      .eq("bounty_id", bountyId)
      .eq("status", "draft")
      .in("solver_id", userIds),
  ]);

  const profileMap = new Map<string, any>(
    (profiles ?? []).map((p: any) => [p.id, p]),
  );
  const draftSet = new Set<string>(
    (drafts ?? []).map((d: any) => d.solver_id),
  );

  return entries.map((r) => ({
    userId: r.user_id,
    rank: r.rank,
    voteTotal: r.vote_total,
    submissionCount: r.submission_count,
    acceptanceCount: r.acceptance_count,
    computedAt: r.computed_at,
    hasActiveDraft: draftSet.has(r.user_id),
    profile: profileMap.has(r.user_id)
      ? {
          id: r.user_id,
          username: profileMap.get(r.user_id).username ?? null,
          displayName: profileMap.get(r.user_id).display_name ?? null,
          avatarUrl: profileMap.get(r.user_id).avatar_url ?? null,
          isTrustedSolver: !!profileMap.get(r.user_id).is_trusted_solver,
        }
      : null,
  }));
}
