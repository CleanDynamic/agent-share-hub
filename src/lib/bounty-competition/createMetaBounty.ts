import { supabase } from "@/integrations/supabase/client";
import { assertLegacyBountyCreateEnabled } from "@/lib/bounty-legacy/flags";
import { createLegacyBountyHeader } from "./createLegacyBountyHeader";
import type { SubBountyDefinitionInput } from "./types";

interface CreateMetaArgs {
  authorId: string;
  title: string;
  description?: string | null;
  themeTags?: string[];
  subBountyDefinitions: SubBountyDefinitionInput[];
  fundingDeadline?: string | null;
  contributionRules?: string | null;
}

/**
 * FROZEN BY NS-P54. Calling this throws BOUNTY_RETIRED.
 *
 * This is legacy bounty creation with an umbrella on top: it inserts an
 * APPROVED `content_items` row with `post_type = 'bounty'` and
 * `bounty_is_meta`, attaches a legacy `bounties` header to it, and files
 * sub-definitions against that header. NS-P54 stops the last writers of that
 * shape, and a meta-bounty is one.
 *
 * NOTHING CALLED IT. Measured before the freeze: the only references outside
 * this file are the barrel re-export in ./index.ts and the NS-P50 spec. No
 * component, page or route reaches it — the picker's meta-bounty card lands on
 * `/upload?type=meta-bounty`, which re-opens the picker, and never here. So no
 * affordance had to be removed alongside this gate, and nothing a reader can do
 * changes.
 *
 * WHAT IS NOT FROZEN. Every read of a meta-bounty that already exists, and the
 * pledge and spawn path on it — `getMetaBountyState`, the home
 * ActiveCompetitions strip, the legacy meta page and `pledgeToSubBounty`, whose
 * spawn branch still writes a `content_items` row when a threshold is crossed.
 * That branch is NS-P49's, it hangs off an existing meta-bounty rather than
 * creating one, and freezing it here would break a live surface this prompt is
 * told not to touch.
 *
 * The body below is left whole. Deleting it is NS-P55's; unfreezing it is one
 * flag in src/lib/bounty-legacy/flags.ts.
 */
export async function createMetaBounty({
  authorId,
  title,
  description,
  themeTags,
  subBountyDefinitions,
  fundingDeadline,
  contributionRules,
}: CreateMetaArgs): Promise<{ metaBountyId: string }> {
  assertLegacyBountyCreateEnabled();

  if (!subBountyDefinitions.length) {
    throw new Error("Meta-bounty requires at least one sub-bounty definition");
  }

  const { data: created, error } = await (supabase as any)
    .from("content_items")
    .insert({
      creator_id: authorId,
      title,
      description: description ?? null,
      content_type: "Workflow Template",
      post_type: "bounty",
      status: "approved",
      visibility: "public",
      difficulty: "Any",
      monetisation_type: "free",
      bounty_is_meta: true,
      bounty_status: "open",
      bounty_deadline: fundingDeadline ?? null,
      bounty_acceptance_criteria: contributionRules ?? null,
      custom_tags: themeTags ?? [],
      tags: themeTags ?? [],
      approved_at: new Date().toISOString(),
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  const metaBountyId = (created as any).id as string;

  // NS-P48 shim (removed in NS-P50). meta_bounty_sub_definitions.meta_bounty_id
  // is a public.bounties id now, and a brand-new content item has no header —
  // NS-P45 backfilled the ones that existed and nothing writes them since. The
  // sub-definitions below are filed against this header, not against the
  // content item, and the freeze installed by NS-P48 admits them because it is
  // a LEGACY header (legacy_item_id is set).
  const metaHeaderId = await createLegacyBountyHeader({
    legacyItemId: metaBountyId,
    authorId,
    isMeta: true,
    closesAt: fundingDeadline ?? null,
  });

  const subRows = subBountyDefinitions.map((s, i) => ({
    meta_bounty_id: metaHeaderId,
    title: s.title,
    description: s.description ?? null,
    target_amount: s.targetAmount,
    spawn_threshold_pct: s.spawnThresholdPct ?? 100,
    position: i,
  }));
  const { error: subErr } = await (supabase as any)
    .from("meta_bounty_sub_definitions")
    .insert(subRows as any);
  if (subErr) throw subErr;

  return { metaBountyId };
}
