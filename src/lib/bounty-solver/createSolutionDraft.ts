import { supabase } from "@/integrations/supabase/client";
import type { Solution, SlotKind } from "./types";

export async function createSolutionDraft(args: {
  bountyId: string;
  slotKind: SlotKind;
  slotId: string;
  solverId: string;
}): Promise<Solution> {
  const { bountyId, slotKind, slotId, solverId } = args;

  // Return existing draft if one already exists.
  const { data: existing } = await (supabase as any)
    .from("solutions")
    .select("*")
    .eq("legacy_bounty_item_id", bountyId) // NS-P46 shim (removed in NS-P50)
    .eq("slot_id", slotId)
    .eq("solver_id", solverId)
    .eq("status", "draft")
    .maybeSingle();
  if (existing) return existing as Solution;

  // NS-P46 shim (removed in NS-P50). bountyId is the content_items id in the
  // legacy bounty page's route; solutions.bounty_id is a public.bounties id.
  // The read above goes through the shim column, but an INSERT has to supply
  // the real thing, so the header row is resolved here. Every legacy bounty has
  // one — the NS-P45 backfill wrote one per content_items bounty — and a bounty
  // that somehow has none is a broken write, not a silent no-op.
  const { data: header, error: headerErr } = await (supabase as any)
    .from("bounties")
    .select("id")
    .eq("legacy_item_id", bountyId)
    .maybeSingle();
  if (headerErr) throw headerErr;
  const bountyRowId = (header as { id?: string } | null)?.id;
  if (!bountyRowId) {
    throw new Error("This bounty has no bounties record, so a solution cannot be filed against it");
  }

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
