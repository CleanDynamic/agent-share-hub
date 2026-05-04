import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications/createNotification";

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

  const { data: subs, error: subErr } = await (supabase as any)
    .from("meta_bounty_sub_definitions")
    .select(
      "id, title, description, target_amount, spawn_threshold_pct, spawned_bounty_id, position",
    )
    .eq("meta_bounty_id", metaBountyId)
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
    await (supabase as any)
      .from("meta_bounty_sub_definitions")
      .update({ spawned_bounty_id: spawnedId } as any)
      .eq("id", sub.id);

    // Notify pledgers
    const pledgerIds = new Set<string>(
      ((subPledges ?? []) as any[]).map((p) => p.pledger_id),
    );
    void Promise.all(
      [...pledgerIds].map((rid) =>
        createNotification({
          recipientId: rid,
          actorId: pledgerId,
          kind: "bounty_interaction",
          targetType: "bounty",
          targetId: spawnedId,
          metadata: {
            subkind: "sub_bounty_spawned",
            meta_bounty_id: metaBountyId,
            sub_definition_id: sub.id,
            pledged_total: pledgedTotal,
          },
        }).catch(() => null),
      ),
    );
  }

  return { pledgeId };
}
