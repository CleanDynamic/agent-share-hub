import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** CA-10 (CA-09 F10): how long the page's state must hold before it is written. */
export const PRESENCE_SETTLE_MS = 1_000;

/**
 * Tracks the current user's online presence via dm_presence.
 * - Online while the tab is visible and focused, offline when it is hidden or blurred
 * - Heartbeat every 60s to keep last_seen_at fresh
 *
 * CA-10 (CA-09 F10): ONE WRITE PER REAL CHANGE. Focus, blur and visibilitychange arrive together when a phone comes
 * back to the browser, and the auth client hands out a new `user` object on every auth event, so this used to write
 * four or five times on each return. Now the effect is keyed by the user's id, the events only say what the state
 * should be, and the state is written once it has held for PRESENCE_SETTLE_MS, and only if it differs from the last
 * one written.
 */
export function usePresence() {
  const { isLoggedIn, user } = useAuth();
  const userId = user?.id ?? null;
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    let written: boolean | null = null;
    let settle: ReturnType<typeof setTimeout> | undefined;

    const upsertPresence = async (online: boolean) => {
      written = online;
      await supabase.from("dm_presence").upsert(
        { user_id: userId, is_online: online, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    };

    const want = (online: boolean) => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        if (online !== written) void upsertPresence(online);
      }, PRESENCE_SETTLE_MS);
    };

    const handleFocus = () => want(!document.hidden);
    const handleBlur = () => want(false);
    const handleVisibility = () => want(!document.hidden);

    // Initial presence
    void upsertPresence(!document.hidden);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);

    // Heartbeat
    intervalRef.current = setInterval(() => {
      if (!document.hidden) {
        void upsertPresence(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(intervalRef.current);
      clearTimeout(settle);
      // Mark offline on unmount
      void upsertPresence(false);
    };
  }, [isLoggedIn, userId]);
}
