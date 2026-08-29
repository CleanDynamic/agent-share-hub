import { supabase } from "@/integrations/supabase/client";

interface LegacyHeaderArgs {
  /** The `content_items` row this header is for. */
  legacyItemId: string;
  /** Its creator. `bounties.author_id` is the backfilled copy of `content_items.creator_id`. */
  authorId: string;
  isMeta?: boolean;
  /** Cash reward in pounds, or null. NUMERIC on the column — never a float literal. */
  rewardGbp?: number | null;
  closesAt?: string | null;
  /** The `bounties.id` of the meta this one answers, for a spawned sub-bounty. */
  metaParentId?: string | null;
}

/**
 * NS-P48 shim (removed in NS-P50).
 *
 * NS-P45 backfilled one `public.bounties` header per `content_items` bounty
 * that existed the day it ran, and wired nothing to write one afterwards — the
 * forward path creates bounties on builds, and that path is NS-P50's. So a
 * legacy bounty created since NS-P45 has no header, and since NS-P48 a
 * sub-definition cannot be filed against a bounty that has none: both of its
 * foreign keys are `bounties(id)` now.
 *
 * The two legacy authoring paths that create a `content_items` bounty and then
 * write a sub-definition about it — `createMetaBounty` and the spawn branch of
 * `pledgeToSubBounty` — call this immediately afterwards, and use the id it
 * returns. NS-P45's INSERT policy on `bounties` is what makes that legal and is
 * written for exactly this window: the author of the content item, and only
 * them, may attach its header.
 *
 * NS-P50 rewires both callers onto builds and gap nodes and deletes this file.
 */
export async function createLegacyBountyHeader({
  legacyItemId,
  authorId,
  isMeta = false,
  rewardGbp = null,
  closesAt = null,
  metaParentId = null,
}: LegacyHeaderArgs): Promise<string> {
  const { data, error } = await supabase
    .from("bounties")
    .insert({
      legacy_item_id: legacyItemId,
      author_id: authorId,
      status: "open",
      is_meta: isMeta,
      reward_gbp: rewardGbp,
      closes_at: closesAt,
      meta_parent_id: metaParentId,
    })
    .select("id")
    .single();
  if (error) throw error;

  return (data as { id: string }).id;
}
