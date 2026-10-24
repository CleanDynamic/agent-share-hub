// pendingWrites: the one count of what the composer has not yet written (CA-23 P2). No React in here.
//
// WHAT COUNTS. Everything the composer sends to Supabase, from whichever path: the node queue, the thread save, `making`,
// the build's own fields, the Classification Card and the session rows. A source that keeps its own state (the header's
// debounce, the thread's draft) says how many changes it holds with `set`; a source that runs tasks (the node queue, Made
// with, the Card) wraps each task in `trackWrite`, which counts it until it settles. The page reads the total.
//
// A TASK THAT FAILS stays on `failed` with the way to run it again, in the order it failed; Retry runs them in that order.
// A later success from the same source takes its older failures off: the maker has done it another way.
//
// RETRIES. A write that can succeed later (a timeout, a busy database, a 5xx) is tried again 3 times, after 1, 4 and 10
// seconds, before it counts as failed. A network failure is not an error and is not retried here: the connection layer holds
// it (`connection.ts`, `writeGuard.ts`).

import { canSucceedLater } from "@/lib/errors/code";

import { isNetworkFailure } from "./connection";

/** The wait before each retry of a write that can succeed later. */
export const RETRY_DELAYS_MS = [1_000, 4_000, 10_000] as const;

export type WriteSource = "header" | "thread" | "nodes" | "making" | "sessions" | "card" | "files" | "queued";

export interface FailedWrite {
  source: WriteSource;
  retry: () => Promise<unknown>;
}

export interface PendingStore {
  /** Every change not yet written. */
  total: () => number;
  /** One source's count. */
  of: (source: WriteSource) => number;
  /** A source that keeps its own state says how many changes it holds. */
  set: (source: WriteSource, count: number) => void;
  /** One more change is on its way; call the result when it has landed or stopped. */
  begin: (source: WriteSource) => () => void;
  /** The writes that stopped, oldest first. */
  failed: () => readonly FailedWrite[];
  /** A task stopped; Retry will run it again. */
  fail: (write: FailedWrite) => void;
  /** A source wrote something: its older failures are put right. */
  succeeded: (source: WriteSource) => void;
  /** Run every failed write again, in the order they failed. Resolves when all have been tried. */
  retryFailed: () => Promise<void>;
  /** Forget everything (a different build). */
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
  /** A number that changes whenever the total or the failures do: for `useSyncExternalStore`. */
  version: () => number;
}

export function createPendingStore(): PendingStore {
  const counts = new Map<WriteSource, number>();
  let failures: FailedWrite[] = [];
  const listeners = new Set<() => void>();
  let version = 0;
  const emit = () => {
    version += 1;
    for (const listener of [...listeners]) listener();
  };
  const total = () => [...counts.values()].reduce((sum, n) => sum + n, 0);
  return {
    total,
    of: (source) => counts.get(source) ?? 0,
    set: (source, count) => {
      const next = Math.max(0, Math.floor(count));
      if ((counts.get(source) ?? 0) === next) return;
      counts.set(source, next);
      emit();
    },
    begin: (source) => {
      counts.set(source, (counts.get(source) ?? 0) + 1);
      emit();
      let done = false;
      return () => {
        if (done) return;
        done = true;
        counts.set(source, Math.max(0, (counts.get(source) ?? 0) - 1));
        emit();
      };
    },
    failed: () => failures,
    fail: (write) => {
      failures = [...failures, write];
      emit();
    },
    succeeded: (source) => {
      if (!failures.some((write) => write.source === source)) return;
      failures = failures.filter((write) => write.source !== source);
      emit();
    },
    retryFailed: async () => {
      const again = failures;
      failures = [];
      emit();
      for (const write of again) await write.retry().catch(() => undefined);
    },
    reset: () => {
      counts.clear();
      failures = [];
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    version: () => version,
  };
}

/** The composer's one store. */
export const pendingWrites: PendingStore = createPendingStore();

/** Whether a write that failed should be tried again by itself: it can pass later, and the database was reached or not asked. */
export const canRetryWrite = (error: unknown): boolean => !isNetworkFailure(error) && !isStaleWrite(error) && canSucceedLater(error);

/** A write the database would not make because the row changed elsewhere (CA-23 P4): not an error to retry or to report. */
export class StaleWriteError extends Error {
  readonly stale = true;
  constructor(readonly table: string, readonly id: string | null, message = "That changed somewhere else.") {
    super(message);
    this.name = "StaleWriteError";
  }
}

export const isStaleWrite = (error: unknown): error is StaleWriteError => Boolean(error) && typeof error === "object" && (error as { stale?: unknown }).stale === true;

const wait = (ms: number) => new Promise<void>((resolve) => void window.setTimeout(resolve, ms));

/** Run `task`; when it fails with something that can pass later, wait 1, 4 and 10 seconds and run it again, then give up. */
export async function withRetries<T>(task: () => Promise<T>, onRetry?: (attempt: number) => void): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (cause) {
      if (attempt >= RETRY_DELAYS_MS.length || !canRetryWrite(cause)) throw cause;
      onRetry?.(attempt + 1);
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
}

export interface TrackOptions {
  store?: PendingStore;
  /** Start only once this has settled (a queue's tail): the change counts from now, not from then. */
  after?: Promise<unknown>;
  /** How Retry runs the task again: through the same queue it first went through. */
  again?: <U>(task: () => Promise<U>) => Promise<U>;
}

/**
 * Count a task from `source` until it settles; retry it by itself when it can pass later; and when it stops, keep it on the
 * failed list so Retry can run it again. Resolves and rejects as the task does.
 */
export function trackWrite<T>(source: WriteSource, task: () => Promise<T>, options: TrackOptions = {}): Promise<T> {
  const store = options.store ?? pendingWrites;
  const end = store.begin(source);
  const started = options.after ? options.after.then(() => withRetries(task)) : withRetries(task);
  return started.then(
    (value) => {
      end();
      store.succeeded(source);
      return value;
    },
    (cause: unknown) => {
      end();
      // A write the database would not take because it changed elsewhere goes to the clash window, not to Retry.
      if (!isStaleWrite(cause)) store.fail({ source, retry: () => (options.again ? options.again(task) : trackWrite(source, task, { store })) });
      throw cause;
    },
  );
}
