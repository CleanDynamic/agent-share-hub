// UX-08 P4: Builds counts still-open topics. A build matches the Still open lens and filter when it has an open request or a
// still-open topic that attaches it or is about it, in the same number of requests; the Open column shows that count; and until the
// database has the two computed columns the reads are made again as they were (open requests alone).

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let response: { data: unknown[]; error: unknown; count: number | null } = { data: [], error: null, count: 0 };
let queue: (typeof response)[] = [];

function builder() {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "or", "overlaps", "contains", "order", "limit", "range", "eq", "gte", "lt", "lte", "ilike"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => Promise.resolve(queue.length > 0 ? queue.shift() : response).then(resolve);
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder();
    },
  },
}));

import { countGalleryLenses, listBuildsTable, resetBuildsCountColumns } from "@/lib/build/gallery";

const call = (method: string) => calls.filter((entry) => entry.method === method);

const BUILD = {
  id: "b1", slug: "inbox", title: "Inbox triage", shape: "prompt", made_with: [], reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null,
  published_at: "2026-09-01T00:00:00Z", rebuild_count: 0, maker: { username: "kit", display_name: "Kit" },
};

beforeEach(() => {
  resetBuildsCountColumns();
  calls = [];
  queue = [];
  response = { data: [], error: null, count: 0 };
});

describe("UX-08 P4 · the Table", () => {
  it("a build with only a still-open topic is in the lens, and shows 1 in Open", async () => {
    response = { data: [{ ...BUILD, bounties: [], still_open_topics: 1 }], error: null, count: 1 };
    const page = await listBuildsTable({ lens: "unsolved" });
    expect(call("from")).toHaveLength(1);
    expect(call("eq")).toContainEqual({ method: "eq", args: ["has_open_ask", true] });
    expect(page.total).toBe(1);
    expect(page.builds[0].open).toEqual({ count: 1, reward: null });
  });

  it("an open request and two still-open topics count three, in the one request", async () => {
    response = { data: [{ ...BUILD, bounties: [{ reward_gbp: 25 }], still_open_topics: 2 }], error: null, count: 1 };
    const page = await listBuildsTable({ openBounties: true });
    expect(call("from")).toHaveLength(1);
    expect(page.builds[0].open).toEqual({ count: 3, reward: 25 });
  });

  it("a build with only an open request still counts as before", async () => {
    response = { data: [{ ...BUILD, bounties: [{ reward_gbp: 40 }], still_open_topics: 0 }], error: null, count: 1 };
    const page = await listBuildsTable({ lens: "unsolved" });
    expect(page.builds[0].open).toEqual({ count: 1, reward: 40 });
  });

  it("before the migration: reads again with the open-request join, says so once, and does not ask again", async () => {
    queue = [
      { data: [], error: { code: "42703", message: "column builds.has_open_ask does not exist" }, count: null },
      { data: [{ ...BUILD, bounties: [{ reward_gbp: null }] }], error: null, count: 1 },
    ];
    const page = await listBuildsTable({ lens: "unsolved" });
    const asked = call("select").map((entry) => entry.args[0] as string);
    expect(asked).toHaveLength(2);
    expect(asked[0]).toContain("still_open_topic_count");
    expect(asked[1]).not.toContain("still_open_topic_count");
    expect(asked[1]).toContain("bounties!bounties_build_id_fkey!inner(");
    expect(page.builds[0].open.count).toBe(1);

    calls = [];
    await listBuildsTable({ lens: "unsolved" });
    expect(call("select")).toHaveLength(1);
    expect(call("select")[0].args[0]).toContain("!inner(");
    expect(call("eq").map((entry) => entry.args[0])).not.toContain("has_open_ask");
  });
});

describe("UX-08 P4 · the lens counts", () => {
  it("the Still open lens is counted by has_open_ask; the others are counted as before; one request per lens", async () => {
    response = { data: [], error: null, count: 4 };
    const counts = await countGalleryLenses();
    expect(call("from")).toHaveLength(4);
    expect(call("eq").filter((entry) => entry.args[0] === "has_open_ask")).toHaveLength(1);
    expect(call("select").filter((entry) => String(entry.args[0]).includes("!inner"))).toHaveLength(0);
    expect(counts.unsolved).toBe(4);
  });

  it("before the migration: the Still open lens is counted by open requests, as it was", async () => {
    response = { data: [], error: null, count: 2 };
    queue = [
      { data: [], error: null, count: 9 },
      { data: [], error: null, count: 9 },
      { data: [], error: null, count: 9 },
      { data: [], error: { code: "42703", message: "column builds.has_open_ask does not exist" }, count: null },
    ];
    const counts = await countGalleryLenses();
    expect(counts.unsolved).toBe(2);
    expect(call("select").some((entry) => String(entry.args[0]).includes("bounties!bounties_build_id_fkey!inner(id)"))).toBe(true);
  });
});
