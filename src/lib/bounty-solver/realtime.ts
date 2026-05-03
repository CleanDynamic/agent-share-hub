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
          filter: `bounty_id=eq.${bountyId}`,
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
          filter: `bounty_id=eq.${bountyId}`,
        },
        callback,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bountyId, callback]);
}
