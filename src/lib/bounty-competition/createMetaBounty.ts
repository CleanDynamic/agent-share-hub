import { supabase } from "@/integrations/supabase/client";
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

  const subRows = subBountyDefinitions.map((s, i) => ({
    meta_bounty_id: metaBountyId,
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
