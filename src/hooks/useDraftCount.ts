import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useDraftCount() {
  const { isLoggedIn, user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn || !user) { setCount(0); return; }
    supabase
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("status", "draft")
      .then(({ count: c }) => setCount(c ?? 0));
  }, [isLoggedIn, user]);

  const display = count > 0 ? (count > 9 ? "9+" : String(count)) : null;
  return { count, display };
}
