import { supabase } from "@/integrations/supabase/client";
import type { ActivityEvent } from "@/components/bounty-competition/SolverLeaderboard";

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  return `${dd}d ago`;
}

/**
 * Recent leaderboard activity: last submissions and acceptances for a bounty.
 * Returns at most `limit` events, newest first.
 */
export async function getLeaderboardActivity(
  bountyId: string,
  limit = 10,
): Promise<ActivityEvent[]> {
  const { data: solutions } = await (supabase as any)
    .from("solutions")
    .select("id, solver_id, slot_id, status, submitted_at, accepted_at, vote_count, created_at")
    .eq("bounty_id", bountyId)
    .order("created_at", { ascending: false })
    .limit(limit * 2);

  const rows = (solutions ?? []) as any[];
  const userIds = Array.from(new Set(rows.map((r) => r.solver_id).filter(Boolean)));
  let handleMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await (supabase as any)
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);
    handleMap = new Map(
      ((profs ?? []) as any[]).map((p) => [p.id, p.username || p.display_name || "user"]),
    );
  }

  const events: ActivityEvent[] = [];
  for (const r of rows) {
    const handle = handleMap.get(r.solver_id) || "user";
    if (r.accepted_at) {
      events.push({
        id: `acc-${r.id}`,
        type: "accepted",
        handle,
        timeAgo: timeAgo(r.accepted_at),
      });
    }
    if (r.submitted_at && r.status !== "draft") {
      events.push({
        id: `sub-${r.id}`,
        type: "submitted",
        handle,
        slotName: r.slot_id ? `#${String(r.slot_id).slice(0, 6)}` : "—",
        timeAgo: timeAgo(r.submitted_at),
      });
    }
    if ((r.vote_count ?? 0) > 0) {
      events.push({
        id: `vote-${r.id}`,
        type: "voted",
        handle,
        voteCount: r.vote_count,
        timeAgo: timeAgo(r.submitted_at || r.created_at),
      });
    }
  }

  events.sort((a, b) => {
    return 0;
  });
  return events.slice(0, limit);
}
