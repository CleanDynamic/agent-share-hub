// SV-10: Home's two new reads. A stand-in for the PostgREST builder records every call per table, and answers each table
// with the rows given, so the claims are about what is asked for, in how many requests, and what comes back.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let rows: Record<string, unknown[]> = {};

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "eq", "gte", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      calls.push({ table, method: "from", args: [] });
      return builder(table);
    },
  },
}));

import { getGalleryBuildsByIds } from "@/lib/build/gallery";
import { listMostReproduced, MOST_REPRODUCED_ROWS_CAP } from "@/lib/build/signals";

const requests = (table: string) => calls.filter((call) => call.table === table && call.method === "from").length;
const of = (table: string, method: string) => calls.filter((call) => call.table === table && call.method === method);

beforeEach(() => {
  calls = [];
  rows = {};
});

describe("getGalleryBuildsByIds", () => {
  it("reads the posts in one request, with post_doc, the classification and the counts, in the order asked", async () => {
    rows.builds = [
      { id: "b", title: "B", post_doc: { type: "doc", content: [] }, models_used: null, like_count: 3, comment_count: 1, build_nodes: [], build_media: [], bounties: [] },
      { id: "a", title: "A", post_doc: null, models_used: ["claude"], build_nodes: [], build_media: [], bounties: [] },
    ];
    const out = await getGalleryBuildsByIds(["a", "b", "a", "gone"]);

    expect(requests("builds")).toBe(1);
    const select = String(of("builds", "select")[0].args[0]);
    expect(select).toContain("post_doc");
    expect(select).toContain("classification");
    expect(select).toContain("like_count");
    expect(of("builds", "in")[0].args).toEqual(["id", ["a", "b", "gone"]]);
    expect(of("builds", "limit").at(-1)?.args).toEqual([3]);
    expect(out.map((row) => row.id)).toEqual(["a", "b"]);
    expect(out[0].models_used).toEqual(["claude"]);
    expect(out[1]).toMatchObject({ models_used: [], engagement: { likes: 3, comments: 1 } });
  });

  it("asks nothing for no ids", async () => {
    await expect(getGalleryBuildsByIds([])).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe("listMostReproduced", () => {
  const since = new Date("2026-10-12T00:00:00Z");

  it("counts the window's runs by build in two requests, most first, published builds only", async () => {
    rows.build_reproductions = [{ build_id: "x" }, { build_id: "y" }, { build_id: "x" }, { build_id: "z" }, { build_id: "x" }, { build_id: "y" }];
    rows.builds = [
      { id: "x", slug: "x-slug", title: "X", creator_id: "cx", maker: { username: "kit", display_name: "Kit", avatar_url: null } },
      { id: "z", slug: "z-slug", title: "Z", creator_id: "cz", maker: null },
    ];
    const out = await listMostReproduced({ since, limit: 2 });

    expect(requests("build_reproductions")).toBe(1);
    expect(requests("builds")).toBe(1);
    expect(of("build_reproductions", "gte")[0].args).toEqual(["created_at", since.toISOString()]);
    expect(of("build_reproductions", "limit")[0].args).toEqual([MOST_REPRODUCED_ROWS_CAP]);
    expect(of("builds", "in").map((call) => call.args)).toEqual([
      ["id", ["x", "y", "z"]],
      ["status", ["published", "gallery"]],
    ]);
    // y is not readable (a draft): the list moves on to z.
    expect(out).toEqual([
      { buildId: "x", slug: "x-slug", title: "X", creatorId: "cx", maker: { handle: "kit", name: "Kit", avatarUrl: null }, count: 3 },
      { buildId: "z", slug: "z-slug", title: "Z", creatorId: "cz", maker: { handle: null, name: null, avatarUrl: null }, count: 1 },
    ]);
  });

  it("asks for no builds when nothing was run", async () => {
    await expect(listMostReproduced({ since })).resolves.toEqual([]);
    expect(requests("builds")).toBe(0);
  });
});
