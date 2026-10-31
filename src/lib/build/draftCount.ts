// The nav badge's draft count, apart from sessions.ts so the always-loaded header
// does not pull the whole sessions layer into the first download (SV-26).

import { supabase } from "@/integrations/supabase/client";
import { buildLayerError } from "./types";

/**
 * How many drafts the signed-in creator has, for the nav badge.
 *
 * A head request: it returns a count and no rows. The count is exact rather
 * than estimated because it is filtered to one creator's drafts, where the
 * planner's estimate is a guess that is visibly wrong at the sizes a badge
 * shows; the (creator_id, status) set it counts is a handful of rows.
 */
export async function countDraftBuilds(): Promise<number> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw buildLayerError("countDraftBuilds (session)", sessionError);
  const creatorId = data.session?.user?.id;
  if (!creatorId) return 0;

  const { count, error } = await supabase
    .from("builds")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("status", "draft");
  if (error) throw buildLayerError("countDraftBuilds", error);
  return count ?? 0;
}
