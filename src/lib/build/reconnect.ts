// reconnect: when the connection comes back and the writes held for it have all landed, say how many (CA-23 P2). No React.
//
// The count is the most changes that were pending at any moment of the time offline, so "3 changes saved" is what the maker
// would have lost. A stretch offline with nothing pending says nothing.

import type { Connection } from "./connection";
import type { PendingStore } from "./pendingWrites";

export const RECONNECTED = {
  /** "Reconnected. 3 changes saved." */
  saved: (count: number): string => `Reconnected. ${count} ${count === 1 ? "change" : "changes"} saved.`,
} as const;

export function watchReconnect(connection: Connection, store: PendingStore, onSaved: (count: number) => void): () => void {
  let wasOffline = connection.isOffline();
  let peak = wasOffline ? store.total() : 0;
  const check = () => {
    if (connection.isOffline()) {
      wasOffline = true;
      peak = Math.max(peak, store.total());
      return;
    }
    if (wasOffline && store.total() === 0) {
      const count = peak;
      wasOffline = false;
      peak = 0;
      if (count > 0) onSaved(count);
    }
  };
  const stopConnection = connection.subscribe(check);
  const stopStore = store.subscribe(check);
  return () => {
    stopConnection();
    stopStore();
  };
}
