import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to live leaderboard rank changes for a bounty.
 * Fires for any change to solver_leaderboard_cache OR solutions for the bounty.
 */
export function useLeaderboardUpdates(
  bountyId: string | null | undefined,
  callback: (payload: any) => void,
) {
  useEffect(() => {
    if (!bountyId) return;
    const channel = supabase
      .channel(`bounty_leaderboard:${bountyId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "solver_leaderboard_cache",
          filter: `bounty_id=eq.${bountyId}`,
        },
        callback,
      )
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
