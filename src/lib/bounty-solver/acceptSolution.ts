import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications/createNotification";
import { recomputeMetadata } from "@/lib/metadata/recomputeMetadata";
import type { Solution } from "./types";

/**
 * Accept a solution. Performs the multi-step merge sequentially in the
 * client (no SECURITY DEFINER RPC yet); each step is best-effort but logged
 * loudly on failure. Idempotency: if the slot is already accepted, throws.
 */
export async function acceptSolution(args: {
  solutionId: string;
  accepterId: string;
}): Promise<void> {
  const { solutionId, accepterId } = args;

  // 1. Load solution + bounty.
  const { data: sol, error: sErr } = await (supabase as any)
    .from("solutions")
    .select("*")
    .eq("id", solutionId)
    .single();
  if (sErr) throw sErr;
  const solution = sol as Solution;

  // NS-P46 shim (removed in NS-P50). solution.bounty_id is a public.bounties id
  // now; everything below that reads or writes content_items — the stage_grids
  // merge, the solved counters, the notification target, the metadata
  // recompute — needs the legacy id instead. This function IS the legacy
  // acceptance path: a bounty that lives on a build has no legacy item and no
  // stage_grids to merge into, and belongs to NS-P50's rewrite, not here.
  const legacyBountyItemId = solution.legacy_bounty_item_id;
  if (!legacyBountyItemId) {
    throw new Error("This solution is not on a legacy bounty; acceptance for build bounties arrives in NS-P50");
  }

  const { data: bounty, error: bErr } = await (supabase as any)
    .from("content_items")
    .select(
      "id, creator_id, stage_grids, bounty_solved_count, bounty_total_slots, bounty_reward_amount, bounty_reward_type",
    )
    .eq("id", legacyBountyItemId)
    .single();
  if (bErr) throw bErr;
  if (bounty.creator_id !== accepterId) {
    throw new Error("Only the bounty author can accept a solution");
  }

  // 2. Slot must not already be accepted.
  const { data: alreadyAccepted } = await (supabase as any)
    .from("solutions")
    .select("id")
    .eq("bounty_id", solution.bounty_id)
    .eq("slot_id", solution.slot_id)
    .eq("status", "accepted")
    .maybeSingle();
  if (alreadyAccepted?.id) {
    throw new Error("This slot already has an accepted solution");
  }

  // 3a. Mark solution accepted.
  const acceptedAt = new Date().toISOString();
  const { error: updErr } = await (supabase as any)
    .from("solutions")
    .update({ status: "accepted", accepted_at: acceptedAt } as any)
    .eq("id", solutionId);
  if (updErr) throw updErr;

  // 3b. Append to acceptance log. bounty_id is deliberately NOT shimmed here:
  // solution_acceptance_log.bounty_id points at public.bounties since NS-P46,
  // which is exactly what solution.bounty_id now holds. The log's own shim
  // column is derived by the database, not written by this insert.
  await (supabase as any).from("solution_acceptance_log").insert({
    solution_id: solutionId,
    bounty_id: solution.bounty_id,
    solver_id: solution.solver_id,
    bounty_author_id: bounty.creator_id,
    slot_kind: solution.slot_kind,
    slot_id: solution.slot_id,
    accepted_at: acceptedAt,
  } as any);

  // 3c. Merge content_payload back into stage_grids JSONB.
  const grids = (bounty.stage_grids ?? {}) as any;
  grids.stages = grids.stages ?? {};
  grids.blocks = grids.blocks ?? {};
  if (solution.slot_kind === "stage") {
    grids.stages[solution.slot_id] = {
      ...(grids.stages[solution.slot_id] ?? {}),
      ...(solution.content_payload ?? {}),
      is_missing: false,
    };
  } else {
    grids.blocks[solution.slot_id] = {
      ...(grids.blocks[solution.slot_id] ?? {}),
      ...(solution.content_payload ?? {}),
      is_missing: false,
    };
  }

  const newSolved = (bounty.bounty_solved_count ?? 0) + 1;
  const isFullySolved =
    bounty.bounty_total_slots > 0 && newSolved >= bounty.bounty_total_slots;
  await (supabase as any)
    .from("content_items")
    .update({
      stage_grids: grids,
      bounty_solved_count: newSolved,
      ...(isFullySolved ? { bounty_status: "solved" } : {}),
    } as any)
    .eq("id", legacyBountyItemId);

  // 3f. Notify solver.
  void createNotification({
    recipientId: solution.solver_id,
    actorId: accepterId,
    kind: "bounty_interaction",
    targetType: "bounty",
    targetId: legacyBountyItemId,
    metadata: {
      subkind: "solution_accepted",
      solution_id: solutionId,
      slot_id: solution.slot_id,
    },
  }).catch(() => {});

  // 3g–i. Update solver stats.
  void (async () => {
    try {
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select(
          "bounty_solutions_accepted, bounty_solutions_submitted, bounty_total_reward_earned",
        )
        .eq("id", solution.solver_id)
        .maybeSingle();
      const accepted = ((prof as any)?.bounty_solutions_accepted ?? 0) + 1;
      const submitted = (prof as any)?.bounty_solutions_submitted ?? 0;
      const rate = submitted > 0 ? accepted / submitted : null;
      const reward =
        bounty.bounty_reward_type === "cash" || bounty.bounty_reward_type === "token"
          ? Number(bounty.bounty_reward_amount ?? 0)
          : 0;
      const newReward =
        Number((prof as any)?.bounty_total_reward_earned ?? 0) + reward;
      await (supabase as any)
        .from("profiles")
        .update({
          bounty_solutions_accepted: accepted,
          bounty_solver_acceptance_rate: rate,
          is_trusted_solver: accepted >= 5 && (rate ?? 0) >= 0.6,
          bounty_total_reward_earned: newReward,
        } as any)
        .eq("id", solution.solver_id);
    } catch (e) {
      console.warn("[acceptSolution] solver stat update failed", e);
    }
  })();

  // 3j. Recompute metadata on bounty.
  void recomputeMetadata(legacyBountyItemId).catch(() => {});
}
