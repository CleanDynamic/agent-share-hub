import { supabase } from "@/integrations/supabase/client";
import { resolveBountyByLegacyItem } from "@/lib/bounty/resolveLegacy";
import type { Solution, SlotKind } from "./types";

export async function createSolutionDraft(args: {
  bountyId: string;
  slotKind: SlotKind;
  slotId: string;
  solverId: string;
}): Promise<Solution> {
  const { bountyId, slotKind, slotId, solverId } = args;

  // NS-P50. `bountyId` is the content_items id in the legacy bounty page's
  // route; solutions.bounty_id has been a public.bounties id since NS-P46 and
  // the derived shim column that carried the old one is gone. Both the read and
  // the insert below run on the resolved header id, which is memoised for the
  // session, so the pair costs one extra round trip on the first read of a page
  // and none after it.
  const bountyRowId = await resolveBountyByLegacyItem(bountyId);

  // Return existing draft if one already exists.
  const { data: existing } = await (supabase as any)
    .from("solutions")
    .select("*")
    .eq("bounty_id", bountyRowId)
    .eq("slot_id", slotId)
    .eq("solver_id", solverId)
    .eq("status", "draft")
    .maybeSingle();
  if (existing) return existing as Solution;

  const { data, error } = await (supabase as any)
    .from("solutions")
    .insert({
      bounty_id: bountyRowId,
      slot_kind: slotKind,
      slot_id: slotId,
      solver_id: solverId,
      status: "draft",
      content_payload: {},
    } as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as Solution;
}
