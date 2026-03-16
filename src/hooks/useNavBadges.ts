import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const LS_KEY_SAVED = "neoscale_last_saved_visit";
const LS_KEY_FYP = "neoscale_last_fyp_visit";

export function useNavBadges() {
  const { isLoggedIn, user } = useAuth();
  const location = useLocation();
  const [hasUnseenSaves, setHasUnseenSaves] = useState(false);
  const [fypCount, setFypCount] = useState(0);

  // Mark /saved visited
  useEffect(() => {
    if (location.pathname === "/saved" && isLoggedIn) {
      localStorage.setItem(LS_KEY_SAVED, new Date().toISOString());
      setHasUnseenSaves(false);
    }
  }, [location.pathname, isLoggedIn]);

  // Mark /fyp visited
  useEffect(() => {
    if (location.pathname === "/fyp" && isLoggedIn) {
      localStorage.setItem(LS_KEY_FYP, new Date().toISOString());
      setFypCount(0);
    }
  }, [location.pathname, isLoggedIn]);

  // Check unseen saves
  useEffect(() => {
    if (!isLoggedIn || !user) return;
    const lastVisit = localStorage.getItem(LS_KEY_SAVED);

    const query = supabase
      .from("user_saves")
      .select("saved_at")
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false })
      .limit(1);

    query.then(({ data }) => {
      if (data && data.length > 0) {
        const mostRecent = data[0].saved_at;
        if (!lastVisit || new Date(mostRecent) > new Date(lastVisit)) {
          setHasUnseenSaves(true);
        }
      }
    });
  }, [isLoggedIn, user]);

  // Check FYP activity count
  useEffect(() => {
    if (!isLoggedIn || !user) return;
    const lastVisit = localStorage.getItem(LS_KEY_FYP) || "1970-01-01T00:00:00Z";

    // Get followed user IDs first
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .then(({ data: follows }) => {
        if (!follows || follows.length === 0) return;
        const followingIds = follows.map((f) => f.following_id);

        supabase
          .from("user_interactions")
          .select("id", { count: "exact", head: true })
          .in("user_id", followingIds)
          .in("interaction_type", ["downloaded", "rated", "commented", "bookmarked"])
          .gt("created_at", lastVisit)
          .then(({ count }) => {
            setFypCount(count ?? 0);
          });
      });
  }, [isLoggedIn, user]);

  return { hasUnseenSaves, fypCount };
}
