import { supabase } from "@/integrations/supabase/client";
import type { VoteKind } from "./types";

export async function voteOnSolution(args: {
  solutionId: string;
  voterId: string;
  voteKind: VoteKind;
}): Promise<{ voted: boolean; newCount: number }> {
  const { solutionId, voterId, voteKind } = args;

  const { data: existing } = await (supabase as any)
    .from("solution_votes")
    .select("id")
    .eq("solution_id", solutionId)
    .eq("voter_id", voterId)
    .eq("vote_kind", voteKind)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await (supabase as any)
      .from("solution_votes")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await (supabase as any)
      .from("solution_votes")
      .insert({
        solution_id: solutionId,
        voter_id: voterId,
        vote_kind: voteKind,
      } as any);
    if (error) throw error;
  }

  // Read back the fresh count from solutions (trigger updates it).
  const { data: sol } = await (supabase as any)
    .from("solutions")
    .select("vote_count, i_would_implement_count")
    .eq("id", solutionId)
    .single();
  const newCount =
    voteKind === "upvote"
      ? ((sol as any)?.vote_count ?? 0)
      : ((sol as any)?.i_would_implement_count ?? 0);
  return { voted: !existing?.id, newCount };
}
