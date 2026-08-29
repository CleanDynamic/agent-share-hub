import { supabase } from "@/integrations/supabase/client";

/**
 * NS-P47 shim (removed in NS-P50).
 *
 * The legacy bounty page routes on a `content_items` id and hands it to every
 * caller in this module as `bountyId`. Since NS-P46 and NS-P47 the satellite
 * tables — `solutions`, `bounty_discussion_comments`,
 * `bounty_comment_last_read`, `bounty_deadline_extensions`,
 * `bounty_author_review` — hold a `public.bounties` id in `bounty_id` instead.
 *
 * READS do not come through here: each one filters the row's
 * `legacy_bounty_item_id` shim column, which the database derives from
 * `bounties.legacy_item_id` on every write, so a listing costs the same one
 * round trip it always did. A WRITE has to supply the real thing, and that is
 * what this resolves.
 *
 * Every legacy bounty has exactly one header — NS-P45's backfill wrote one per
 * `content_items` bounty and `idx_bounties_legacy_item_unique` keeps it that
 * way — so a bounty with none is a broken write, not a silent no-op, and this
 * throws rather than returning null.
 *
 * NS-P50 rewires these callers onto `bounties` directly and deletes this file
 * with the shim columns.
 */
export async function resolveBountyRowId(legacyItemId: string): Promise<string> {
  const { data, error } = await (supabase as any)
    .from("bounties")
    .select("id")
    .eq("legacy_item_id", legacyItemId)
    .maybeSingle();
  if (error) throw error;

  const bountyRowId = (data as { id?: string } | null)?.id;
  if (!bountyRowId) {
    throw new Error(
      "This bounty has no bounties record, so it cannot be written to",
    );
  }
  return bountyRowId;
}
