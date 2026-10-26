// SV-03 P7: how long fetched data is kept and when it is read again.
//
// gcTime 30 minutes: a page left and come back to within half an hour is still in memory. A list is fresh for 60 seconds;
// facets, counts and node types for five minutes (they change rarely, and the registry never goes stale in a visit). Data
// that is on screen and stale is read again quietly behind what is shown: no placeholder replaces it.

export const GC_MS = 30 * 60_000;
export const LIST_STALE_MS = 60_000;
export const SLOW_STALE_MS = 5 * 60_000;

export const QUERY_DEFAULTS = { gcTime: GC_MS, staleTime: LIST_STALE_MS } as const;
