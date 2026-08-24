// Acceptance cover for the gallery query and the threshold behind it.
//
// The database is not reachable from a unit test, so this asserts on the
// REQUEST listGallery actually builds — the filters, the ordering, the embeds
// and the limit — against a stub that records every call PostgREST would have
// received. That is the level at which the claims in the handover live: one
// query, the filter applied in the query, the shape thresholds spelled out.
//
// The membership rule itself is asserted twice over: once as inGallery, the
// pure predicate a loaded build can be tested against, and once as the `or`
// string, which is the same rule expressed to the database. If those two ever
// disagree, a build shown on the page would not be a build the query returns.

import { beforeEach, describe, expect, it, vi } from "vitest";

/** Every call the query builder received, in order. */
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

/**
 * A stand-in for the PostgREST builder: every filter method records itself and
 * returns `this`, and awaiting it resolves the response. That is exactly the
 * shape supabase-js exposes, so listGallery is exercised unmodified.
 */
function builder() {
  const self: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return self;
    };

  for (const method of ["select", "in", "or", "overlaps", "order", "limit", "range", "eq"]) {
    self[method] = chain(method);
  }
  self.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve);
  return self;
}

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder();
    },
    rpc: (name: string, args: unknown) => {
      calls.push({ method: "rpc", args: [name, args] });
      return rpc(name, args);
    },
  },
}));

import {
  GALLERY_PAGE_SIZE,
  GALLERY_THRESHOLD,
  getGalleryFacets,
  inGallery,
  listGallery,
} from "@/lib/build/gallery";

function call(method: string): Recorded[] {
  return calls.filter((entry) => entry.method === method);
}

function firstArg(method: string): unknown {
  return call(method)[0]?.args[0];
}

describe("the gallery query", () => {
  beforeEach(() => {
    calls = [];
    response = { data: [], error: null, count: 0 };
    rpc.mockReset();
  });

  it("reads one table, with an explicit column list and a count", async () => {
    await listGallery();

    expect(call("from").map((entry) => entry.args[0])).toEqual(["builds"]);

    const [columns, options] = call("select")[0].args as [string, { count: string }];
    expect(columns).not.toContain("*");
    expect(columns).toContain("reproduction_count");
    expect(columns).toContain("completeness");
    // Monetisation and fork lineage are on the table and not on a card.
    expect(columns).not.toContain("monetisation_type");
    expect(columns).not.toContain("parent_build_id");
    // The count rides the same response, so pagination costs no second request.
    expect(options).toEqual({ count: "exact" });
  });

  it("embeds the nodes and media a card body reads, in the same request", async () => {
    await listGallery();
    const columns = call("select")[0].args[0] as string;

    // The foreign key hint is load-bearing: builds.hero_node_id makes a second
    // relationship to build_nodes, and PostgREST refuses the ambiguity.
    expect(columns).toContain("build_nodes!build_nodes_build_id_fkey(");
    expect(columns).toContain("build_media!build_media_build_id_fkey(");

    const limits = call("limit").map((entry) => entry.args[1]);
    expect(limits).toContainEqual({ referencedTable: "build_nodes" });
    expect(limits).toContainEqual({ referencedTable: "build_media" });
  });

  // ACCEPTANCE 2 and 3
  it("asks for published and gallery builds, and for each shape's threshold", async () => {
    await listGallery();

    const statuses = call("in").find((entry) => entry.args[0] === "status");
    expect(statuses?.args[1]).toEqual(["published", "gallery"]);

    const predicate = firstArg("or") as string;
    // Editorial promotion is included whatever the record scores.
    expect(predicate).toContain("status.eq.gallery");
    // Every shape names its own bar, because the bars are shape-relative.
    for (const [shape, threshold] of Object.entries(GALLERY_THRESHOLD)) {
      expect(predicate).toContain(`and(shape.eq.${shape},completeness.gte.${threshold})`);
    }
  });

  it("orders by reproductions, then freshness with nulls last, then published", async () => {
    await listGallery();

    const orders = call("order").filter(
      (entry) => !(entry.args[1] as { referencedTable?: string })?.referencedTable
    );
    expect(orders.map((entry) => entry.args[0])).toEqual([
      "reproduction_count",
      "last_confirmed_at",
      "published_at",
    ]);

    // The staleness down-weight IS the second key: among builds of equal
    // reproduction count, the one confirmed most recently leads.
    expect(orders[1].args[1]).toMatchObject({ ascending: false, nullsFirst: false });
  });

  // ACCEPTANCE 4
  it("applies a Made for filter in the query, against the GIN-indexed array", async () => {
    await listGallery({ madeFor: ["lawyer"] });

    const overlaps = call("overlaps");
    expect(overlaps).toHaveLength(1);
    // overlaps is the && operator, which is what idx_builds_made_for indexes.
    expect(overlaps[0].args).toEqual(["made_for", ["lawyer"]]);
  });

  it("applies both filters together, and neither when neither is set", async () => {
    await listGallery({ madeFor: ["lawyer"], madeWith: ["Claude"] });
    expect(call("overlaps").map((entry) => entry.args[0])).toEqual([
      "made_for",
      "made_with",
    ]);

    calls = [];
    await listGallery();
    expect(call("overlaps")).toHaveLength(0);
  });

  it("drops blank and duplicate filter values rather than sending them", async () => {
    await listGallery({ madeFor: ["lawyer", " lawyer ", "", "   "] });
    expect(call("overlaps")[0].args[1]).toEqual(["lawyer"]);
  });

  it("pages with a bounded range and never asks for more than sixty", async () => {
    await listGallery({ offset: GALLERY_PAGE_SIZE });
    expect(firstArg("range")).toBe(GALLERY_PAGE_SIZE);
    expect(call("range")[0].args[1]).toBe(GALLERY_PAGE_SIZE * 2 - 1);

    calls = [];
    await listGallery({ limit: 5000 });
    expect(call("range")[0].args[1]).toBe(59);
  });

  it("flattens the embeds onto the card and survives a build with neither", async () => {
    response = {
      data: [
        { id: "b1", slug: "one", build_nodes: [{ id: "n1" }], build_media: [{ id: "m1" }] },
        { id: "b2", slug: "two", build_nodes: null, build_media: null },
      ],
      error: null,
      count: 2,
    };

    const page = await listGallery();
    expect(page.total).toBe(2);
    expect(page.builds[0]).toMatchObject({ id: "b1", nodes: [{ id: "n1" }], media: [{ id: "m1" }] });
    expect(page.builds[1]).toMatchObject({ id: "b2", nodes: [], media: [] });
    // The raw embed keys do not leak through to the card.
    expect(page.builds[0]).not.toHaveProperty("build_nodes");
  });

  it("throws with the layer's own message when PostgREST refuses", async () => {
    response = { data: null as never, error: { message: "column does not exist" }, count: null };
    await expect(listGallery()).rejects.toThrow(/listGallery/);
  });
});

describe("gallery membership, as a predicate", () => {
  const build = (over: Record<string, unknown> = {}) =>
    ({ status: "published", shape: "app", completeness: 0, ...over }) as never;

  // ACCEPTANCE 2
  it("admits a build at its shape's threshold and refuses one below", () => {
    expect(inGallery(build({ completeness: GALLERY_THRESHOLD.app }))).toBe(true);
    expect(inGallery(build({ completeness: GALLERY_THRESHOLD.app - 1 }))).toBe(false);
  });

  // ACCEPTANCE 3
  it("admits an editorially promoted build whatever it scores", () => {
    expect(inGallery(build({ status: "gallery", completeness: 0 }))).toBe(true);
  });

  it("never admits a draft", () => {
    expect(inGallery(build({ status: "draft", completeness: 100 }))).toBe(false);
  });

  it("holds an unknown shape to the 'other' bar rather than letting it through", () => {
    expect(inGallery(build({ shape: "sculpture", completeness: 0 }))).toBe(false);
    expect(inGallery(build({ shape: "sculpture", completeness: 100 }))).toBe(true);
  });

  it("puts every shape's bar above the minimum publishable score", () => {
    // The whole design: publication is ungated, gallery placement is gated. A
    // bar at or below what publishing asks for would collapse the distinction.
    for (const threshold of Object.values(GALLERY_THRESHOLD)) {
      expect(threshold).toBeGreaterThan(60);
      expect(threshold).toBeLessThanOrEqual(90);
    }
  });
});

describe("the facets", () => {
  beforeEach(() => {
    calls = [];
    rpc.mockReset();
  });

  it("sends the shape thresholds, so the SQL does not keep its own copy", async () => {
    rpc.mockResolvedValue({ data: { roles: [], tools: [] }, error: null });
    await getGalleryFacets();

    const [name, args] = call("rpc")[0].args as [string, { thresholds: unknown }];
    expect(name).toBe("gallery_facets");
    expect(args.thresholds).toEqual(GALLERY_THRESHOLD);
  });

  it("returns empty lists rather than undefined when the function returns nothing", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(getGalleryFacets()).resolves.toEqual({ roles: [], tools: [] });
  });
});
