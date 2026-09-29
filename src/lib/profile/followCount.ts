// Whether a reader follows anyone (RC-P11).
//
// Home opens on Following for a signed-in reader who follows at least one
// maker, and on Everyone otherwise ⟦hicks-law › Remedies 2 Default⟧. That
// decision needs one number, so this is one HEAD request with no rows: the
// count of follows rows the reader holds. ESTIMATED, as this codebase prefers
// ⟦neoscale-code-review › Database⟧: PostgREST answers a count this small
// exactly anyway, and only "none or some" is read from it.

import { supabase } from "@/integrations/supabase/client";

/** How many makers `userId` follows. Identifiers only in the error. */
export async function countFollowing(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("follows")
    .select("following_id", { count: "estimated", head: true })
    .eq("follower_id", userId);

  if (error) {
    const code = "code" in error && error.code ? `code ${error.code}` : "no error code";
    throw new Error(`countFollowing failed: ${code}`);
  }
  return count ?? 0;
}
