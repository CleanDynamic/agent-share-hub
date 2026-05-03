import { supabase } from "@/integrations/supabase/client";
import type { Solution } from "./types";

export async function updateSolutionDraft(
  solutionId: string,
  patch: { contentPayload?: any; solverNote?: string | null },
): Promise<Solution> {
  const payload: Record<string, any> = {};
  if (patch.contentPayload !== undefined) payload.content_payload = patch.contentPayload;
  if (patch.solverNote !== undefined) payload.solver_note = patch.solverNote;
  const { data, error } = await (supabase as any)
    .from("solutions")
    .update(payload as any)
    .eq("id", solutionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Solution;
}
