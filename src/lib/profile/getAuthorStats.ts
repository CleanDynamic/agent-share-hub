import { supabase } from "@/integrations/supabase/client";
import type { AuthorStats, BlockTypeBreakdown } from "./types";

// Colour map mirrors the canonical block palette used elsewhere in the app.
// Falls back to muted for unknown types.
const BLOCK_COLOURS: Record<string, string> = {
  paragraph: "hsl(var(--muted-foreground))",
  heading: "hsl(var(--foreground))",
  code: "hsl(var(--accent))",
  image: "hsl(var(--primary))",
  prompt: "hsl(var(--primary))",
  quote: "hsl(var(--muted-foreground))",
  list: "hsl(var(--secondary-foreground))",
  table: "hsl(var(--accent))",
  file: "hsl(var(--secondary-foreground))",
};

function colourFor(type: string): string {
  return BLOCK_COLOURS[type] ?? "hsl(var(--muted))";
}

export async function getAuthorStats(userId: string): Promise<AuthorStats> {
  if (!userId) throw new Error("getAuthorStats: missing userId");

  // ── 1. profile_stats (matview) ───────────────────────────────────────────
  const { data: statsRow } = await (supabase as any)
    .from("profile_stats")
    .select(
      "total_views, blueprints_count, bounties_posted, bounties_solved, avg_reading_minutes"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const stats = statsRow ?? {};

  // ── 2. References received ───────────────────────────────────────────────
  // No `block_references` table exists; we approximate references as:
  //   (a) other content_items whose `blog_referenced_post_ids` array contains
  //       any of this user's content_items, plus
  //   (b) other content_items that are forks of this user's posts.
  const { data: ownPostIds } = await supabase
    .from("content_items")
    .select("id")
    .eq("creator_id", userId);
  const ownIds = (ownPostIds ?? []).map((r: { id: string }) => r.id);

  let referencesReceived = 0;
  if (ownIds.length > 0) {
    const [refRes, forkRes] = await Promise.all([
      supabase
        .from("content_items")
        .select("id", { count: "exact", head: true })
        .overlaps("blog_referenced_post_ids", ownIds),
      supabase
        .from("content_items")
        .select("id", { count: "exact", head: true })
        .in("fork_of_content_id", ownIds),
    ]);
    referencesReceived =
      (refRes.count ?? 0) + (forkRes.count ?? 0);
  }

  // ── 3. Block-type distribution ───────────────────────────────────────────
  let blockTypeDistribution: BlockTypeBreakdown[] = [];
  if (ownIds.length > 0) {
    const { data: blocks } = await supabase
      .from("content_blocks")
      .select("block_type")
      .in("content_id", ownIds);
    const counts = new Map<string, number>();
    for (const b of (blocks ?? []) as { block_type: string }[]) {
      counts.set(b.block_type, (counts.get(b.block_type) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
    blockTypeDistribution = Array.from(counts.entries())
      .map(([type, count]) => ({
        type,
        color: colourFor(type),
        count,
        percentage: Math.round((count / total) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // Bounty solver stats from profiles
  const { data: solverProf } = await (supabase as any)
    .from("profiles")
    .select(
      "bounty_solutions_accepted, bounty_solutions_submitted, bounty_solver_acceptance_rate, bounty_total_reward_earned, is_trusted_solver",
    )
    .eq("id", userId)
    .maybeSingle();
  const sp = (solverProf ?? {}) as any;

  return {
    totalViews: Number(stats.total_views ?? 0),
    blueprintsCount: Number(stats.blueprints_count ?? 0),
    referencesReceived,
    bountiesSolved: Number(stats.bounties_solved ?? 0),
    bountiesPosted: Number(stats.bounties_posted ?? 0),
    avgReadingMinutes: Number(stats.avg_reading_minutes ?? 0),
    blockTypeDistribution,
    bountySolutionsAccepted: Number(sp.bounty_solutions_accepted ?? 0),
    bountySolutionsSubmitted: Number(sp.bounty_solutions_submitted ?? 0),
    bountySolverAcceptanceRate:
      sp.bounty_solver_acceptance_rate == null
        ? null
        : Number(sp.bounty_solver_acceptance_rate),
    bountyTotalRewardEarned: Number(sp.bounty_total_reward_earned ?? 0),
    isTrustedSolver: !!sp.is_trusted_solver,
  };
}
