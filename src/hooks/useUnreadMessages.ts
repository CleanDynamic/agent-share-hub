import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadMessages() {
  const { isLoggedIn, user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isLoggedIn || !user) { setCount(0); return; }
    const { count: c } = await supabase
      .from("messages" as any)
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    setCount(c ?? 0);
  }, [isLoggedIn, user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [refresh]);

  const display = count > 9 ? "9+" : count > 0 ? String(count) : null;

  return { count, display, refresh };
}
