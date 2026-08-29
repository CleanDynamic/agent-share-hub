import { supabase } from "@/integrations/supabase/client";
import { resolveBountyByLegacyItem } from "@/lib/bounty/resolveLegacy";
import type { ActivityEvent, BountyAnalytics } from "./types";

export async function getBountyAnalytics(
  bountyId: string,
  viewerId: string,
): Promise<BountyAnalytics> {
  const { data: bounty, error: bErr } = await (supabase as any)
    .from("content_items")
    .select("id, creator_id, bounty_total_submissions")
    .eq("id", bountyId)
    .single();
  if (bErr) throw bErr;
  if ((bounty as any).creator_id !== viewerId) {
    throw new Error("Only the bounty author can view analytics");
  }

  // NS-P50: all four tables key on public.bounties, and this function is routed
  // on the content_items id. One resolve, four reads.
  const bountyRowId = await resolveBountyByLegacyItem(bountyId);

  const [{ data: solutions }, { data: comments }, { data: extensions }, { data: reviews }] =
    await Promise.all([
      (supabase as any)
        .from("solutions")
        .select(
          "id, solver_id, vote_count, status, submitted_at, accepted_at, slot_kind, slot_id, created_at",
        )
        .eq("bounty_id", bountyRowId),
      (supabase as any)
        .from("bounty_discussion_comments")
        .select("id, author_id, created_at")
        .eq("bounty_id", bountyRowId),
      (supabase as any)
        .from("bounty_deadline_extensions")
        .select("id, extended_by, new_deadline, created_at")
        .eq("bounty_id", bountyRowId),
      (supabase as any)
        .from("bounty_author_review")
        .select("solution_id, state")
        .eq("bounty_id", bountyRowId)
        .eq("author_id", viewerId),
    ]);

  const sols = (solutions ?? []) as any[];
  const cmts = (comments ?? []) as any[];
  const exts = (extensions ?? []) as any[];
  const reviewedIds = new Set<string>(
    ((reviews ?? []) as any[]).map((r) => r.solution_id),
  );

  const submitted = sols.filter(
    (s) => s.status === "submitted" || s.status === "accepted",
  );
  const accepted = sols.filter((s) => s.status === "accepted");
  const totalSubmissions = submitted.length;
  const acceptanceRate =
    totalSubmissions > 0 ? accepted.length / totalSubmissions : 0;
  const avgQuality =
    totalSubmissions > 0
      ? submitted.reduce((sum, s) => sum + Number(s.vote_count ?? 0), 0) /
        totalSubmissions
      : null;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const last7 = submitted.filter((s) => {
    const t = new Date(s.submitted_at ?? s.created_at).getTime();
    return now - t <= 7 * day;
  }).length;
  const prior7 = submitted.filter((s) => {
    const t = new Date(s.submitted_at ?? s.created_at).getTime();
    return now - t > 7 * day && now - t <= 14 * day;
  }).length;

  const promisingSubmissions = submitted
    .filter((s) => !reviewedIds.has(s.id) && s.status === "submitted")
    .sort((a, b) => Number(b.vote_count ?? 0) - Number(a.vote_count ?? 0))
    .slice(0, 5)
    .map((s) => ({
      solutionId: s.id,
      solverId: s.solver_id,
      voteCount: Number(s.vote_count ?? 0),
      submittedAt: s.submitted_at ?? null,
      slotKind: s.slot_kind,
      slotId: s.slot_id,
    }));

  const commenterCounts = new Map<string, number>();
  for (const c of cmts) {
    commenterCounts.set(
      c.author_id,
      (commenterCounts.get(c.author_id) ?? 0) + 1,
    );
  }
  const topCommenters = [...commenterCounts.entries()]
    .map(([userId, commentCount]) => ({ userId, commentCount }))
    .sort((a, b) => b.commentCount - a.commentCount)
    .slice(0, 5);

  const events: ActivityEvent[] = [];
  for (const s of sols) {
    if (s.submitted_at) {
      events.push({
        type: "submission",
        occurredAt: s.submitted_at,
        actorId: s.solver_id,
        metadata: { solution_id: s.id, slot_id: s.slot_id },
      });
    }
    if (s.accepted_at) {
      events.push({
        type: "acceptance",
        occurredAt: s.accepted_at,
        actorId: s.solver_id,
        metadata: { solution_id: s.id, slot_id: s.slot_id },
      });
    }
    if (s.status === "draft") {
      events.push({
        type: "draft_started",
        occurredAt: s.created_at,
        actorId: s.solver_id,
        metadata: { solution_id: s.id },
      });
    }
  }
  for (const c of cmts) {
    events.push({
      type: "comment",
      occurredAt: c.created_at,
      actorId: c.author_id,
      metadata: { comment_id: c.id },
    });
  }
  for (const e of exts) {
    events.push({
      type: "deadline_extended",
      occurredAt: e.created_at,
      actorId: e.extended_by,
      metadata: { new_deadline: e.new_deadline },
    });
  }
  events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return {
    bountyId,
    totalSubmissions,
    acceptanceRate,
    avgQuality,
    discussionEngagement: cmts.length,
    weekDeltaSubmissions: last7 - prior7,
    promisingSubmissions,
    topCommenters,
    activityTimeline: events.slice(0, 50),
  };
}
