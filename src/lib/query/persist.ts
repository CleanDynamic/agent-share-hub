// SV-03 P7, step 3: keep what was fetched across a reload.
//
// WHY. A reload showed placeholders for the length of every request chain; with the first screen kept, it shows the page in
// its first frame and reads it again quietly behind it.
//
// WHAT IS KEPT, and nothing else (an allow list of query keys): the Home feed's first page, drafts, facets, node types and
// profile summaries. NEVER the composer's own data (`compose-build`), and never anything with `making` or `post_doc` in it:
// a query whose data carries either is left out whatever its key (the Builds and Saved cards carry the post, so they are
// not kept).
//
// WHOSE. One store, stamped with the reader's id, read back only for the same reader. It is cleared on sign out and when a
// different reader signs in (`clearKeptCache`). CACHE_VERSION changes only when the shape of something kept changes.
//
// SAFE WHEN STORAGE IS NOT. Every read and write of the store is inside try/catch: a private window or blocked storage just
// means no kept cache. At most MAX_BYTES is written; a larger state is not written at all.

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";
import { del, get, set } from "idb-keyval";

export const CACHE_VERSION = "1";
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_AGE_MS = 24 * 60 * 60_000;
const STORE_KEY = `bg-kept-cache:v${CACHE_VERSION}`;

/** The key prefixes that may be kept. */
export const KEPT_KEYS: ReadonlyArray<readonly string[]> = [
  ["feed", "getBuildFeed"],
  ["build", "listDraftsWithSessions"],
  ["build", "getClassificationFacets"],
  ["build", "getGalleryFacets"],
  ["build", "getNodeTypes"],
  ["profile", "getProfileSummary"],
];

const startsWith = (key: readonly unknown[], prefix: readonly string[]) => prefix.every((part, at) => key[at] === part);

const carriesPost = (data: unknown): boolean => {
  try {
    return /"(making|post_doc)"/.test(JSON.stringify(data) ?? "");
  } catch {
    return true;
  }
};

/** Whether a query may be written to the kept cache. */
export function shouldKeep(query: Pick<Query, "queryKey" | "state">): boolean {
  if (query.state.status !== "success") return false;
  if (!KEPT_KEYS.some((prefix) => startsWith(query.queryKey, prefix))) return false;
  return !carriesPost(query.state.data);
}

/** The reader the stored session names, read without waiting for anything. Null signed out, or when storage cannot be read. */
export function readStoredUserId(storage: Pick<Storage, "length" | "key" | "getItem"> = window.localStorage): string | null {
  try {
    for (let at = 0; at < storage.length; at += 1) {
      const name = storage.key(at);
      if (!name || !/^sb-.+-auth-token$/.test(name)) continue;
      const id = (JSON.parse(storage.getItem(name) ?? "null") as { user?: { id?: unknown } } | null)?.user?.id;
      if (typeof id === "string" && id) return id;
    }
  } catch {
    /* storage blocked or the session unreadable: nobody to keep a cache for */
  }
  return null;
}

interface Stored {
  userId: string;
  value: string;
}

let writer: string | null = null;

/** Who the writes belong to. Set once the session is known, and again when it changes. */
export function setKeptCacheUser(userId: string | null): void {
  writer = userId;
}

const storage = (reader: string | null) => ({
  getItem: async (key: string): Promise<string | null> => {
    try {
      const found = await get<Stored>(key);
      if (!found) return null;
      if (reader === null || found.userId !== reader) {
        await del(key);
        return null;
      }
      return found.value;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (writer === null || value.length > MAX_BYTES) {
        await del(key);
        return;
      }
      await set(key, { userId: writer, value } satisfies Stored);
    } catch {
      /* no kept cache */
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await del(key);
    } catch {
      /* nothing was kept */
    }
  },
});

/** An infinite query is kept at its first page: what a reload shows first. */
function firstPageOnly(data: unknown): unknown {
  const infinite = data as { pages?: unknown[]; pageParams?: unknown[] } | null;
  if (infinite && Array.isArray(infinite.pages) && Array.isArray(infinite.pageParams)) {
    return { pages: infinite.pages.slice(0, 1), pageParams: infinite.pageParams.slice(0, 1) };
  }
  return data;
}

/**
 * The persister. What it gives back on a reload belongs to the reader the stored session names (nothing when there is none);
 * what it writes belongs to whoever the session says is signed in, which `setKeptCacheUser` is told.
 */
export function createKeptCache(reader: string | null = readStoredUserId()) {
  setKeptCacheUser(reader);
  return createAsyncStoragePersister({
    storage: storage(reader),
    key: STORE_KEY,
    throttleTime: 2_000,
    serialize: (state) => {
      const trimmed = {
        ...state,
        clientState: {
          ...state.clientState,
          queries: state.clientState.queries.map((query) => ({ ...query, state: { ...query.state, data: firstPageOnly(query.state.data) } })),
        },
      };
      return JSON.stringify(trimmed);
    },
    deserialize: (cached) => {
      const state = JSON.parse(cached);
      // JSON writes the first page's `undefined` parameter as null; the pages that are kept start from undefined.
      for (const query of state?.clientState?.queries ?? []) {
        const data = query?.state?.data as { pageParams?: unknown[] } | null;
        if (data && Array.isArray(data.pageParams)) data.pageParams = data.pageParams.map((param) => (param === null ? undefined : param));
      }
      return state;
    },
  });
}

/** Forget everything kept. Sign out calls this, and so does a different reader signing in. */
export async function clearKeptCache(): Promise<void> {
  writer = null;
  try {
    await del(STORE_KEY);
  } catch {
    /* nothing was kept */
  }
}
