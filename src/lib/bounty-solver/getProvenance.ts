import { supabase } from "@/integrations/supabase/client";
import type { SolverProfile } from "./types";

export interface ProvenanceEntry {
  user: SolverProfile | null;
  slotKind: "stage" | "block";
  slotId: string;
  slotName: string | null;
  acceptedAt: string;
}

export async function getProvenance(bountyId: string): Promise<{
  bountyAuthor: SolverProfile | null;
  acceptedSolvers: ProvenanceEntry[];
}> {
  const { data: bounty } = await (supabase as any)
    .from("content_items")
    .select("creator_id, stage_grids")
    .eq("id", bountyId)
    .maybeSingle();

  let bountyAuthor: SolverProfile | null = null;
  if (bounty?.creator_id) {
    const { data: a } = await (supabase as any)
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_trusted_solver")
      .eq("id", bounty.creator_id)
      .maybeSingle();
    bountyAuthor = (a as SolverProfile) ?? null;
  }

  const { data: log } = await (supabase as any)
    .from("solution_acceptance_log")
    .select("solver_id, slot_kind, slot_id, accepted_at")
    .eq("bounty_id", bountyId)
    .order("accepted_at", { ascending: true });

  const rows = (log ?? []) as any[];
  if (rows.length === 0) return { bountyAuthor, acceptedSolvers: [] };

  const solverIds = Array.from(new Set(rows.map((r) => r.solver_id)));
  const { data: profs } = await (supabase as any)
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_trusted_solver")
    .in("id", solverIds);
  const profileMap = new Map<string, SolverProfile>();
  for (const p of (profs ?? []) as SolverProfile[]) profileMap.set(p.id, p);

  const grids = (bounty?.stage_grids ?? {}) as any;
  const stages = grids.stages ?? {};
  const blocks = grids.blocks ?? {};

  const acceptedSolvers: ProvenanceEntry[] = rows.map((r) => {
    const slot = r.slot_kind === "stage" ? stages[r.slot_id] : blocks[r.slot_id];
    return {
      user: profileMap.get(r.solver_id) ?? null,
      slotKind: r.slot_kind,
      slotId: r.slot_id,
      slotName:
        slot?.stage_name ??
        slot?.name ??
        slot?.title ??
        null,
      acceptedAt: r.accepted_at,
    };
  });

  return { bountyAuthor, acceptedSolvers };
}
