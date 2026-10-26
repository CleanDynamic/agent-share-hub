// SV-03 P6: the page the address names is started the moment the route matches, not when its code has arrived.
//
// Placed once inside the router. On every address change, and when the session says who is asking, it opens the page's chunk
// and starts its first reads (warmPath). The page's own queries then find them on their way and ask for nothing again. It
// also starts the idle loader, which waits for the first page-ready mark.

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { clearKeptCache, setKeptCacheUser } from "@/lib/query/persist";

import { startIdleLoad } from "./idleLoad";
import { warmPath } from "./warm";

export function RouteWarmup() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  useEffect(() => {
    // Until the session is known the reader is not known: their reads wait (the chunk does not, it is the same for everyone).
    if (loading) {
      warmPath(pathname, queryClient, null);
      return;
    }
    warmPath(pathname, queryClient, userId);
  }, [pathname, loading, userId, queryClient]);

  /* What is kept across a reload belongs to one reader: sign out, or a different reader, forgets it (and what is in memory). */
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (previous.current !== null && previous.current !== userId) {
      void clearKeptCache();
      queryClient.clear();
    }
    previous.current = userId;
    setKeptCacheUser(userId);
  }, [loading, userId, queryClient]);

  useEffect(() => startIdleLoad(() => Boolean(userId)), [userId]);

  return null;
}
