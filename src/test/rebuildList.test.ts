// Acceptance cover for the rebuild read functions (NS-P40).
//
// Same level as gallery.test.ts next door, and for the same reason: the
// database is not reachable from a unit test, so what is asserted is the
// REQUEST — the columns named, the filter, the order and the cap. Those are the
// claims the tab and the markers rest on. If listRebuilds asked for '*', or
// counted drafts, or forgot the limit, nothing rendering it would notice.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let response: { data: unknown[]; error: unknown; count: number | null } = {
  data: [],
  error: null,
  count: 0,
};

function builder() {
  const self: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return self;
    };

  for (const method of ["select", "eq", "in", "order", "limit"]) {
    self[method] = chain(method);
  }
  self.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve);
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

import { REBUILDS_PAGE_SIZE, countRebuilds, listRebuilds } from "@/lib/build/rebuild";

function call(method: string): Recorded[] {
  return calls.filter((entry) => entry.method === method);
}

const SOURCE = "11111111-0000-4000-8000-000000000001";

beforeEach(() => {
  calls = [];
  response = { data: [], error: null, count: 0 };
});

describe("listRebuilds", () => {
  it("reads the published children of one build, newest first, capped", async () => {
    await listRebuilds(SOURCE);

    expect(call("from").map((entry) => entry.args[0])).toEqual(["builds"]);

    const columns = call("select")[0].args[0] as string;
    expect(columns).not.toContain("*");
    for (const column of [
      "slug",
      "title",
      "rebuild_note",
      "created_at",
      "forked_from_event_id",
      "reproduction_count",
    ]) {
      expect(columns).toContain(column);
    }

    // The parent is named through the indexed column NS-P36 created for it.
    expect(call("eq")[0].args).toEqual(["parent_build_id", SOURCE]);

    // A draft fork of your build is the forker's business, not your page's.
    // 'gallery' is a promoted published build, so it counts as published.
    const statuses = call("in").find((entry) => entry.args[0] === "status");
    expect(statuses?.args[1]).toEqual(["published", "gallery"]);

    expect(call("order")[0].args).toEqual(["created_at", { ascending: false }]);
    expect(call("limit")[0].args[0]).toBe(REBUILDS_PAGE_SIZE);
  });

  it("takes a limit, and never one above the page size", async () => {
    await listRebuilds(SOURCE, { limit: 3 });
    expect(call("limit")[0].args[0]).toBe(3);

    calls = [];
    await listRebuilds(SOURCE, { limit: 500 });
    expect(call("limit")[0].args[0]).toBe(REBUILDS_PAGE_SIZE);

    calls = [];
    await listRebuilds(SOURCE, { limit: 0 });
    expect(call("limit")[0].args[0]).toBe(1);
  });

  it("embeds the creator through the named foreign key", async () => {
    await listRebuilds(SOURCE);
    const columns = call("select")[0].args[0] as string;

    // The hint is load-bearing: builds.creator_id resolves to both `profiles`
    // and the `profile_stats` view, and PostgREST refuses the ambiguity.
    expect(columns).toContain("creator:profiles!builds_creator_id_fkey(");
    expect(columns).toContain("username");
    expect(columns).toContain("display_name");
    expect(columns).toContain("avatar_url");
  });

  it("hands back the creator whether the embed arrives as an object or a list", async () => {
    const creator = { id: "u2", username: "sam", display_name: "Sam", avatar_url: null };
    response = {
      data: [
        { id: "r1", slug: "a", title: "A", creator, rebuild_note: null, created_at: "", forked_from_event_id: null, reproduction_count: 0 },
        { id: "r2", slug: "b", title: "B", creator: [creator], rebuild_note: null, created_at: "", forked_from_event_id: null, reproduction_count: 0 },
        { id: "r3", slug: "c", title: "C", creator: null, rebuild_note: null, created_at: "", forked_from_event_id: null, reproduction_count: 0 },
      ],
      error: null,
      count: 3,
    };

    const rebuilds = await listRebuilds(SOURCE);
    expect(rebuilds.map((rebuild) => rebuild.creator?.username ?? null)).toEqual([
      "sam",
      "sam",
      null,
    ]);
  });

  it("throws through the build layer's error shape", async () => {
    response = { data: [], error: { message: "boom" }, count: null };
    await expect(listRebuilds(SOURCE)).rejects.toThrow(/listRebuilds/);
  });
});

describe("countRebuilds", () => {
  it("counts without reading rows, and estimates rather than locking the set", async () => {
    response = { data: [], error: null, count: 4 };
    expect(await countRebuilds(SOURCE)).toBe(4);

    const [columns, options] = call("select")[0].args as [string, Record<string, unknown>];
    expect(columns).toBe("id");
    expect(options).toEqual({ count: "estimated", head: true });
    expect(call("eq")[0].args).toEqual(["parent_build_id", SOURCE]);
    expect(call("in")[0].args[1]).toEqual(["published", "gallery"]);
  });

  it("is zero, not null, when the count comes back empty", async () => {
    response = { data: [], error: null, count: null };
    expect(await countRebuilds(SOURCE)).toBe(0);
  });
});
