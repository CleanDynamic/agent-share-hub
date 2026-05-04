import { supabase } from "@/integrations/supabase/client";

type ReviewState = "shortlisted" | "rejected" | "noted";

interface MarkArgs {
  bountyId: string;
  solutionId: string;
  authorId: string;
  status: ReviewState;
  notes?: string | null;
}

/**
 * Upsert a private author-only review entry for a solution.
 * Unique key: (solution_id, author_id).
 */
export async function markSolutionReviewStatus({
  bountyId,
  solutionId,
  authorId,
  status,
  notes,
}: MarkArgs): Promise<void> {
  const { error } = await (supabase as any)
    .from("bounty_author_review")
    .upsert(
      {
        bounty_id: bountyId,
        solution_id: solutionId,
        author_id: authorId,
        state: status,
        private_note: notes ?? null,
      } as any,
      { onConflict: "solution_id,author_id" },
    );
  if (error) throw error;
}
