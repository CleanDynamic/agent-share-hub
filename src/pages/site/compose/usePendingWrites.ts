/* CA-23 P2: the composer's one pending-writes count, and whether it is online, as hooks. The stores are in
   `src/lib/build/pendingWrites.ts` and `connection.ts`; this is only the way React reads them. */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { connection } from "@/lib/build/connection";
import { pendingWrites } from "@/lib/build/pendingWrites";
import { watchReconnect } from "@/lib/build/reconnect";

export interface PendingWritesState {
  /** Changes not yet written, from every path the composer writes by. */
  pending: number;
  /** A write stopped after its retries: the status line says not saved. */
  failed: boolean;
  /** How many stopped: they are unsaved too, so leaving would lose them. */
  failedCount: number;
  /** Send every write that stopped again, in the order they stopped. */
  retry: () => Promise<void>;
}

export function usePendingWrites(): PendingWritesState {
  useSyncExternalStore(pendingWrites.subscribe, pendingWrites.version, pendingWrites.version);
  const retry = useCallback(() => pendingWrites.retryFailed(), []);
  const failedCount = pendingWrites.failed().length;
  return { pending: pendingWrites.total(), failed: failedCount > 0, failedCount, retry };
}

/** Whether there is no connection to Supabase right now. */
export function useOffline(): boolean {
  return useSyncExternalStore(connection.subscribe, connection.isOffline, () => false);
}

/** Start listening to the browser's connection for as long as the composer is open. */
export function useConnectionWatch(): void {
  useEffect(() => connection.start(), []);
}

/** `onSaved(count)` once the connection is back and every write held for it has landed. */
export function useReconnected(onSaved: (count: number) => void): void {
  const latest = useRef(onSaved);
  latest.current = onSaved;
  useEffect(() => watchReconnect(connection, pendingWrites, (count) => latest.current(count)), []);
}
