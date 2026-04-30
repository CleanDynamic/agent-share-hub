import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fires `callback(payload)` whenever a new message is inserted into the
 * given thread. Renders nothing — pure subscription hook.
 */
export function useNewMessages(
  threadId: string | null | undefined,
  callback: (payload: any) => void
): void {
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`messages-thread-${threadId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, callback]);
}

/**
 * Fires `callback(payload)` whenever ANY message is inserted in a thread
 * the current user belongs to. Used to refresh the thread list.
 *
 * RLS on dm_messages already restricts SELECTs to thread members, so we
 * subscribe to all INSERTs on the table and rely on RLS filtering.
 */
export function useThreadListUpdates(callback: (payload: any) => void): void {
  useEffect(() => {
    const channel = supabase
      .channel(`thread-list-updates-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages" },
        (payload) => callback(payload.new)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "dm_threads" },
        (payload) => callback(payload.new)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [callback]);
}
