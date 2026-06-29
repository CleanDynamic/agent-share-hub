import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Drives the one-time WelcomeXpModal. Checks user_progress.welcome_xp_shown_at
 * after authentication and opens the modal if the flag is null. Dismissal
 * persists the flag server-side via mark_welcome_xp_shown RPC — never
 * localStorage.
 */
export function useWelcomeXp() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading || !user || checked) return;
    let cancelled = false;

    (async () => {
      const { data } = await (supabase as any)
        .from("user_progress")
        .select("welcome_xp_shown_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data && data.welcome_xp_shown_at == null) {
        setOpen(true);
      }
      setChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, checked]);

  const dismiss = async () => {
    setOpen(false);
    try {
      await (supabase as any).rpc("mark_welcome_xp_shown");
    } catch {
      // best-effort — server may already have stamped it
    }
  };

  return { open, dismiss };
}
