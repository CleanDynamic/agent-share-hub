import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveBountyByLegacyItem } from "@/lib/bounty/resolveLegacy";

/**
 * WHY BOTH HOOKS RESOLVE BEFORE THEY SUBSCRIBE (NS-P50).
 *
 * A postgres_changes filter is one column comparison evaluated by the
 * replication stream. It cannot join, so a legacy page that holds a
 * content_items id has to have the public.bounties id in hand before it opens
 * the channel — until NS-P50 the derived shim column carried the old id on the
 * row instead, and the filter named that.
 *
 * The resolve is awaited inside the effect and its result is discarded if the
 * effect is torn down first, which is why `cancelled` exists: a page navigated
 * away from during the round trip must not leave a channel nobody removes.
 */
export function useBountyDiscussionUpdates(
  bountyId: string | null | undefined,
  callback: (payload: any) => void,
) {
  useEffect(() => {
    if (!bountyId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      let bountyRowId: string;
      try {
        bountyRowId = await resolveBountyByLegacyItem(bountyId);
      } catch (e) {
        console.warn("[useBountyDiscussionUpdates] no bounties header", e);
        return;
      }
      if (cancelled) return;
      channel = supabase
        .channel(`bounty_discussion:${bountyRowId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes" as any,
          {
            event: "*",
            schema: "public",
            table: "bounty_discussion_comments",
            filter: `bounty_id=eq.${bountyRowId}`,
          },
          callback,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [bountyId, callback]);
}

export function useBountySolutionUpdates(
  bountyId: string | null | undefined,
  callback: (payload: any) => void,
) {
  useEffect(() => {
    if (!bountyId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      let bountyRowId: string;
      try {
        bountyRowId = await resolveBountyByLegacyItem(bountyId);
      } catch (e) {
        console.warn("[useBountySolutionUpdates] no bounties header", e);
        return;
      }
      if (cancelled) return;
      channel = supabase
        .channel(`bounty_solutions:${bountyRowId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes" as any,
          {
            event: "*",
            schema: "public",
            table: "solutions",
            filter: `bounty_id=eq.${bountyRowId}`,
          },
          callback,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [bountyId, callback]);
}
