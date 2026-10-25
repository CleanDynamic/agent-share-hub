import { beforeEach, describe, expect, it, vi } from "vitest";

const backing = new Map<string, unknown>();
let blocked = false;
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => {
    if (blocked) throw new Error("blocked");
    return backing.get(key);
  }),
  set: vi.fn(async (key: string, value: unknown) => {
    if (blocked) throw new Error("blocked");
    backing.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    if (blocked) throw new Error("blocked");
    backing.delete(key);
  }),
}));

import { CACHE_VERSION, KEPT_KEYS, MAX_BYTES, clearKeptCache, createKeptCache, readStoredUserId, setKeptCacheUser, shouldKeep } from "./persist";

const query = (queryKey: unknown[], data: unknown, status = "success") => ({ queryKey, state: { status, data } }) as never;
const STORE = `bg-kept-cache:v${CACHE_VERSION}`;

beforeEach(() => {
  backing.clear();
  blocked = false;
  setKeptCacheUser(null);
});

describe("what is kept", () => {
  it("keeps the allow list, and only successful queries", () => {
    expect(shouldKeep(query(["build", "listDraftsWithSessions", "u1"], [{ id: "d1" }]))).toBe(true);
    expect(shouldKeep(query(["feed", "getBuildFeed", "everyone", "u1"], { pages: [], pageParams: [] }))).toBe(true);
    expect(shouldKeep(query(["build", "listDraftsWithSessions", "u1"], [], "error"))).toBe(false);
    expect(KEPT_KEYS.length).toBeGreaterThan(0);
  });

  it("never keeps the composer's own data", () => {
    expect(shouldKeep(query(["compose-build", "b1"], { build: { id: "b1" } }))).toBe(false);
    expect(shouldKeep(query(["build", "listBuildSessions", "b1"], []))).toBe(false);
  });

  it("never keeps a query whose data carries a making or a post, whatever its key", () => {
    expect(shouldKeep(query(["build", "listDraftsWithSessions", "u1"], [{ id: "d1", making: {} }]))).toBe(false);
    expect(shouldKeep(query(["profile", "getProfileSummary", "a", "b"], { post_doc: null }))).toBe(false);
  });
});

describe("the reader the stored session names", () => {
  const fake = (entries: Record<string, string>) => ({ length: Object.keys(entries).length, key: (at: number) => Object.keys(entries)[at] ?? null, getItem: (name: string) => entries[name] ?? null });

  it("is read from the session in storage, with no waiting", () => {
    expect(readStoredUserId(fake({ other: "x", "sb-abc-auth-token": JSON.stringify({ user: { id: "u1" } }) }))).toBe("u1");
  });

  it("is nobody when there is no session, an unreadable one, or storage that throws", () => {
    expect(readStoredUserId(fake({}))).toBeNull();
    expect(readStoredUserId(fake({ "sb-abc-auth-token": "{not json" }))).toBeNull();
    expect(readStoredUserId({ length: 1, key: () => { throw new Error("blocked"); }, getItem: () => null })).toBeNull();
  });
});

describe("the store", () => {
  const state = (data: unknown) => ({ buster: CACHE_VERSION, timestamp: Date.now(), clientState: { mutations: [], queries: [{ queryKey: ["build", "listDraftsWithSessions", "u1"], queryHash: "h", state: { data, status: "success" } }] } }) as never;

  it("writes for the reader it was made for, and gives it back to them only", async () => {
    const mine = createKeptCache("u1");
    await mine.persistClient(state([{ id: "d1" }]));
    expect(backing.has(STORE)).toBe(true);
    expect((await mine.restoreClient())?.clientState.queries[0].state.data).toEqual([{ id: "d1" }]);

    const theirs = createKeptCache("u2");
    expect(await theirs.restoreClient()).toBeUndefined();
    expect(backing.has(STORE)).toBe(false);
  });

  it("keeps an infinite query at its first page", async () => {
    const persister = createKeptCache("u1");
    await persister.persistClient(state({ pages: [{ n: 1 }, { n: 2 }], pageParams: [undefined, "x"] }));
    expect((await persister.restoreClient())?.clientState.queries[0].state.data).toEqual({ pages: [{ n: 1 }], pageParams: [undefined] });
  });

  it("writes nothing past 2 MB", async () => {
    const persister = createKeptCache("u1");
    await persister.persistClient(state("x".repeat(MAX_BYTES + 10)));
    expect(backing.has(STORE)).toBe(false);
  });

  it("is cleared on sign out", async () => {
    const persister = createKeptCache("u1");
    await persister.persistClient(state([]));
    await clearKeptCache();
    expect(backing.has(STORE)).toBe(false);
  });

  it("does not throw when storage is blocked, and has nobody to keep for when signed out", async () => {
    blocked = true;
    const persister = createKeptCache("u1");
    await expect(persister.persistClient(state([]))).resolves.toBeUndefined();
    await expect(persister.restoreClient()).resolves.toBeUndefined();
    await expect(clearKeptCache()).resolves.toBeUndefined();
    expect(await createKeptCache(null).restoreClient()).toBeUndefined();
  });
});
