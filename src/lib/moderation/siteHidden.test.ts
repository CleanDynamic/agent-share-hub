// UX-09 Q5: the site's hide, the data layer. The admin's list is one request, newest hide first; Unhide clears only the site's
// column; the author's notice is the RPC's answer; and before the migration every read says nothing was hidden.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let answer: (table: string) => { data: unknown; error: unknown; status?: number } = () => ({ data: [], error: null });
let session: { user: { id: string } } | null = { user: { id: "admin-1" } };

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "update", "eq", "not", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(answer(table)).then(resolve, reject);
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: (fn: string, params: unknown) => {
      calls.push({ table: `rpc:${fn}`, method: "rpc", args: [params] });
      return Promise.resolve(answer(`rpc:${fn}`));
    },
    auth: { getSession: vi.fn(async () => ({ data: { session } })) },
  },
}));

import { listSiteHiddenPosts, siteHiddenPostsOf, unhideForSite } from "./siteHidden";

const of = (method: string) => calls.filter((call) => call.method === method);

beforeEach(() => {
  calls = [];
  session = { user: { id: "admin-1" } };
  answer = () => ({ data: [], error: null });
});

describe("listSiteHiddenPosts", () => {
  it("reads what the site hid, newest hide first, limited, each linked", async () => {
    answer = () => ({
      data: [
        { id: "x1", root_id: "p1", parent_id: "p1", body: "  spam spam\\nmore", site_hidden_at: "2026-11-05T10:00:00Z" },
        { id: "p2", root_id: "p2", parent_id: null, body: "", site_hidden_at: null },
      ],
      error: null,
    });
    const rows = await listSiteHiddenPosts();
    expect(of("not")[0].args).toEqual(["site_hidden_by", "is", null]);
    expect(of("order")[0].args).toEqual(["site_hidden_at", { ascending: false }]);
    expect(of("limit")[0].args).toEqual([50]);
    expect(rows.map((row) => [row.kind, row.href])).toEqual([
      ["reply", "/openbuilds/topics/p1#reply-x1"],
      ["topic", "/openbuilds/topics/p2"],
    ]);
    expect(rows[1].text).toBe("A topic");
  });

  it("says nothing was hidden before the migration (no such column)", async () => {
    answer = () => ({ data: null, error: { code: "42703" }, status: 400 });
    await expect(listSiteHiddenPosts()).resolves.toEqual([]);
  });

  it("throws on any other failure", async () => {
    answer = () => ({ data: null, error: { code: "42501" }, status: 403 });
    await expect(listSiteHiddenPosts()).rejects.toMatchObject({ kind: "no_access" });
  });
});

describe("unhideForSite", () => {
  it("clears only the site's hide", async () => {
    await unhideForSite("x1");
    expect(of("update")[0].args).toEqual([{ site_hidden_by: null }]);
    expect(of("eq")[0].args).toEqual(["id", "x1"]);
  });
});

describe("siteHiddenPostsOf", () => {
  it("asks the RPC about this topic, for the signed-in reader", async () => {
    session = { user: { id: "rob" } };
    answer = () => ({ data: [{ id: "x1", parent_id: "p1", heading: " A bad reply ", hidden_at: null }], error: null });
    await expect(siteHiddenPostsOf("p1")).resolves.toEqual([{ id: "x1", kind: "reply", heading: "A bad reply" }]);
    expect(of("rpc")[0]).toMatchObject({ table: "rpc:site_hidden_posts_of", args: [{ _root: "p1" }] });
  });

  it("asks nothing signed out, and says nothing before the migration", async () => {
    session = null;
    await expect(siteHiddenPostsOf("p1")).resolves.toEqual([]);
    expect(of("rpc")).toEqual([]);
    session = { user: { id: "rob" } };
    answer = () => ({ data: null, error: { code: "PGRST202" }, status: 404 });
    await expect(siteHiddenPostsOf("p1")).resolves.toEqual([]);
  });
});
