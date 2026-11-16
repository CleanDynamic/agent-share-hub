// G4: which one of loading, failed, empty, not found and ready a region is in, from its query results. Pure.
//
// THE ORDER.
// - A read that failed with nothing to show fails the region at once (it does not wait for the rest). The one exception
//   is the server saying the row does not exist (PostgREST's no-rows code, PGRST116), and only on a page that has a
//   not-found case: that is not found. A failed, refused or timed-out read never is.
// - Otherwise, a read still out keeps the region loading.
// - Once every read has answered: not found if the page says the row is absent, then empty if it says there is
//   nothing, else ready.
// - A read that already has data keeps it when a refetch fails: the region stays ready, as TanStack keeps it.

export type Shown = "loading" | "failed" | "empty" | "notfound" | "ready";

/** The part of a TanStack query result PageState reads. */
export interface ReadLike {
  data: unknown;
  error: unknown;
  status: "pending" | "error" | "success";
  fetchStatus: "fetching" | "paused" | "idle";
  refetch: () => unknown;
}

const NO_ROWS = "PGRST116";
const MAX_DEPTH = 5;

/** The server answered that the single row asked for does not exist. */
export function isNoRows(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH && current && typeof current === "object"; depth += 1) {
    if ((current as { code?: unknown }).code === NO_ROWS) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export interface ShownOptions {
  /** The server answered, and there is nothing to show. Given every read's data, in order. */
  isEmpty?: (data: unknown[]) => boolean;
  /** The server answered that what the address names does not exist. Given every read's data, in order. */
  isMissing?: (data: unknown[]) => boolean;
}

const failedWithNothing = (read: ReadLike) => read.status === "error" && read.data === undefined;

export function shownState(reads: readonly ReadLike[], options: ShownOptions = {}): Shown {
  const failures = reads.filter(failedWithNothing);
  if (failures.length > 0) {
    return options.isMissing && failures.every((read) => isNoRows(read.error)) ? "notfound" : "failed";
  }
  if (reads.some((read) => read.data === undefined)) return "loading";
  const data = reads.map((read) => read.data);
  if (options.isMissing?.(data)) return "notfound";
  if (options.isEmpty?.(data)) return "empty";
  return "ready";
}

/** G9: every region's reads failed with nothing to show, so the page shows one failed state, not one per region. */
export function allFailed(reads: readonly ReadLike[]): boolean {
  return reads.length > 0 && reads.every(failedWithNothing);
}

/** A read in a given state, for a view's fixture or test that has no query to hand: loading, failed or answered. */
export function readOf(state: "loading" | "error" | "ready", data: unknown = [], onRetry: () => unknown = () => undefined, error: unknown = { message: "fixture" }): ReadLike {
  if (state === "loading") return { data: undefined, error: null, status: "pending", fetchStatus: "fetching", refetch: onRetry };
  if (state === "error") return { data: undefined, error, status: "error", fetchStatus: "idle", refetch: onRetry };
  return { data, error: null, status: "success", fetchStatus: "idle", refetch: onRetry };
}

/** A retry is out on a region that failed. */
export const isRetrying = (reads: readonly ReadLike[]): boolean => reads.some((read) => failedWithNothing(read) && read.fetchStatus === "fetching");
