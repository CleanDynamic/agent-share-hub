import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useBountyDiscussionUpdates(
  bountyId: string | null | undefined,
  callback: (payload: any) => void,
) {
  useEffect(() => {
    if (!bountyId) return;
    const channel = supabase
      .channel(`bounty_discussion:${bountyId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "bounty_discussion_comments",
          // NS-P47 shim (removed in NS-P50): bountyId is a content_items id and
          // bounty_discussion_comments.bounty_id is a public.bounties id. A
          // postgres_changes filter is one column comparison evaluated by the
          // replication stream and cannot join, so the live thread reads the
          // shim column like every other legacy read does.
          filter: `legacy_bounty_item_id=eq.${bountyId}`,
        },
        callback,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bountyId, callback]);
}

export function useBountySolutionUpdates(
  bountyId: string | null | undefined,
  callback: (payload: any) => void,
) {
  useEffect(() => {
    if (!bountyId) return;
    const channel = supabase
      .channel(`bounty_solutions:${bountyId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "solutions",
          // NS-P46 shim (removed in NS-P50): bountyId is a content_items id and
          // solutions.bounty_id is a public.bounties id, so the live filter
          // reads the shim column like every other legacy read does.
          filter: `legacy_bounty_item_id=eq.${bountyId}`,
        },
        callback,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bountyId, callback]);
}
