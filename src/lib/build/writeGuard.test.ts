// CA-23 P2: writes held while offline, kept across a reload, replayed first and in order; reads wait behind them.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createConnection } from "./connection";
import { createWriteGuard, guardedTarget, pendingKey, withStamp, type HeldWrite, type StorageLike } from "./writeGuard";

const REST = "https://x.supabase.co/rest/v1";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const flush = async () => {
  for (let n = 0; n < 12; n += 1) await Promise.resolve();
};

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

function setup(options: { online?: boolean; storage?: StorageLike; base?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } = {}) {
  let on = options.online ?? true;
  const handlers: Record<string, Set<() => void>> = { online: new Set(), offline: new Set() };
  const connection = createConnection({
    onLine: () => on,
    ping: async () => on,
    listen: (event, handler) => {
      handlers[event].add(handler);
      return () => void handlers[event].delete(handler);
    },
  });
  connection.start();
  const sent: { method: string; url: string; body: string | null; headers: Headers }[] = [];
  const base = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (options.base) return options.base(input, init);
    sent.push({ method: init?.method ?? "GET", url: String(input), body: typeof init?.body === "string" ? init.body : null, headers: new Headers(init?.headers) });
    return json([{ id: "r", updated_at: "S1" }]);
  });
  const storage = options.storage ?? memory();
  const conflicts: HeldWrite[] = [];
  const guard = createWriteGuard({ buildId: "b1", baseFetch: base as unknown as typeof fetch, connection, storage, onConflict: (held) => void conflicts.push(held) });
  return {
    guard,
    base,
    sent,
    storage: storage as ReturnType<typeof memory>,
    conflicts,
    connection,
    go: (next: boolean) => {
      on = next;
      for (const handler of [...handlers[next ? "online" : "offline"]]) handler();
    },
  };
}

const write = (guard: { fetch: typeof fetch }, table: string, body: unknown, method = "POST", query = "") =>
  guard.fetch(`${REST}/${table}${query}`, { method, headers: { "content-type": "application/json", prefer: "return=representation", apikey: "k", authorization: "Bearer t" }, body: JSON.stringify(body) });

beforeEach(() => vi.useRealTimers());

describe("what is guarded", () => {
  it("names the composer's tables and the post's pictures function, and nothing else", () => {
    expect(guardedTarget(`${REST}/builds?id=eq.1`)).toEqual({ kind: "table", name: "builds" });
    expect(guardedTarget(`${REST}/build_nodes`)).toEqual({ kind: "table", name: "build_nodes" });
    expect(guardedTarget(`${REST}/rpc/set_build_post_media`)).toEqual({ kind: "rpc", name: "set_build_post_media" });
    expect(guardedTarget(`${REST}/rpc/gallery_facets`)).toBeNull();
    expect(guardedTarget(`${REST}/profiles`)).toBeNull();
    expect(guardedTarget("https://x.supabase.co/storage/v1/object/b/x")).toBeNull();
  });

  it("lets everything else straight through, offline or not", async () => {
    const { guard, base, go } = setup({ online: false });
    go(false);
    await guard.fetch(`${REST}/profiles`, { method: "POST", body: "{}" });
    expect(base).toHaveBeenCalledTimes(1);
    expect(guard.held()).toHaveLength(0);
  });

  it("lets a file go straight through: only a body that can be written down is held", async () => {
    const { guard, base } = setup({ online: false });
    await guard.fetch(`${REST}/build_media`, { method: "POST", body: new Blob(["x"]) });
    expect(base).toHaveBeenCalledTimes(1);
  });
});

describe("online", () => {
  it("sends a write at once and holds nothing", async () => {
    const { guard, sent } = setup();
    const response = await write(guard, "build_nodes", [{ id: "n1" }]);
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(guard.held()).toHaveLength(0);
  });
});

describe("offline", () => {
  it("holds writes in order, keeps them in localStorage under bg:pending:{buildId}, and sends them in order on reconnect", async () => {
    const { guard, sent, storage, go } = setup({ online: false });
    const first = write(guard, "build_nodes", [{ id: "n1", title: "one" }], "POST");
    const second = write(guard, "builds", { title: "two" }, "PATCH", "?id=eq.b1");
    const third = write(guard, "build_nodes", [{ id: "n3", title: "three" }], "POST");
    await flush();
    expect(sent).toHaveLength(0);
    expect(guard.held().map((held) => held.method)).toEqual(["POST", "PATCH", "POST"]);
    const kept = JSON.parse(storage.data.get(pendingKey("b1")) as string) as HeldWrite[];
    expect(kept).toHaveLength(3);
    // The client's own key and token are not kept: a replay gets fresh ones.
    expect(kept[0].headers.map(([name]) => name.toLowerCase())).not.toContain("authorization");
    expect(kept[0].headers.map(([name]) => name.toLowerCase())).not.toContain("apikey");

    go(true);
    const [a, b, c] = await Promise.all([first, second, third]);
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
    expect(sent.map((request) => request.body)).toEqual([JSON.stringify([{ id: "n1", title: "one" }]), JSON.stringify({ title: "two" }), JSON.stringify([{ id: "n3", title: "three" }])]);
    expect(storage.data.has(pendingKey("b1"))).toBe(false);
    expect(guard.held()).toHaveLength(0);
  });

  it("goes on holding behind a line that is still being sent, so order is kept after the connection is back", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => void (release = resolve));
    const order: string[] = [];
    const { guard, go } = setup({
      online: false,
      base: async (_input, init) => {
        order.push(String(init?.body));
        if (order.length === 1) await gate;
        return json([{ id: "r" }]);
      },
    });
    const first = write(guard, "build_nodes", { n: 1 });
    await flush();
    go(true);
    await flush();
    const second = write(guard, "build_nodes", { n: 2 });
    await flush();
    expect(order).toEqual([JSON.stringify({ n: 1 })]);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual([JSON.stringify({ n: 1 }), JSON.stringify({ n: 2 })]);
  });

  it("answers the caller with the real response, so the code that wrote is none the wiser", async () => {
    const { guard, go } = setup({ online: false, base: async () => json({ id: "n1", title: "kept" }, 201) });
    const pending = write(guard, "build_nodes", { id: "n1" });
    await flush();
    go(true);
    const response = await pending;
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "n1", title: "kept" });
  });
});

describe("a connection that drops mid-write", () => {
  it("holds the write that got no answer, says the connection is down, and loses nothing", async () => {
    let calls = 0;
    const { guard, connection, go, sent } = setup({
      base: async (input, init) => {
        calls += 1;
        if (calls === 1) throw new TypeError("Failed to fetch");
        sent.push({ method: init?.method ?? "GET", url: String(input), body: String(init?.body), headers: new Headers(init?.headers) });
        return json([{ id: "r" }]);
      },
    });
    const pending = write(guard, "build_nodes", [{ id: "n1" }]);
    await flush();
    expect(connection.isOffline()).toBe(true);
    expect(guard.held()).toHaveLength(1);
    go(true);
    expect((await pending).status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it("does not hold a write the database refused", async () => {
    const { guard } = setup({ base: async () => json({ code: "23514", message: "no" }, 400) });
    const response = await write(guard, "builds", { title: "x" }, "PATCH", "?id=eq.b1");
    expect(response.status).toBe(400);
    expect(guard.held()).toHaveLength(0);
  });
});

describe("a reload", () => {
  const kept: HeldWrite[] = [
    { id: "a", at: 1, method: "POST", url: `${REST}/build_nodes`, headers: [["content-type", "application/json"]], body: JSON.stringify([{ id: "n1" }]) },
    { id: "b", at: 2, method: "PATCH", url: `${REST}/builds?id=eq.b1`, headers: [["content-type", "application/json"]], body: JSON.stringify({ title: "kept" }) },
  ];

  it("replays what the last visit kept, in order, before anything is read", async () => {
    const storage = memory();
    storage.setItem(pendingKey("b1"), JSON.stringify(kept));
    const calls: string[] = [];
    const { guard } = setup({
      storage,
      base: async (input, init) => {
        calls.push(`${init?.method ?? "GET"} ${new URL(String(input)).pathname.split("/").pop()}`);
        return json([{ id: "x" }]);
      },
    });
    // The page reads the build as soon as it opens: that read waits behind the replay (it counts as read once the page has read).
    await guard.fetch(`${REST}/builds?id=eq.b1&select=id`, { method: "GET" });
    await guard.settled();
    expect(calls).toEqual(["POST build_nodes", "PATCH builds", "GET builds"]);
    expect(storage.getItem(pendingKey("b1"))).toBeNull();
  });

  it("counts what was kept as waiting, with nobody waiting on it, until it has gone", async () => {
    const storage = memory();
    storage.setItem(pendingKey("b1"), JSON.stringify(kept));
    const { guard, go } = setup({ online: false, storage });
    expect(guard.held()).toHaveLength(2);
    expect(guard.orphans()).toBe(2);
    go(true);
    await guard.settled();
    expect(guard.orphans()).toBe(0);
  });

  it("starts empty when what was kept cannot be read", () => {
    const storage = memory();
    storage.setItem(pendingKey("b1"), "{not json");
    expect(setup({ storage }).guard.held()).toHaveLength(0);
  });
});

describe("a write refused on replay", () => {
  it("moves each write's updated_at guard on to the stamp the write before it left, so a tab's own writes do not refuse each other", async () => {
    const seen: string[] = [];
    let stamp = 0;
    const { guard, go } = setup({
      online: false,
      base: async (input) => {
        seen.push(new URL(String(input)).searchParams.get("updated_at") as string);
        stamp += 1;
        return json({ id: "b1", updated_at: `S${stamp}` });
      },
    });
    const a = write(guard, "builds", { title: "a" }, "PATCH", "?id=eq.b1&updated_at=eq.S0");
    const b = write(guard, "builds", { title: "b" }, "PATCH", "?id=eq.b1&updated_at=eq.S0");
    await flush();
    go(true);
    await Promise.all([a, b]);
    expect(seen).toEqual(["eq.S0", "eq.S1"]);
  });

  it("hands one nobody is waiting on to onConflict, rather than writing it over the other tab's change", async () => {
    const storage = memory();
    storage.setItem(
      pendingKey("b1"),
      JSON.stringify([{ id: "a", at: 1, method: "PATCH", url: `${REST}/builds?id=eq.b1&updated_at=eq.S0`, headers: [], body: JSON.stringify({ title: "mine" }) }]),
    );
    const { guard, conflicts } = setup({ storage, base: async () => json({ code: "PGRST116", message: "0 rows" }, 406) });
    await guard.settled();
    await flush();
    expect(conflicts.map((held) => held.id)).toEqual(["a"]);
    expect(guard.held()).toHaveLength(0);
  });

  it("answers a caller still waiting with the refusal itself", async () => {
    const { guard, go } = setup({ online: false, base: async () => json({ code: "PGRST116" }, 406) });
    const pending = write(guard, "builds", { title: "x" }, "PATCH", "?id=eq.b1&updated_at=eq.S0");
    await flush();
    go(true);
    expect((await pending).status).toBe(406);
  });

  it("moves a guard on", () => {
    expect(withStamp(`${REST}/builds?id=eq.b1&updated_at=eq.S0`, "S9")).toContain("updated_at=eq.S9");
    expect(withStamp(`${REST}/builds?id=eq.b1`, "S9")).toBe(`${REST}/builds?id=eq.b1`);
  });
});

describe("reads", () => {
  it("wait for the line to go out once the page has read anything", async () => {
    const calls: string[] = [];
    const { guard, go } = setup({
      base: async (input, init) => {
        calls.push(`${init?.method ?? "GET"} ${new URL(String(input)).pathname.split("/").pop()}`);
        return json([{ id: "b1", title: "t", updated_at: "S0" }]);
      },
    });
    await guard.fetch(`${REST}/builds?id=eq.b1&select=id,title`, { method: "GET" });
    go(false);
    const pending = write(guard, "build_nodes", [{ id: "n1" }]);
    await flush();
    const read = guard.fetch(`${REST}/build_nodes?build_id=eq.b1`, { method: "GET" });
    await flush();
    expect(calls).toEqual(["GET builds"]);
    go(true);
    await Promise.all([pending, read]);
    expect(calls).toEqual(["GET builds", "POST build_nodes", "GET build_nodes"]);
  });

  it("answer the build's own row from the last read, with the held writes laid over it, while offline", async () => {
    const { guard, go } = setup({ base: async () => json({ id: "b1", title: "old", making: { a: 1 }, updated_at: "S0" }) });
    const url = `${REST}/builds?select=made_with,making&id=eq.b1`;
    await guard.fetch(url, { method: "GET" });
    go(false);
    void write(guard, "builds", { making: { a: 2 } }, "PATCH", "?id=eq.b1");
    await flush();
    const response = await guard.fetch(url, { method: "GET" });
    expect(await response.json()).toMatchObject({ id: "b1", title: "old" });
  });
});
