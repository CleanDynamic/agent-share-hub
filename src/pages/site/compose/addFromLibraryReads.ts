/* SV-18: the window's reads, as query options, so the window and its preload ask for exactly the same thing. Not lazy: the
   composer imports this to start the reads on hover or focus of Add › From Library and at idle; the window itself is the chunk
   `loadAddFromLibrary` fetches. */

import type { QueryClient } from "@tanstack/react-query";

import { listCollections } from "@/lib/library/builds";
import { listSavedItems, savedItemsUsedIn } from "@/lib/library/savedItems";

const STALE = 30_000;

export const insertReads = (viewerId: string | null) => ({
  saved: { queryKey: ["library", "listSavedItems", "insert", viewerId], queryFn: () => listSavedItems({ limit: 100 }), staleTime: STALE },
  usedIn: { queryKey: ["library", "savedItemsUsedIn", viewerId], queryFn: savedItemsUsedIn, staleTime: STALE },
  collections: { queryKey: ["library", "listCollections", "insert", viewerId], queryFn: () => listCollections({ limit: 100 }), staleTime: STALE },
}) as const;

/** The window's code. One chunk, fetched once. */
export const loadAddFromLibrary = () => import("./AddFromLibrary");

/** Fetch the window's chunk and start its first reads. Safe to call again: the chunk and the cache answer. */
export function preloadAddFromLibrary(client: QueryClient, viewerId: string | null): void {
  void loadAddFromLibrary().catch(() => undefined);
  if (!viewerId) return;
  const reads = insertReads(viewerId);
  void client.prefetchQuery(reads.saved).catch(() => undefined);
  void client.prefetchQuery(reads.usedIn).catch(() => undefined);
  void client.prefetchQuery(reads.collections).catch(() => undefined);
}
