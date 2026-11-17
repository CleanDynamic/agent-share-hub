// SV-03 P7: how long fetched data is kept and when it is read again.
//
// gcTime 30 minutes: a page left and come back to within half an hour is still in memory. A list is fresh for 60 seconds;
// facets, counts and node types for five minutes (they change rarely, and the registry never goes stale in a visit). Data
// that is on screen and stale is read again quietly behind what is shown: no placeholder replaces it.

import { isPermissionError } from "@/lib/errors/permission";

import { isReadTimeout } from "./readLimit";

export const GC_MS = 30 * 60_000;
export const LIST_STALE_MS = 60_000;
export const SLOW_STALE_MS = 5 * 60_000;

/* UI-P37: one retry, not three. A refusal is never retried: asking again changes nothing.
   D3: nor is a read the time limit cut (readLimit.ts). It has already had READ_TIMEOUT_MS; a second wait would put the
   failed state at about 20 seconds, so it fails at 10, and the person asks again with Try again. */
export function retryRead(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && !isPermissionError(error) && !isReadTimeout(error);
}

export const QUERY_DEFAULTS = { gcTime: GC_MS, staleTime: LIST_STALE_MS, retry: retryRead } as const;
