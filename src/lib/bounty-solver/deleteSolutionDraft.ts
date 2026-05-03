import { supabase } from "@/integrations/supabase/client";

export async function deleteSolutionDraft(solutionId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("solutions")
    .delete()
    .eq("id", solutionId)
    .eq("status", "draft");
  if (error) throw error;
}
