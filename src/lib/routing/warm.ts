// SV-03 P6: open a page's code and start its first reads, once while they are fresh.
//
// `warmPath("/drafts", queryClient, userId)` is what a hover, a focus, a touch, the route itself (RouteWarmup) and the idle
// loader all call. The same address for the same reader is started once per FRESH_MS; after that a call starts it again.

import type { QueryClient } from "@tanstack/react-query";

import { loadEntry } from "./go";
import { matchRoute, type RouteEntry } from "./routeTable";

export const FRESH_MS = 30_000;

const started = new Map<string, number>();

/** Forget what was started: for tests, and for a reader who signs out (what was read for them is not theirs to keep). */
export function resetWarm(): void {
  started.clear();
}

function pathOf(href: string): string | null {
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return null;
  }
}

export interface WarmResult {
  entry: RouteEntry;
  /** What was started now; false when it had been started and is still fresh. */
  started: boolean;
}

/** Start the page behind `href`: its chunk, and its first-screen reads when the reader can have them. */
export function warmPath(href: string, queryClient: QueryClient, userId: string | null, now = Date.now()): WarmResult | null {
  const pathname = pathOf(href);
  if (pathname === null) return null;
  const match = matchRoute(pathname);
  if (!match) return null;

  const key = `${pathname}|${userId ?? ""}`;
  const last = started.get(key);
  if (last !== undefined && now - last < FRESH_MS) return { entry: match.entry, started: false };
  started.set(key, now);

  void loadEntry(match.entry.key, match.entry.load).catch(() => started.delete(key));
  if (!match.entry.signedIn || userId) {
    void Promise.resolve(match.entry.prefetch(match.params, queryClient, { userId })).catch(() => undefined);
  }
  return { entry: match.entry, started: true };
}
