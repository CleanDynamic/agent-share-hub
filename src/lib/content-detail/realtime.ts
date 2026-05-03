import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AnchorType } from "./types";

/**
 * Subscribes to primitive_comments changes for an anchor.
 * The callback receives the raw payload — caller decides how to refetch/merge.
 */
export function useCommentsRealtime(
  anchorType: AnchorType,
  anchorId: string | null | undefined,
  callback: (payload: any) => void,
) {
  useEffect(() => {
    if (!anchorId) return;
    const channel = supabase
      .channel(`primitive_comments:${anchorType}:${anchorId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "primitive_comments",
          filter: `anchor_id=eq.${anchorId}`,
        },
        (payload: any) => {
          // Belt-and-braces filter on anchor_type (single filter param only).
          const row = payload.new ?? payload.old;
          if (row?.anchor_type === anchorType) callback(payload);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [anchorType, anchorId, callback]);
}
