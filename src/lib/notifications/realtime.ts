import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { NotificationRow } from "./types";

/**
 * UI-P35a — whether the channel is delivering. `live` once the server has
 * accepted the subscription; `offline` when it has closed, errored or timed out
 * (the client keeps rejoining on its own, and reports `live` again when it
 * does); `connecting` before the first answer.
 */
export type NotificationChannelStatus = "connecting" | "live" | "offline";

/**
 * Subscribe to inserts on the notifications table for the given user.
 * Returns a cleanup function so consumers can also call this imperatively.
 * `onStatus`, when given, hears every change in the channel's state.
 */
export function subscribeToNewNotifications(
  userId: string,
  callback: (n: NotificationRow) => void,
  onStatus?: (status: NotificationChannelStatus) => void
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
    .subscribe((status) => {
      onStatus?.(status === "SUBSCRIBED" ? "live" : "offline");
    });

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

/**
 * UI-P35a — `useNewNotifications`, saying whether the channel is live.
 *
 * The callback is read through a ref, so a new function on every render does
 * not tear the channel down and join it again; only a new user does.
 */
export function useNotificationChannel(
  userId: string | null | undefined,
  callback: (n: NotificationRow) => void
): NotificationChannelStatus {
  const [status, setStatus] = useState<NotificationChannelStatus>("connecting");
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(() => {
    if (!userId) {
      setStatus("offline");
      return;
    }
    // A channel being removed reports CLOSED on its way out; that is not news.
    let active = true;
    setStatus("connecting");
    const stop = subscribeToNewNotifications(
      userId,
      (row) => latest.current(row),
      (next) => {
        if (active) setStatus(next);
      }
    );
    return () => {
      active = false;
      stop();
    };
  }, [userId]);

  return status;
}
