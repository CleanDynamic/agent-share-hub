import { supabase } from "@/integrations/supabase/client";
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

export async function createMetaBounty({
  authorId,
  title,
  description,
  themeTags,
  subBountyDefinitions,
  fundingDeadline,
  contributionRules,
}: CreateMetaArgs): Promise<{ metaBountyId: string }> {
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
