import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { NotificationRow } from "./types";

/**
 * Subscribe to inserts on the notifications table for the given user.
 * Returns a cleanup function so consumers can also call this imperatively.
 */
export function subscribeToNewNotifications(
  userId: string,
  callback: (n: NotificationRow) => void
): () => void {
  if (!userId) return () => {};
  // Random suffix to avoid channel name collisions across hot-reloads / tabs.
  const channelName = `notifications:${userId}:${crypto.randomUUID()}`;
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as NotificationRow);
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      /* noop */
    }
  };
}

export function useNewNotifications(
  userId: string | null | undefined,
  callback: (n: NotificationRow) => void
): void {
  useEffect(() => {
    if (!userId) return;
    return subscribeToNewNotifications(userId, callback);
  }, [userId, callback]);
}
