/* UI-P16 — the `site_frame` flag.

   WHICH FRAME A ROUTE RENDERS IN: `FlatShell` (the frame that exists) or
   `SiteFrame` (the overhaul's frame, built beside it). The switch is one row of
   `feature_flags` — `key = 'site_frame'`, `enabled` — read once per page load
   and cached for the session. A missing row, a failed read and a signed-out
   reader with no access all mean OFF, so the legacy frame is what renders
   unless somebody turned the row on.

   THIS DOES NOT IMPORT FROM `src/lib/reblog`. `reblog/flags.ts` is a compile-time
   constant, not a reader, and that folder is legacy that UI-P41 deletes.

   DEV OVERRIDE. In a development build only, `?frame=site` or `?frame=flat`
   forces the answer for the browser session (sessionStorage, so it survives
   in-app navigation that drops the query). `import.meta.env.DEV` is the literal
   `false` in a production build, so the branch is eliminated and a visitor
   cannot flip the frame with a query string. */

import { useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";

/** The row in `feature_flags`. */
export const SITE_FRAME_FLAG_KEY = "site_frame";

/** sessionStorage key for the dev override. */
export const FRAME_OVERRIDE_KEY = "bg-frame";

type FrameOverride = "site" | "flat";

/* ── the cached table read ── */

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

/** Read the row once. Missing row, error or throw → false. */
export function loadSiteFrameFlag(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = (async () => {
    let on = false;
    try {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key, enabled")
        .eq("key", SITE_FRAME_FLAG_KEY)
        .limit(1);
      if (!error && Array.isArray(data) && data[0]) on = data[0].enabled === true;
    } catch {
      on = false;
    }
    cached = on;
    inflight = null;
    notify();
    return on;
  })();
  return inflight;
}

/* ── the dev override ── */

let memoryOverride: FrameOverride | null = null;

function readOverride(): FrameOverride | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  try {
    const asked = new URLSearchParams(window.location.search).get("frame");
    if (asked === "site" || asked === "flat") {
      memoryOverride = asked;
      try {
        window.sessionStorage.setItem(FRAME_OVERRIDE_KEY, asked);
      } catch {
        /* storage blocked: the in-memory copy carries the session */
      }
      return asked;
    }
  } catch {
    /* no location: fall through to storage */
  }
  try {
    const stored = window.sessionStorage.getItem(FRAME_OVERRIDE_KEY);
    if (stored === "site" || stored === "flat") return stored;
  } catch {
    /* storage blocked */
  }
  return memoryOverride;
}

/* ── the public reader ── */

/** Whether the site frame is on right now. Synchronous; false until the row has loaded. */
export function isSiteFrameOn(): boolean {
  const override = readOverride();
  if (override) return override === "site";
  return cached === true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Skipped when a dev override already decides the answer, so a dev session
  // with no backend makes no request.
  if (!readOverride()) void loadSiteFrameFlag();
  return () => {
    listeners.delete(listener);
  };
}

/** `isSiteFrameOn()` as a hook: re-renders when the row arrives. */
export function useSiteFrameFlag(): boolean {
  return useSyncExternalStore(subscribe, isSiteFrameOn, () => false);
}

/** Whether the answer is in: a dev override decides it, or the row has been read (or has failed to be). */
export function isSiteFrameKnown(): boolean {
  return readOverride() !== null || cached !== null;
}

/**
 * `isSiteFrameKnown()` as a hook. For a route that must not mount the wrong page
 * first: `isSiteFrameOn()` reads false until the row arrives, so a page that
 * spends a one-time token on mount would be mounted as the legacy page and then
 * again as the site page.
 */
export function useSiteFrameKnown(): boolean {
  return useSyncExternalStore(subscribe, isSiteFrameKnown, () => false);
}

/** Test seam: forget the cache and the override. */
export function resetSiteFrameFlag(): void {
  cached = null;
  inflight = null;
  memoryOverride = null;
  try {
    window.sessionStorage.removeItem(FRAME_OVERRIDE_KEY);
  } catch {
    /* nothing to clear */
  }
  notify();
}
