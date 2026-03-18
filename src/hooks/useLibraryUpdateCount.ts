import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useLibraryUpdateCount() {
  const { isLoggedIn, user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn || !user) {
      setCount(0);
      return;
    }
    supabase
      .from("user_library")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("has_update", true)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [isLoggedIn, user]);

  const display = count > 9 ? "9+" : count > 0 ? String(count) : null;
  return { count, display };
}
