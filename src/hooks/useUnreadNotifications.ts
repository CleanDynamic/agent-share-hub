import { useCallback, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToNewNotifications } from "@/lib/notifications/realtime";

/* UI-P40 — ONE COUNT FOR THE WHOLE FRAME. The header's bell, the dock's tile,
   the legacy shell and the workspace all show this number. Each used to run its
   own exact-count query, open its own two realtime channels and re-read on
   every window focus, so Home asked the same question four times on load and
   again whenever the tab came back. Now the reader's count lives here, once:
   read when the first consumer mounts, kept current by one INSERT channel and
   one UPDATE channel, and dropped when the last consumer unmounts. Nothing
   polls. */

interface Store {
  count: number;
  consumers: number;
  listeners: Set<() => void>;
  inflight: Promise<void> | null;
  /** A read was asked for while one was in flight; run one more after it. */
  again: boolean;
  teardown: (() => void) | null;
}

const stores = new Map<string, Store>();

function storeFor(userId: string): Store {
  let store = stores.get(userId);
  if (!store) {
    store = { count: 0, consumers: 0, listeners: new Set(), inflight: null, again: false, teardown: null };
    stores.set(userId, store);
  }
  return store;
}

function publish(store: Store, count: number) {
  if (store.count === count) return;
  store.count = count;
  for (const listener of store.listeners) listener();
}

/** Read the count. Calls made while a read is in flight share it, plus one re-read after. */
function read(userId: string): Promise<void> {
  const store = storeFor(userId);
  if (store.inflight) {
    store.again = true;
    return store.inflight;
  }
  store.inflight = (async () => {
    try {
      do {
        store.again = false;
        const { count } = await supabase
          .from("notifications" as any)
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .eq("is_read", false);
        publish(store, count ?? 0);
      } while (store.again);
    } finally {
      store.inflight = null;
    }
  })();
  return store.inflight;
}

function connect(userId: string): () => void {
  const store = storeFor(userId);
  const unsubInsert = subscribeToNewNotifications(userId, () => publish(store, store.count + 1));
  const channel = supabase
    .channel(`notifications-read:${userId}:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
      // A row was marked read (or otherwise updated) — re-sync.
      () => void read(userId),
    )
    .subscribe();
  return () => {
    unsubInsert();
    try { supabase.removeChannel(channel); } catch { /* noop */ }
  };
}

function subscribe(userId: string, listener: () => void): () => void {
  const store = storeFor(userId);
  store.listeners.add(listener);
  store.consumers += 1;
  if (store.consumers === 1) {
    store.teardown = connect(userId);
    void read(userId);
  }
  return () => {
    store.listeners.delete(listener);
    store.consumers -= 1;
    if (store.consumers === 0) {
      store.teardown?.();
      store.teardown = null;
      stores.delete(userId);
    }
  };
}

/**
 * Have the unread count read again. Called after rows are marked read, so the
 * badges do not wait on a realtime UPDATE that a connection may never deliver.
 */
export function refreshUnreadNotifications(): void {
  for (const userId of stores.keys()) void read(userId);
}

const noop = () => () => {};
const zero = () => 0;

export function useUnreadNotifications() {
  const { isLoggedIn, user } = useAuth();
  const userId = isLoggedIn && user ? user.id : null;

  const subscribeFn = useCallback(
    (listener: () => void) => (userId ? subscribe(userId, listener) : noop()),
    [userId],
  );
  const snapshot = useCallback(() => (userId ? (stores.get(userId)?.count ?? 0) : 0), [userId]);
  const count = useSyncExternalStore(subscribeFn, userId ? snapshot : zero, zero);

  const refresh = useCallback(async () => {
    if (userId) await read(userId);
  }, [userId]);

  const display = count > 9 ? "9+" : count > 0 ? String(count) : null;

  return { count, display, refresh };
}
