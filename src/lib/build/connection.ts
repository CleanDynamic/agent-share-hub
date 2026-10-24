// connection: is the composer online? (CA-23 P2). No React in here.
//
// OFFLINE MEANS `navigator.onLine` is false, or a write failed at the network level (it got no response at all). A write
// the database refused is not that: the database answered. BACK ONLINE IS the browser's `online` event, or a ping to
// Supabase that gets any answer, tried every 15 seconds while offline (the event is not always sent, and `navigator.onLine`
// can be true behind a captive portal).
//
// One connection serves the page: `connection` below reads the real browser; `createConnection` takes its inputs so a test
// can drive it.

export const PING_EVERY_MS = 15_000;

export interface ConnectionEnv {
  /** `navigator.onLine`. */
  onLine: () => boolean;
  /** Whether Supabase answers at all (any HTTP status counts). */
  ping: () => Promise<boolean>;
  /** Listen to the window's `online` and `offline` events; returns the way to stop. */
  listen: (event: "online" | "offline", handler: () => void) => () => void;
}

export interface Connection {
  isOffline: () => boolean;
  /** A write got no response: the network is down whatever the browser says. */
  noteNetworkFailure: () => void;
  /** Resolves the next time the connection is back (at once when it is not down). */
  whenOnline: () => Promise<void>;
  subscribe: (listener: () => void) => () => void;
  /** Start listening to the browser; returns the way to stop. */
  start: () => () => void;
}

export function createConnection(env: ConnectionEnv): Connection {
  let offline = !env.onLine();
  const listeners = new Set<() => void>();
  const waiting = new Set<() => void>();
  let timer: number | null = null;
  let pinging = false;

  const emit = () => {
    for (const listener of [...listeners]) listener();
  };

  const stopPings = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  };

  const set = (next: boolean) => {
    if (next === offline) return;
    offline = next;
    if (offline) startPings();
    else {
      stopPings();
      for (const release of [...waiting]) release();
      waiting.clear();
    }
    emit();
  };

  const pingOnce = async () => {
    if (pinging) return;
    pinging = true;
    try {
      if (await env.ping()) set(false);
    } catch {
      /* still down */
    } finally {
      pinging = false;
    }
  };

  function startPings() {
    if (timer !== null) return;
    timer = window.setInterval(() => void pingOnce(), PING_EVERY_MS);
  }

  if (offline) startPings();

  return {
    isOffline: () => offline,
    noteNetworkFailure: () => set(true),
    whenOnline: () => (offline ? new Promise<void>((resolve) => void waiting.add(resolve)) : Promise.resolve()),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    start: () => {
      set(!env.onLine());
      const stopOnline = env.listen("online", () => set(false));
      const stopOffline = env.listen("offline", () => set(true));
      return () => {
        stopOnline();
        stopOffline();
      };
    },
  };
}

/** Any answer from Supabase's auth health endpoint says the network is there. */
async function pingSupabase(): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return typeof navigator === "undefined" ? true : navigator.onLine;
  try {
    await fetch(`${url}/auth/v1/health`, { method: "GET", cache: "no-store", headers: { apikey: String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "") } });
    return true;
  } catch {
    return false;
  }
}

/** The page's connection. */
export const connection: Connection = createConnection({
  onLine: () => (typeof navigator === "undefined" ? true : navigator.onLine),
  ping: pingSupabase,
  listen: (event, handler) => {
    window.addEventListener(event, handler);
    return () => window.removeEventListener(event, handler);
  },
});

/** A fetch that got no response at all: the browser's TypeError ("Failed to fetch", "Load failed", "NetworkError ..."). */
export function isNetworkFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const named = error as { name?: unknown; message?: unknown; cause?: unknown };
  if (named.name === "AbortError") return false;
  if (error instanceof TypeError) return true;
  if (typeof named.message === "string" && /failed to fetch|load failed|networkerror|network request failed/i.test(named.message)) return true;
  return named.cause ? isNetworkFailure(named.cause) : false;
}
