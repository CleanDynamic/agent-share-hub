import { supabase } from "@/integrations/supabase/client";
import {
  resolveBountyByLegacyItem,
  resolveLegacyItemsByBounty,
} from "@/lib/bounty/resolveLegacy";
import type { MetaState, SubBountyState } from "./types";

export async function getMetaBountyState(
  metaBountyId: string,
): Promise<MetaState> {
  const { data: bounty, error } = await (supabase as any)
    .from("content_items")
    .select(
      "id, title, description, bounty_status, bounty_deadline, bounty_is_meta",
    )
    .eq("id", metaBountyId)
    .single();
  if (error) throw error;
  if (!(bounty as any).bounty_is_meta) {
    throw new Error("Not a meta-bounty");
  }

  // NS-P50. `metaBountyId` is the content_items id /content/:id routes on;
  // meta_bounty_sub_definitions.meta_bounty_id has been a public.bounties id
  // since NS-P48. meta_bounty_pledges was NOT repointed — its meta_bounty_id is
  // still the content_items id — so the two reads below take different ids on
  // purpose.
  const metaRowId = await resolveBountyByLegacyItem(metaBountyId);

  const [{ data: subs }, { data: pledges }] = await Promise.all([
    (supabase as any)
      .from("meta_bounty_sub_definitions")
      .select(
        "id, title, description, target_amount, spawn_threshold_pct, spawned_bounty_id, position",
      )
      .eq("meta_bounty_id", metaRowId)
      .order("position", { ascending: true }),
    (supabase as any)
      .from("meta_bounty_pledges")
      .select("amount, pledger_id, sub_definition_id, status")
      .eq("meta_bounty_id", metaBountyId)
      .neq("status", "refunded"),
  ]);

  // spawned_bounty_id is a public.bounties id too, and MetaBountyBody navigates
  // to /content/:id with what this returns, so each one is mapped back to the
  // content_items id its header names. One read for the whole page's spawns.
  const spawnedIds = ((subs ?? []) as any[])
    .map((s) => s.spawned_bounty_id)
    .filter(Boolean) as string[];
  const spawnedLegacyIds = spawnedIds.length
    ? await resolveLegacyItemsByBounty(spawnedIds)
    : new Map<string, string | null>();

  const subBounties: SubBountyState[] = ((subs ?? []) as any[]).map((s) => {
    const matching = ((pledges ?? []) as any[]).filter(
      (p) => p.sub_definition_id === s.id,
    );
    const pledgedAmount = matching.reduce(
      (sum, p) => sum + Number(p.amount ?? 0),
      0,
    );
    const pledgerCount = new Set(matching.map((p) => p.pledger_id)).size;
    return {
      id: s.id,
      title: s.title,
      description: s.description ?? null,
      targetAmount: Number(s.target_amount),
      spawnThresholdPct: Number(s.spawn_threshold_pct),
      pledgedAmount,
      pledgerCount,
      spawnedBountyId: s.spawned_bounty_id
        ? (spawnedLegacyIds.get(s.spawned_bounty_id) ?? null)
        : null,
      position: s.position ?? 0,
    };
  });

  const totalPledged = ((pledges ?? []) as any[]).reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0,
  );
  const totalPledgers = new Set(
    ((pledges ?? []) as any[]).map((p) => p.pledger_id),
  ).size;

  return {
    bountyId: metaBountyId,
    title: (bounty as any).title,
    description: (bounty as any).description ?? null,
    status: (bounty as any).bounty_status ?? null,
    fundingDeadline: (bounty as any).bounty_deadline ?? null,
    totalPledged,
    totalPledgers,
    subBounties,
  };
}
