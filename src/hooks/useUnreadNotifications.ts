import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToNewNotifications } from "@/lib/notifications/realtime";

export function useUnreadNotifications() {
  const { isLoggedIn, user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isLoggedIn || !user) { setCount(0); return; }
    const { count: c } = await supabase
      .from("notifications" as any)
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    setCount(c ?? 0);
  }, [isLoggedIn, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh on window focus
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [refresh]);

  // Live updates: bump on insert, re-sync on any change.
  useEffect(() => {
    if (!user?.id) return;
    const unsubInsert = subscribeToNewNotifications(user.id, () => {
      setCount((c) => c + 1);
    });

    const channel = supabase
      .channel(`notifications-read:${user.id}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          // A row was marked read (or otherwise updated) — re-sync.
          refresh();
        }
      )
      .subscribe();

    return () => {
      unsubInsert();
      try { supabase.removeChannel(channel); } catch { /* noop */ }
    };
  }, [user?.id, refresh]);

  const display = count > 9 ? "9+" : count > 0 ? String(count) : null;

  return { count, display, refresh };
}
