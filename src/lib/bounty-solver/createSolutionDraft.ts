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
    .eq("bounty_id", bountyId)
    .eq("slot_id", slotId)
    .eq("solver_id", solverId)
    .eq("status", "draft")
    .maybeSingle();
  if (existing) return existing as Solution;

  const { data, error } = await (supabase as any)
    .from("solutions")
    .insert({
      bounty_id: bountyId,
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
