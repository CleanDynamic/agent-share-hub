import { supabase } from "@/integrations/supabase/client";
import { resolveBountyRowId } from "@/lib/bounty-solver/resolveBountyRowId";

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
  // NS-P47 shim (removed in NS-P50). bounty_author_review.bounty_id is a
  // public.bounties id. The conflict target is (solution_id, author_id) and is
  // unaffected; the column being written is not.
  const bountyRowId = await resolveBountyRowId(bountyId);

  const { error } = await (supabase as any)
    .from("bounty_author_review")
    .upsert(
      {
        bounty_id: bountyRowId,
        solution_id: solutionId,
        author_id: authorId,
        state: status,
        private_note: notes ?? null,
      } as any,
      { onConflict: "solution_id,author_id" },
    );
  if (error) throw error;
}
