// writeGuard: the composer's writes survive no connection (CA-23 P2). No React in here.
//
// WHERE IT SITS. It wraps the `fetch` the Supabase REST client sends every table call through, so every write the composer
// makes, from whichever path, is covered without each path knowing: the node queue, the thread, `making`, the build's fields,
// the Classification Card, the session rows. Only calls to the composer's own tables (and the one function that sets the post's
// pictures) are touched; everything else goes straight through.
//
// WHILE OFFLINE a write is held, in order, and kept in `localStorage` under `bg:pending:{buildId}` so a reload loses nothing.
// The caller's promise stays open: it is answered with the real response once the write has gone out, so the code that made
// the write is none the wiser, and editing carries on as normal. A write that fails with no response at all (a network
// failure) is held the same way, and says the connection is down.
//
// ORDER. While anything is held, or being replayed, a new write joins the end of the line even if the connection is back. On
// reconnect, and on the next load of that build, the line is replayed first, one write at a time; a read of a composer table
// waits behind it, so nothing is read before the maker's own writes have landed.
//
// READS WHILE OFFLINE. A read waits for the connection, with one exception: the build's own row, which the last read of it is
// answered from (with the held writes laid over it), because writes that read `making` before they merge into it would
// otherwise stop dead. Writes that read other rows first (moving tiles) wait in memory, behind the line.
//
// A WRITE REFUSED ON REPLAY (the row changed elsewhere in the meantime) is not lost and not forced: `onConflict` hears of it.

import { connection as sharedConnection, isNetworkFailure, type Connection } from "./connection";

export const PENDING_KEY_PREFIX = "bg:pending:";
export const pendingKey = (buildId: string): string => `${PENDING_KEY_PREFIX}${buildId}`;

/** The tables the composer writes to, and the one function it calls to set the post's pictures. */
const TABLES = new Set(["builds", "build_nodes", "build_sessions", "build_media", "build_events"]);
const FUNCTIONS = new Set(["set_build_post_media"]);

const WRITES = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/** Headers a replay must not carry: the client puts fresh ones on. */
const AUTH_HEADERS = new Set(["apikey", "authorization"]);

export interface HeldWrite {
  id: string;
  at: number;
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
  /** What the tab knew of the rows this write changes when it was made (CA-23 P4), so a replay after a reload can tell what changed meanwhile. */
  base?: Record<string, unknown>;
}

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface WriteGuardOptions {
  buildId: string;
  /** The client's own fetch: the one that adds the key and the signed-in user's token. */
  baseFetch: typeof fetch;
  connection?: Connection;
  storage?: StorageLike | null;
  /** A held write came back refused because the row changed elsewhere. */
  onConflict?: (held: HeldWrite, response: Response) => void;
  /** What the tab knows of the rows a write changes, kept with it while it is held. */
  baseFor?: (write: { method: string; url: string; body: string | null }) => Record<string, unknown> | undefined;
  /** A write kept from an earlier load, about to go: it may be settled here instead (it returns the write to send, or null to drop it). */
  beforeReplay?: (held: HeldWrite) => Promise<HeldWrite | null>;
  /** A write went through (live, or replayed). */
  onWritten?: (write: { method: string; url: string; body: string | null }) => void;
  /** Writes held, including those kept from an earlier load. */
  onChange?: (state: { held: number; orphans: number }) => void;
}

export interface WriteGuard {
  /** The wrapper to give the REST client. */
  fetch: typeof fetch;
  /** Writes waiting, whoever made them. */
  held: () => readonly HeldWrite[];
  /** Waiting writes that no live call is waiting on (kept from an earlier load). */
  orphans: () => number;
  /** Send the line now, in order; resolves once it is empty or the connection drops again. */
  drain: () => Promise<void>;
  /** Resolves when nothing is held and the connection is up. */
  settled: () => Promise<void>;
  dispose: () => void;
}

interface Item {
  held: HeldWrite;
  waiter: { resolve: (response: Response) => void; reject: (error: unknown) => void } | null;
}

const urlOf = (input: RequestInfo | URL): string => (typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

/** The composer table (or function) a REST URL names, else null. */
export function guardedTarget(url: string): { kind: "table" | "rpc"; name: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://local.invalid");
  } catch {
    return null;
  }
  const match = /\/rest\/v1\/(rpc\/)?([^/?]+)/.exec(parsed.pathname);
  if (!match) return null;
  if (match[1]) return FUNCTIONS.has(match[2]) ? { kind: "rpc", name: match[2] } : null;
  return TABLES.has(match[2]) ? { kind: "table", name: match[2] } : null;
}

function headersOf(init: RequestInit | undefined): [string, string][] {
  const out: [string, string][] = [];
  new Headers(init?.headers).forEach((value, key) => {
    if (!AUTH_HEADERS.has(key.toLowerCase())) out.push([key, value]);
  });
  return out;
}

/** `updated_at` of a PostgREST answer: a row, or the first of a list. */
function stampOf(body: unknown): string | null {
  const row = Array.isArray(body) ? body[0] : body;
  const stamp = row && typeof row === "object" ? (row as { updated_at?: unknown }).updated_at : null;
  return typeof stamp === "string" ? stamp : null;
}

/** The URL of a held write with its `updated_at=eq.…` guard moved on to the stamp the write before it left behind. */
export function withStamp(url: string, stamp: string): string {
  const parsed = new URL(url, "http://local.invalid");
  if (!parsed.searchParams.has("updated_at")) return url;
  parsed.searchParams.set("updated_at", `eq.${stamp}`);
  return /^https?:\/\/local\.invalid/.test(url) ? `${parsed.pathname}${parsed.search}` : parsed.href;
}

/** A write the database refused because nothing matched its guard: 406 for a single row, 200 with no rows for a list. */
async function refusedForStamp(held: HeldWrite, response: Response): Promise<boolean> {
  if (!new URL(held.url, "http://local.invalid").searchParams.has("updated_at")) return false;
  if (response.status === 406) return true;
  if (!response.ok) return false;
  try {
    const body: unknown = await response.clone().json();
    return Array.isArray(body) && body.length === 0;
  } catch {
    return false;
  }
}

export function createWriteGuard(options: WriteGuardOptions): WriteGuard {
  const { buildId, baseFetch, onConflict, onChange, onWritten, baseFor, beforeReplay } = options;
  const connection = options.connection ?? sharedConnection;
  const storage = options.storage === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : options.storage;
  const key = pendingKey(buildId);

  const line: Item[] = [];
  let draining = false;
  let disposed = false;
  let armed = false;
  /** While a write kept from an earlier load is being settled, its own reads and writes go straight through. */
  let settling = false;
  let counter = 0;
  let idle: (() => void)[] = [];
  /** The last answers about the build's own row, so a read offline can be answered. */
  const rowCache = new Map<string, { status: number; headers: [string, string][]; body: unknown }>();

  const persist = () => {
    if (!storage) return;
    try {
      if (line.length === 0) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(line.map((item) => item.held)));
    } catch {
      /* storage full or blocked: the line still holds in memory */
    }
  };
  const announce = () => onChange?.({ held: line.length, orphans: line.filter((item) => !item.waiter).length });

  // Writes kept from an earlier load come first, with nobody waiting on them.
  if (storage) {
    try {
      const raw = storage.getItem(key);
      const kept = raw ? (JSON.parse(raw) as HeldWrite[]) : [];
      if (Array.isArray(kept)) for (const held of kept) if (held && typeof held.url === "string") line.push({ held, waiter: null });
    } catch {
      /* unreadable: start empty */
    }
  }

  const release = () => {
    if (line.length > 0 || draining || connection.isOffline()) return;
    const waiting = idle;
    idle = [];
    for (const go of waiting) go();
  };

  const settled = (): Promise<void> => (line.length === 0 && !draining && !connection.isOffline() ? Promise.resolve() : new Promise<void>((resolve) => void idle.push(resolve)));

  /* ── the build's own row, for a read offline ── */

  const targetId = (url: string): string | null => /^eq\.(.+)$/.exec(new URL(url, "http://local.invalid").searchParams.get("id") ?? "")?.[1] ?? null;
  const mergeInto = (body: unknown, id: string, patch: Record<string, unknown>): unknown => {
    const apply = (row: unknown) => (row && typeof row === "object" && (row as { id?: unknown }).id === id ? { ...(row as object), ...patch } : row);
    return Array.isArray(body) ? body.map(apply) : apply(body);
  };
  const laySettled = (held: HeldWrite, answer: unknown) => {
    const id = targetId(held.url);
    if (!id || guardedTarget(held.url)?.name !== "builds" || held.method !== "PATCH") return;
    let patch: Record<string, unknown> = {};
    try {
      patch = held.body ? (JSON.parse(held.body) as Record<string, unknown>) : {};
    } catch {
      return;
    }
    const stamp = stampOf(answer);
    for (const [url, entry] of rowCache) rowCache.set(url, { ...entry, body: mergeInto(entry.body, id, stamp ? { ...patch, updated_at: stamp } : patch) });
  };

  /* ── sending the line ── */

  const sendInit = (held: HeldWrite): RequestInit => ({ method: held.method, headers: held.headers, body: held.body });

  async function drain(): Promise<void> {
    if (draining || disposed) return;
    draining = true;
    let stamp: string | null = null;
    try {
      while (line.length > 0 && !disposed) {
        const item = line[0];
        let held = stamp ? { ...item.held, url: withStamp(item.held.url, stamp) } : item.held;
        // Nobody is waiting on a write kept from an earlier load, and what it was based on may have moved: it is settled first.
        if (!item.waiter && beforeReplay) {
          let settled: HeldWrite | null = held;
          settling = true;
          try {
            settled = await beforeReplay(held);
          } catch {
            /* settle failed: it is sent as it was */
          } finally {
            settling = false;
          }
          if (settled === null) {
            line.shift();
            persist();
            announce();
            continue;
          }
          held = settled;
        }
        let response: Response;
        try {
          response = await baseFetch(held.url, sendInit(held));
        } catch (cause) {
          if (isNetworkFailure(cause)) {
            connection.noteNetworkFailure();
            return;
          }
          line.shift();
          persist();
          announce();
          item.waiter?.reject(cause);
          continue;
        }
        line.shift();
        persist();
        announce();
        try {
          const body: unknown = await response.clone().json();
          stamp = stampOf(body) ?? stamp;
          laySettled(held, body);
        } catch {
          /* no body to read */
        }
        if (await refusedForStamp(held, response)) {
          if (item.waiter) item.waiter.resolve(response);
          else onConflict?.(held, response);
        } else {
          if (response.ok) onWritten?.({ method: held.method, url: held.url, body: held.body });
          item.waiter?.resolve(response);
        }
      }
    } finally {
      draining = false;
      release();
    }
  }

  const hold = (input: RequestInfo | URL, init: RequestInit | undefined): Promise<Response> =>
    new Promise<Response>((resolve, reject) => {
      const bodyText = typeof init?.body === "string" ? init.body : null;
      const held: HeldWrite = { id: `${Date.now()}-${(counter += 1)}`, at: Date.now(), method: (init?.method ?? "POST").toUpperCase(), url: urlOf(input), headers: headersOf(init), body: bodyText };
      const base = baseFor?.({ method: held.method, url: held.url, body: held.body });
      if (base) held.base = base;
      line.push({ held, waiter: { resolve, reject } });
      persist();
      announce();
      if (!connection.isOffline() && !draining) void drain();
    });

  const guardedFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    const target = guardedTarget(url);
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET") ?? "GET").toUpperCase();
    if (!target || disposed || settling) return baseFetch(input, init);

    if (WRITES.has(method)) {
      // Only a body that can be written down is held; a file goes straight through.
      if (init?.body != null && typeof init.body !== "string") return baseFetch(input, init);
      if (line.length > 0 || draining || connection.isOffline()) return hold(input, init);
      try {
        const response = await baseFetch(input, init);
        armed = true;
        if (response.ok) onWritten?.({ method, url, body: typeof init?.body === "string" ? init.body : null });
        if (target.name === "builds" && method === "PATCH") {
          try {
            laySettled({ id: "", at: 0, method, url, headers: [], body: typeof init?.body === "string" ? init.body : null }, await response.clone().json());
          } catch {
            /* nothing to lay */
          }
        }
        return response;
      } catch (cause) {
        if (!isNetworkFailure(cause)) throw cause;
        connection.noteNetworkFailure();
        return hold(input, init);
      }
    }

    // A read waits behind the line, so nothing is read before the maker's own writes have landed. Offline, once the page has
    // read anything, it waits for the connection (the build's own row is answered from the last read); before that it fails
    // as a read does, so a page opened with no connection says so.
    if (connection.isOffline()) {
      if (armed) {
        const cached = target.name === "builds" ? rowCache.get(url) : undefined;
        if (cached) return new Response(JSON.stringify(cached.body), { status: cached.status, headers: cached.headers });
        await settledOrOffline();
      }
    } else if (line.length > 0 || draining) await settledOrOffline();
    for (;;) {
      try {
        const response = await baseFetch(input, init);
        armed = true;
        if (target.name === "builds" && response.ok) {
          try {
            const headers: [string, string][] = [];
            response.headers.forEach((value, name) => headers.push([name, value]));
            rowCache.set(url, { status: response.status, headers, body: await response.clone().json() });
          } catch {
            /* not worth keeping */
          }
        }
        return response;
      } catch (cause) {
        if (!isNetworkFailure(cause) || !armed) throw cause;
        connection.noteNetworkFailure();
        const cached = target.name === "builds" ? rowCache.get(url) : undefined;
        if (cached) return new Response(JSON.stringify(cached.body), { status: cached.status, headers: cached.headers });
        await settledOrOffline();
      }
    }
  }) as typeof fetch;

  /** A read waits until the line has gone out and the connection is up. */
  async function settledOrOffline(): Promise<void> {
    for (;;) {
      if (connection.isOffline()) await connection.whenOnline();
      if (line.length > 0 && !draining) void drain();
      await settled();
      if (!connection.isOffline() && line.length === 0 && !draining) return;
    }
  }

  const stop = connection.subscribe(() => {
    if (!connection.isOffline()) void drain();
    else release();
  });

  if (line.length > 0) {
    announce();
    if (!connection.isOffline()) void drain();
  }

  return {
    fetch: guardedFetch,
    held: () => line.map((item) => item.held),
    orphans: () => line.filter((item) => !item.waiter).length,
    drain,
    settled,
    dispose: () => {
      disposed = true;
      stop();
      release();
    },
  };
}

/** The REST client's fetch is the one thing the guard replaces; put it back with the function this returns. */
export function installWriteGuard(client: object, options: Omit<WriteGuardOptions, "baseFetch">): { guard: WriteGuard; uninstall: () => void } {
  // `rest` is the client's PostgREST client: protected in its types, and the one place every table call takes its fetch from.
  const rest = (client as { rest: { fetch?: typeof fetch } }).rest;
  const baseFetch = rest.fetch ?? fetch.bind(globalThis);
  const guard = createWriteGuard({ ...options, baseFetch });
  rest.fetch = guard.fetch;
  return {
    guard,
    uninstall: () => {
      if (rest.fetch === guard.fetch) rest.fetch = baseFetch;
      guard.dispose();
    },
  };
}
