import { supabase } from "@/integrations/supabase/client";
import { resolveBountyByLegacyItem } from "@/lib/bounty/resolveLegacy";
import { createLegacyBountyHeader } from "./createLegacyBountyHeader";
import { notifyMetaBountySubSpawned } from "@/lib/notifications/triggers";

interface PledgeArgs {
  metaBountyId: string;
  subBountyIndex: number;
  pledgerId: string;
  amount: number;
  currency?: string;
  isAnonymous?: boolean;
  note?: string | null;
}

export async function pledgeToSubBounty({
  metaBountyId,
  subBountyIndex,
  pledgerId,
  amount,
  currency = "GBP",
  isAnonymous = false,
  note,
}: PledgeArgs): Promise<{ pledgeId: string }> {
  if (amount <= 0) throw new Error("Pledge amount must be positive");

  const { data: meta, error: mErr } = await (supabase as any)
    .from("content_items")
    .select("id, creator_id, bounty_is_meta, title")
    .eq("id", metaBountyId)
    .single();
  if (mErr) throw mErr;
  if (!(meta as any).bounty_is_meta) throw new Error("Not a meta-bounty");

  // NS-P50. `metaBountyId` is a content_items id; meta_bounty_sub_definitions
  // .meta_bounty_id has been a public.bounties id since NS-P48, so the route's
  // id is resolved to the header it names. `spawned_bounty_id` is read for
  // truthiness only ("has this one spawned yet"), which the repoint did not
  // change.
  const metaRowId = await resolveBountyByLegacyItem(metaBountyId);
  const { data: subs, error: subErr } = await (supabase as any)
    .from("meta_bounty_sub_definitions")
    .select(
      "id, title, description, target_amount, spawn_threshold_pct, spawned_bounty_id, position, meta_bounty_id",
    )
    .eq("meta_bounty_id", metaRowId)
    .order("position", { ascending: true });
  if (subErr) throw subErr;
  const sub = ((subs ?? []) as any[])[subBountyIndex];
  if (!sub) throw new Error("Sub-bounty index out of range");

  const { data: pledge, error: pErr } = await (supabase as any)
    .from("meta_bounty_pledges")
    .insert({
      meta_bounty_id: metaBountyId,
      sub_definition_id: sub.id,
      pledger_id: pledgerId,
      amount,
      currency,
      is_anonymous: isAnonymous,
      note: note ?? null,
    } as any)
    .select("id")
    .single();
  if (pErr) throw pErr;
  const pledgeId = (pledge as any).id as string;

  // Recompute pledged total for this sub
  const { data: subPledges } = await (supabase as any)
    .from("meta_bounty_pledges")
    .select("amount, pledger_id")
    .eq("sub_definition_id", sub.id)
    .neq("status", "refunded");
  const pledgedTotal = ((subPledges ?? []) as any[]).reduce(
    (s, p) => s + Number(p.amount ?? 0),
    0,
  );

  const thresholdAmount =
    (Number(sub.target_amount) * Number(sub.spawn_threshold_pct)) / 100;
  const shouldSpawn =
    !sub.spawned_bounty_id && pledgedTotal >= thresholdAmount;

  if (shouldSpawn) {
    const { data: newBounty, error: spawnErr } = await (supabase as any)
      .from("content_items")
      .insert({
        creator_id: (meta as any).creator_id,
        title: sub.title,
        description: sub.description ?? null,
        content_type: "Workflow Template",
        post_type: "bounty",
        status: "approved",
        visibility: "public",
        difficulty: "Any",
        monetisation_type: "free",
        bounty_status: "open",
        bounty_meta_parent_id: metaBountyId,
        bounty_reward_amount: pledgedTotal,
        bounty_reward_type: "cash",
        bounty_reward_currency: currency,
        bounty_acceptance_criteria: sub.description ?? null,
        approved_at: new Date().toISOString(),
      } as any)
      .select("id")
      .single();
    if (spawnErr) throw spawnErr;

    const spawnedId = (newBounty as any).id as string;

    // NS-P48 shim (removed in NS-P50). spawned_bounty_id is a public.bounties
    // id now, and the content item created above has no header yet — so the
    // spawned bounty gets one, carrying the pledged total as its reward and
    // naming the meta's header as its parent, which is the shape NS-P45's
    // backfill gives every other legacy bounty.
    const spawnedHeaderId = await createLegacyBountyHeader({
      legacyItemId: spawnedId,
      authorId: meta.creator_id as string,
      rewardGbp: currency === "GBP" ? pledgedTotal : null,
      metaParentId: (sub.meta_bounty_id as string) ?? null,
    });

    await (supabase as any)
      .from("meta_bounty_sub_definitions")
      .update({ spawned_bounty_id: spawnedHeaderId } as any)
      .eq("id", sub.id);

    // Notify pledgers using the canonical 'meta_bounty_sub_spawned' subkind.
    // `spawnedId`, not `spawnedHeaderId`: a notification target is a route, and
    // this one routes to /content/:id.
    const pledgerIds = Array.from(
      new Set<string>(((subPledges ?? []) as any[]).map((p) => p.pledger_id)),
    );
    void notifyMetaBountySubSpawned({
      metaBountyId,
      spawnedBountyId: spawnedId,
      subDefinitionId: sub.id,
      subTitle: sub.title,
      pledgerIds,
    });
  }

  return { pledgeId };
}
