// listGalleryFeed against a stand-in for the PostgREST builder. Each request is
// recorded with its table and calls, and answered by a responder per table.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Request {
  table: string;
  calls: { method: string; args: unknown[] }[];
}

let requests: Request[] = [];
let respond: (request: Request) => { data: unknown; count?: number | null };
let rpcCalled = false;

function builder(request: Request) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "or", "eq", "ilike", "overlaps", "order", "limit", "range"]) {
    self[method] = (...args: unknown[]) => {
      request.calls.push({ method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ error: null, count: null, ...respond(request) }).then(resolve);
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const request: Request = { table, calls: [] };
      requests.push(request);
      return builder(request);
    },
    rpc: () => {
      rpcCalled = true;
      return Promise.resolve({ data: [], error: null });
    },
  },
}));

import { FEED_PAGE_SIZE, listGalleryFeed } from "@/lib/build/gallery";

const callsOf = (request: Request, method: string) => request.calls.filter((c) => c.method === method);
const on = (table: string) => requests.filter((r) => r.table === table);
const isCards = (r: Request) =>
  r.table === "builds" && String(callsOf(r, "select")[0]?.args[0]).includes("build_nodes");

function card(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    creator_id: `u-${id}`,
    slug: id,
    title: `Build ${id}`,
    outcome: "An outcome",
    shape: "app",
    status: "gallery",
    made_for: ["lawyers"],
    made_with: [],
    models_used: ["Sonnet 5.5"],
    reproduction_count: 0,
    rebuild_count: 0,
    last_confirmed_at: null,
    published_at: "2026-09-01T00:00:00Z",
    build_nodes: [],
    build_media: [],
    bounties: [],
    ...extra,
  };
}

beforeEach(() => {
  requests = [];
  rpcCalled = false;
  respond = () => ({ data: [] });
});

describe("listGalleryFeed without a model", () => {
  it("reads gallery builds on the shared card select with models_used, newest first, 24 a page", async () => {
    const rows = Array.from({ length: FEED_PAGE_SIZE + 1 }, (_, i) => card(`b${i}`));
    respond = (r) => {
      if (isCards(r)) return { data: rows };
      if (r.table === "profiles") return { data: [{ id: "u-b0", username: "ada" }] };
      if (r.table === "build_reproductions") return { data: [{ build_id: "b0", model_used: "claude-sonnet-5-5", worked: true, confirmed_at: "2026-09-02T00:00:00Z" }] };
      if (r.table === "builds") return { data: [{ id: "b0" }], count: 7 };
      return { data: [] };
    };

    const feed = await listGalleryFeed({ sort: "newest", page: 0 });
    if (feed.kind !== "all") throw new Error("expected the one-list shape");

    const cards = requests.filter(isCards);
    expect(cards).toHaveLength(1);
    const select = String(callsOf(cards[0], "select")[0].args[0]);
    expect(select).toContain("build_nodes!build_nodes_build_id_fkey");
    expect(select).toContain("models_used");
    expect(callsOf(cards[0], "in").map((c) => c.args)).toContainEqual(["status", ["published", "gallery"]]);
    expect(String(callsOf(cards[0], "or")[0].args[0])).toContain("status.eq.gallery");
    expect(callsOf(cards[0], "order")[0].args).toEqual(["published_at", { ascending: false, nullsFirst: false }]);
    expect(callsOf(cards[0], "range")[0].args).toEqual([0, FEED_PAGE_SIZE]);

    expect(feed.rows).toHaveLength(FEED_PAGE_SIZE);
    expect(feed.hasMore).toBe(true);
    expect(feed.rows[0]).toMatchObject({
      outcome: "An outcome",
      made_for: ["lawyers"],
      models_used: ["Sonnet 5.5"],
      creatorHandle: "ada",
    });
    expect(feed.rows[1].creatorHandle).toBeNull();
    expect(feed.rows[0].proof).toEqual([
      { modelId: "sonnet-5-5", modelName: "Sonnet 5.5", worked: 1, lastConfirmedAt: "2026-09-02T00:00:00Z" },
    ]);
    expect(feed.counts).toEqual({ all: 7, byModel: { "sonnet-5-5": 1 } });

    // one handle lookup and one proof read for the page (the counts read is the other proof read)
    expect(on("profiles")).toHaveLength(1);
    expect(on("build_reproductions")).toHaveLength(2);
    expect(rpcCalled).toBe(false);
  });

  it.each([
    ["reproduced", ["reproduction_count", "last_confirmed_at", "published_at"]],
    ["confirmed", ["last_confirmed_at", "published_at"]],
    ["rebuilt", ["rebuild_count", "published_at"]],
  ] as const)("orders %s in the database", async (sort, columns) => {
    await listGalleryFeed({ sort, page: 2 });
    const cards = requests.filter(isCards)[0];
    expect(callsOf(cards, "order").map((c) => c.args[0])).toEqual([...columns, "id", "position"]);
    expect(callsOf(cards, "range")[0].args).toEqual([2 * FEED_PAGE_SIZE, 3 * FEED_PAGE_SIZE]);
  });

  it("UI-P49: counts the matching builds on the page's own read", async () => {
    respond = (r) => (isCards(r) ? { data: [card("b0")], count: 31 } : { data: [] });
    const feed = await listGalleryFeed({ sort: "newest", page: 0 });
    if (feed.kind !== "all") throw new Error("expected the one-list shape");
    expect(callsOf(requests.filter(isCards)[0], "select")[0].args[1]).toEqual({ count: "exact" });
    expect(feed.total).toBe(31);
  });

  it("narrows by audience", async () => {
    await listGalleryFeed({ sort: "newest", page: 0, audience: "lawyers" });
    expect(callsOf(requests.filter(isCards)[0], "overlaps")[0].args).toEqual(["made_for", ["lawyers"]]);
  });
});

describe("the interim search", () => {
  it("matches title and outcome, a named model, and handles, without the RPC", async () => {
    respond = (r) => (r.table === "profiles" ? { data: [{ id: "u1" }, { id: "u2" }] } : { data: [] });
    await listGalleryFeed({ sort: "newest", page: 0, q: "sonnet-5.5" });

    const handle = on("profiles")[0];
    expect(callsOf(handle, "ilike")[0].args).toEqual(["username", "%sonnet-5.5%"]);
    expect(callsOf(handle, "limit")[0].args).toEqual([20]);

    const cards = requests.filter(isCards)[0];
    const clause = String(callsOf(cards, "or")[1].args[0]);
    expect(clause).toContain("title.ilike.%sonnet-5.5%");
    expect(clause).toContain("outcome.ilike.%sonnet-5.5%");
    expect(clause).toContain('models_used.cs.{"Sonnet 5.5"}');
    expect(clause).toContain("creator_id.in.(u1,u2)");
    expect(rpcCalled).toBe(false);
  });

  it("strips characters that would break the filter, and ignores a query under two characters", async () => {
    await listGalleryFeed({ sort: "newest", page: 0, q: "a,b) or (c%" });
    const clause = String(callsOf(requests.filter(isCards)[0], "or")[1].args[0]);
    expect(clause).toContain("title.ilike.%a b or c%");
    expect(on("profiles")).toHaveLength(0);

    requests = [];
    await listGalleryFeed({ sort: "newest", page: 0, q: "x" });
    expect(callsOf(requests.filter(isCards)[0], "or")).toHaveLength(1);
  });
});

describe("listGalleryFeed with a model", () => {
  it("finds worked reproductions by alias, confirms them in the app and sorts by that model's figures", async () => {
    const opus5 = "claude-opus-5-5";
    respond = (r) => {
      const select = String(callsOf(r, "select")[0]?.args[0]);
      if (r.table === "build_reproductions" && select === "build_id, model_used") {
        return {
          data: [
            { build_id: "a", model_used: opus5 },
            { build_id: "b", model_used: "Opus 5.5" },
            { build_id: "z", model_used: "claude-opus-5" }, // an ilike over-match: Opus 5, not Opus 5.5
          ],
        };
      }
      if (r.table === "build_reproductions") {
        return {
          data: [
            { build_id: "a", model_used: opus5, worked: true, confirmed_at: "2026-09-01T00:00:00Z" },
            { build_id: "b", model_used: "Opus 5.5", worked: true, confirmed_at: "2026-09-20T00:00:00Z" },
            { build_id: "b", model_used: "Opus 5.5", worked: true, confirmed_at: "2026-09-21T00:00:00Z" },
          ],
        };
      }
      if (r.table === "profiles") return { data: [] };
      if (isCards(r)) {
        const ids = callsOf(r, "in").find((c) => c.args[0] === "id")!.args[1] as string[];
        return { data: ids.map((id) => card(id)) };
      }
      if (select.startsWith("id, published_at")) {
        return { data: [card("a", { published_at: "2026-09-10T00:00:00Z" }), card("b", { published_at: "2026-08-01T00:00:00Z" })] };
      }
      return { data: ["a", "b", "c", "d"].map((id) => ({ id })) };
    };

    const feed = await listGalleryFeed({ model: "opus-5-5", sort: "reproduced", page: 0 });
    if (feed.kind !== "model") throw new Error("expected the two-list shape");

    const repro = on("build_reproductions").find((r) => callsOf(r, "select")[0].args[0] === "build_id, model_used")!;
    expect(callsOf(repro, "eq")[0].args).toEqual(["worked", true]);
    expect(String(callsOf(repro, "or")[0].args[0])).toContain("model_used.ilike.%claude-opus-5-5%");
    expect(callsOf(repro, "limit")[0].args).toEqual([500]);

    // b has two worked on Opus 5.5 and a has one: b leads on `reproduced` though a is newer.
    expect(feed.reproducedOn.map((r) => r.id)).toEqual(["b", "a"]);
    expect(feed.notYet.map((r) => r.id)).toEqual(["c", "d"]);
    expect(feed.hasMoreReproducedOn).toBe(false);
    expect(feed.hasMoreNotYet).toBe(false);
    // UI-P49: each list says how many it holds, for its heading.
    expect(feed.totalReproducedOn).toBe(2);
    expect(feed.totalNotYet).toBe(2);
    expect(feed.reproducedOn[0].proof[0]).toMatchObject({ modelId: "opus-5-5", worked: 2 });
  });

  it("sorts reproducedOn by that model's newest confirmation under `confirmed`", async () => {
    respond = (r) => {
      const select = String(callsOf(r, "select")[0]?.args[0]);
      if (r.table === "build_reproductions" && select === "build_id, model_used") {
        return { data: [{ build_id: "a", model_used: "Opus 5.5" }, { build_id: "b", model_used: "Opus 5.5" }] };
      }
      if (r.table === "build_reproductions") {
        return {
          data: [
            { build_id: "a", model_used: "Opus 5.5", worked: true, confirmed_at: "2026-09-25T00:00:00Z" },
            { build_id: "b", model_used: "Opus 5.5", worked: true, confirmed_at: "2026-09-05T00:00:00Z" },
          ],
        };
      }
      if (isCards(r)) {
        const ids = callsOf(r, "in").find((c) => c.args[0] === "id")!.args[1] as string[];
        return { data: ids.map((id) => card(id)) };
      }
      if (select.startsWith("id, published_at")) return { data: [card("b"), card("a")] };
      return { data: [] };
    };
    const feed = await listGalleryFeed({ model: "opus-5-5", sort: "confirmed", page: 0 });
    if (feed.kind !== "model") throw new Error("expected the two-list shape");
    expect(feed.reproducedOn.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("ignores a model id the registry does not name", async () => {
    const feed = await listGalleryFeed({ model: "nope", sort: "newest", page: 0 });
    expect(feed.kind).toBe("all");
  });
});
