import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Reblog } from "./types";

/**
 * Subscribe to engagement-count changes on a single reblog row.
 */
export function useReblogUpdates(
  reblogId: string | null | undefined,
  callback: (row: Reblog) => void
) {
  useEffect(() => {
    if (!reblogId) return;
    const channelName = `reblog-${reblogId}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "reblogs",
          filter: `id=eq.${reblogId}`,
        },
        (payload: any) => {
          if (payload?.new) callback(payload.new as Reblog);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reblogId, callback]);
}

/**
 * Subscribe to new reblogs targeting a specific original post.
 */
export function useReblogsOfPost(
  postId: string | null | undefined,
  callback: (row: Reblog) => void
) {
  useEffect(() => {
    if (!postId) return;
    const channelName = `reblogs-of-${postId}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "reblogs",
          filter: `original_post_id=eq.${postId}`,
        },
        (payload: any) => {
          if (payload?.new) callback(payload.new as Reblog);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, callback]);
}
