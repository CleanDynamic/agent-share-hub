import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadMessages() {
  const { isLoggedIn, user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isLoggedIn || !user) { setCount(0); return; }

    // Sum unread counts from dm_threads where user is a participant
    const { data, error } = await supabase
      .from("dm_threads")
      .select("participant_a, unread_count_a, unread_count_b")
      .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`);

    if (error || !data) { setCount(0); return; }

    let total = 0;
    for (const t of data as any[]) {
      total += t.participant_a === user.id ? (t.unread_count_a ?? 0) : (t.unread_count_b ?? 0);
    }
    setCount(total);
  }, [isLoggedIn, user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [refresh]);

  // Realtime: listen for thread updates
  useEffect(() => {
    if (!isLoggedIn || !user) return;
    const channel = supabase
      .channel("dm-unread-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_threads" },
        () => refresh()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isLoggedIn, user, refresh]);

  const display = count > 9 ? "9+" : count > 0 ? String(count) : null;

  return { count, display, refresh };
}
