import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tracks the current user's online presence via dm_presence.
 * - Sets is_online = true on focus / visibility
 * - Sets is_online = false on blur / hidden
 * - Heartbeat every 60s to keep last_seen_at fresh
 */
export function usePresence() {
  const { isLoggedIn, user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!isLoggedIn || !user) return;

    const upsertPresence = async (online: boolean) => {
      await supabase.from("dm_presence").upsert(
        { user_id: user.id, is_online: online, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    };

    const handleFocus = () => upsertPresence(true);
    const handleBlur = () => upsertPresence(false);
    const handleVisibility = () => upsertPresence(!document.hidden);

    // Initial presence
    upsertPresence(!document.hidden);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);

    // Heartbeat
    intervalRef.current = setInterval(() => {
      if (!document.hidden) {
        upsertPresence(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(intervalRef.current);
      // Mark offline on unmount
      upsertPresence(false);
    };
  }, [isLoggedIn, user]);
}
