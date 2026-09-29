// The lens and the query on the gallery's data layer (RC-P10).
//
// Asserted on the REQUEST listGallery builds, against a stand-in for the
// PostgREST builder that records every call, as src/test/gallery.test.ts does
// for the rest of the query. What is new here is when a request is SENT: the
// builder records "request" only when it is awaited, which is the moment
// supabase-js actually goes to the network. That is what lets "a query with no
// hits costs one request" be a claim about requests rather than about how many
// builders were constructed.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let searchHits: string[] = [];

function builder() {
  const self: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return self;
    };
  for (const method of ["select", "in", "or", "overlaps", "order", "limit", "range", "eq", "gte"]) {
    self[method] = chain(method);
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    calls.push({ method: "request", args: ["builds"] });
    return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder();
    },
    rpc: (name: string, args: unknown) => {
      calls.push({ method: "request", args: [name, args] });
      return Promise.resolve({
        data: searchHits.map((build_id) => ({ build_id })),
        error: null,
      });
    },
  },
}));

import { GALLERY_LENSES, listGallery, type GalleryLens } from "@/lib/build/gallery";
import { STALE_AFTER_DAYS } from "@/lib/build/signals";

const of = (method: string) => calls.filter((entry) => entry.method === method);
const requests = () => of("request");

/** The filters a lens may add: every `gte`, and whether the bounty embed is inner. */
function lensFilters() {
  const select = of("select")[0]?.args[0] as string;
  return {
    gte: of("gte").map((entry) => entry.args),
    innerBounties: select.includes("bounties!bounties_build_id_fkey!inner("),
  };
}

describe("the gallery's lenses", () => {
  beforeEach(() => {
    calls = [];
    searchHits = [];
  });

  it("names four lenses, All first", () => {
    expect(GALLERY_LENSES).toEqual(["all", "proven", "rebuilt", "unsolved"]);
  });

  it("adds nothing under All", async () => {
    await listGallery({ lens: "all" });
    expect(lensFilters()).toEqual({ gte: [], innerBounties: false });
  });

  it("adds reproduced-at-least-once and confirmed within the stale window under Proven", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
    try {
      await listGallery({ lens: "proven" });
    } finally {
      vi.useRealTimers();
    }

    const cutoff = new Date(
      Date.parse("2026-09-28T12:00:00Z") - STALE_AFTER_DAYS * 86_400_000,
    ).toISOString();
    expect(lensFilters()).toEqual({
      gte: [
        ["reproduction_count", 1],
        ["last_confirmed_at", cutoff],
      ],
      innerBounties: false,
    });
  });

  it("adds rebuilt-at-least-once under Rebuilt", async () => {
    await listGallery({ lens: "rebuilt" });
    expect(lensFilters()).toEqual({ gte: [["rebuild_count", 1]], innerBounties: false });
  });

  it("takes the existing open-bounty branch under Unsolved, and no other filter", async () => {
    await listGallery({ lens: "unsolved" });
    const unsolved = lensFilters();

    calls = [];
    await listGallery({ openBounties: true });
    const openBounties = lensFilters();

    expect(unsolved).toEqual({ gte: [], innerBounties: true });
    expect(unsolved).toEqual(openBounties);
  });

  it("reads a lens it has no name for as All", async () => {
    await listGallery({ lens: "trending" as GalleryLens });
    expect(lensFilters()).toEqual({ gte: [], innerBounties: false });
  });

  it("never reorders: every lens sends the same ORDER BY", async () => {
    const orders: unknown[] = [];
    for (const lens of GALLERY_LENSES) {
      calls = [];
      await listGallery({ lens });
      orders.push(of("order").map((entry) => entry.args));
    }
    for (const order of orders) expect(order).toEqual(orders[0]);
  });
});

describe("the gallery with a query", () => {
  beforeEach(() => {
    calls = [];
    searchHits = [];
  });

  it("returns no builds after one request when the search matches nothing", async () => {
    searchHits = [];
    const page = await listGallery({ query: "zzzz" });

    expect(page).toEqual({ builds: [], total: 0 });
    expect(requests()).toHaveLength(1);
    expect(requests()[0].args[0]).toBe("search_build_ids");
  });

  it("narrows to the matched ids, and asks for them in the builds request", async () => {
    searchHits = ["b1", "b2"];
    await listGallery({ query: "  inbox   agent " });

    expect(requests().map((entry) => entry.args[0])).toEqual(["search_build_ids", "builds"]);
    // The query reaches the search tidied, as normaliseQuery reads it.
    expect(requests()[0].args[1]).toMatchObject({ q: "inbox agent" });
    expect(of("in").find((entry) => entry.args[0] === "id")?.args[1]).toEqual(["b1", "b2"]);
  });

  it("skips the completeness predicate but keeps the status clause", async () => {
    searchHits = ["b1"];
    await listGallery({ query: "agent" });

    expect(of("or")).toHaveLength(0);
    expect(of("in").find((entry) => entry.args[0] === "status")?.args[1]).toEqual([
      "published",
      "gallery",
    ]);
  });

  it("keeps the predicate when the query is too short to be one", async () => {
    await listGallery({ query: " a " });

    expect(requests().map((entry) => entry.args[0])).toEqual(["builds"]);
    expect(of("or")).toHaveLength(1);
  });

  it("combines a query with a lens and the facets", async () => {
    searchHits = ["b1"];
    await listGallery({ query: "agent", lens: "rebuilt", madeFor: ["lawyer"] });

    expect(of("in").some((entry) => entry.args[0] === "id")).toBe(true);
    expect(of("gte").map((entry) => entry.args)).toEqual([["rebuild_count", 1]]);
    expect(of("overlaps").map((entry) => entry.args)).toEqual([["made_for", ["lawyer"]]]);
  });
});
