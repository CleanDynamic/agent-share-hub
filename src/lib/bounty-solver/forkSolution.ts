import { supabase } from "@/integrations/supabase/client";
import type { Solution } from "./types";

/**
 * Fork an accepted/submitted solution into a new draft blueprint owned by
 * the forker. Stores the snapshot in the new draft's stage_grids and links
 * lineage via `forked_from_solution_id`.
 */
export async function forkSolution(args: {
  solutionId: string;
  forkerId: string;
}): Promise<{ newDraftId: string }> {
  const { solutionId, forkerId } = args;

  const { data: sol, error } = await (supabase as any)
    .from("solutions")
    .select("*")
    .eq("id", solutionId)
    .single();
  if (error) throw error;
  const solution = sol as Solution;

  // NS-P46 shim (removed in NS-P50): solution.bounty_id is a public.bounties id,
  // so the title comes from the legacy content item it was filed against.
  const legacyBountyItemId = solution.legacy_bounty_item_id;
  const { data: bounty } = legacyBountyItemId
    ? await (supabase as any)
        .from("content_items")
        .select("title")
        .eq("id", legacyBountyItemId)
        .maybeSingle()
    : { data: null };

  const grids: any = { stages: {}, blocks: {} };
  if (solution.slot_kind === "stage") {
    grids.stages[solution.slot_id] = solution.content_payload;
  } else {
    grids.blocks[solution.slot_id] = solution.content_payload;
  }

  const { data: created, error: insErr } = await (supabase as any)
    .from("content_items")
    .insert({
      creator_id: forkerId,
      title: `Fork of solution: ${(bounty as any)?.title ?? "Untitled"}`,
      content_type: "blueprint",
      post_type: "blueprint",
      difficulty: "intermediate",
      status: "draft",
      stage_grids: grids,
      forked_from_solution_id: solutionId,
    } as any)
    .select("id")
    .single();
  if (insErr) throw insErr;
  return { newDraftId: (created as any).id };
}
