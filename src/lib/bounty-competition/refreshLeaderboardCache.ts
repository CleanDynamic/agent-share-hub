import { supabase } from "@/integrations/supabase/client";
import { notifyBountySolverOvertaken } from "@/lib/notifications/triggers";

interface SolverAgg {
  user_id: string;
  submission_count: number;
  vote_total: number;
  acceptance_count: number;
}

/**
 * Recompute the solver leaderboard for a bounty and persist to
 * solver_leaderboard_cache. Aggregates over current `solutions` rows
 * (status='submitted' or 'accepted' only — drafts excluded).
 *
 * Ranking: vote_total DESC, then acceptance_count DESC,
 *          then submission_count DESC, then earliest submission.
 */
export async function refreshLeaderboardCache(
  bountyId: string,
): Promise<void> {
  const { data: rows, error } = await (supabase as any)
    .from("solutions")
    .select("solver_id, vote_count, status, submitted_at")
    .eq("bounty_id", bountyId)
    .in("status", ["submitted", "accepted"]);
  if (error) throw error;

  const aggMap = new Map<string, SolverAgg & { earliest: string }>();
  for (const r of (rows ?? []) as any[]) {
    const k = r.solver_id as string;
    const cur = aggMap.get(k) ?? {
      user_id: k,
      submission_count: 0,
      vote_total: 0,
      acceptance_count: 0,
      earliest: r.submitted_at ?? new Date().toISOString(),
    };
    cur.submission_count += 1;
    cur.vote_total += Number(r.vote_count ?? 0);
    if (r.status === "accepted") cur.acceptance_count += 1;
    if (r.submitted_at && r.submitted_at < cur.earliest) {
      cur.earliest = r.submitted_at;
    }
    aggMap.set(k, cur);
  }

  const sorted = [...aggMap.values()].sort((a, b) => {
    if (b.vote_total !== a.vote_total) return b.vote_total - a.vote_total;
    if (b.acceptance_count !== a.acceptance_count)
      return b.acceptance_count - a.acceptance_count;
    if (b.submission_count !== a.submission_count)
      return b.submission_count - a.submission_count;
    return a.earliest.localeCompare(b.earliest);
  });

  const computedAt = new Date().toISOString();
  const upserts = sorted.map((s, i) => ({
    bounty_id: bountyId,
    user_id: s.user_id,
    rank: i + 1,
    submission_count: s.submission_count,
    vote_total: s.vote_total,
    acceptance_count: s.acceptance_count,
    computed_at: computedAt,
  }));

  // Snapshot the existing ranks so we can detect overtakes after the rewrite.
  const { data: prevRows } = await (supabase as any)
    .from("solver_leaderboard_cache")
    .select("user_id, rank")
    .eq("bounty_id", bountyId);
  const prevRankByUser = new Map<string, number>();
  for (const r of (prevRows ?? []) as any[]) {
    prevRankByUser.set(r.user_id as string, Number(r.rank));
  }

  // Wipe + reinsert keeps ranks consistent and removes stale rows.
  const { error: delErr } = await (supabase as any)
    .from("solver_leaderboard_cache")
    .delete()
    .eq("bounty_id", bountyId);
  if (delErr) throw delErr;

  if (upserts.length > 0) {
    const { error: insErr } = await (supabase as any)
      .from("solver_leaderboard_cache")
      .insert(upserts as any);
    if (insErr) throw insErr;
  }

  // Fire 'bounty_solver_overtaken' for each solver whose rank slipped (i.e.
  // somebody above them is now newly above them). For each demoted solver we
  // pick the solver who took their old rank as the actor.
  const newRankByUser = new Map<string, number>();
  for (const u of upserts) newRankByUser.set(u.user_id, u.rank);

  const userByNewRank = new Map<number, string>();
  for (const [uid, r] of newRankByUser) userByNewRank.set(r, uid);

  for (const [userId, newRank] of newRankByUser) {
    const prevRank = prevRankByUser.get(userId);
    if (prevRank === undefined) continue;
    if (newRank > prevRank) {
      const actor = userByNewRank.get(prevRank);
      if (actor && actor !== userId) {
        notifyBountySolverOvertaken({
          bountyId,
          overtakenSolverId: userId,
          overtakingSolverId: actor,
          previousRank: prevRank,
          newRank,
        });
      }
    }
  }
}
