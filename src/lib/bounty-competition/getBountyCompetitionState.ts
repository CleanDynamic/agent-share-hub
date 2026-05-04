import { supabase } from "@/integrations/supabase/client";
import type { CompState, UrgencyState } from "./types";
import { getLeaderboard } from "./getLeaderboard";

function urgencyFromMs(ms: number | null, status: string | null): UrgencyState {
  if (status === "solved" || status === "closed") return "closed";
  if (ms == null) return "plenty";
  if (ms <= 0) return "closed";
  const day = 24 * 60 * 60 * 1000;
  if (ms < 2 * day) return "urgent";
  if (ms < 7 * day) return "warning";
  return "plenty";
}

export async function getBountyCompetitionState(
  bountyId: string,
): Promise<CompState> {
  const { data: bounty, error } = await (supabase as any)
    .from("content_items")
    .select(
      "id, bounty_total_submissions, bounty_active_solvers, comment_count, bounty_total_slots, bounty_solved_count, bounty_deadline, bounty_status, bounty_health_score, bounty_is_meta",
    )
    .eq("id", bountyId)
    .single();
  if (error) throw error;

  const deadline = (bounty as any).bounty_deadline as string | null;
  const timeRemainingMs = deadline
    ? new Date(deadline).getTime() - Date.now()
    : null;

  const leaderboardPreview = await getLeaderboard({
    bountyId,
    sort: "rank",
    limit: 5,
    offset: 0,
  }).catch(() => []);

  return {
    bountyId,
    submissionCount: (bounty as any).bounty_total_submissions ?? 0,
    activeSolverCount: (bounty as any).bounty_active_solvers ?? 0,
    commentCount: (bounty as any).comment_count ?? 0,
    slotsTotal: (bounty as any).bounty_total_slots ?? 0,
    slotsSolved: (bounty as any).bounty_solved_count ?? 0,
    deadline,
    timeRemainingMs,
    urgencyState: urgencyFromMs(timeRemainingMs, (bounty as any).bounty_status),
    leaderboardPreview,
    healthScore: (bounty as any).bounty_health_score ?? null,
    isMeta: !!(bounty as any).bounty_is_meta,
  };
}
