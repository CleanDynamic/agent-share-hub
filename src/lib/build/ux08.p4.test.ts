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
    response = { data: [{ ...BUILD, still_open_topics: 1 }], error: null, count: 1 };
    const page = await listBuildsTable({ lens: "unsolved" });
    expect(call("from")).toHaveLength(1);
    expect(call("eq")).toContainEqual({ method: "eq", args: ["has_open_ask", true] });
    expect(page.total).toBe(1);
    expect(page.builds[0].open).toEqual({ count: 1 });
  });

  it("two still-open topics count two, in the one request, with the filter beside another lens", async () => {
    response = { data: [{ ...BUILD, still_open_topics: 2 }], error: null, count: 1 };
    const page = await listBuildsTable({ stillOpen: true });
    expect(call("from")).toHaveLength(1);
    expect(page.builds[0].open).toEqual({ count: 2 });
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
});
