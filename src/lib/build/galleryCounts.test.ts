// The gallery's counts: the lens row and the stats row.
//
// A stand-in for the PostgREST builder records every call, so the claims are
// about which filters each count sends. The lens filters themselves are
// listGallery's (gallery.test.ts holds those); what is asserted here is that
// each count applies the SAME ones.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  method: string;
  args: unknown[];
  builder: number;
}

let calls: Recorded[] = [];
let builders = 0;
let answer: (own: Recorded[]) => { count: number | null; error: unknown } = () => ({
  count: 0,
  error: null,
});

function builder() {
  const id = (builders += 1);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "or", "eq", "gte", "order", "limit", "range", "overlaps"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ method, args, builder: id });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({
      data: null,
      ...answer(calls.filter((call) => call.builder === id)),
    }).then(resolve);
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      calls.push({ method: "from", args: [table], builder: builders + 1 });
      return builder();
    },
    rpc: vi.fn(),
  },
}));

import {
  GALLERY_LENSES,
  GALLERY_THRESHOLD,
  GALLERY_SHAPES,
  countGalleryLenses,
  getGalleryShapeFacets,
  getGalleryStats,
  listGallery,
  type GalleryLens,
} from "@/lib/build/gallery";
import { STALE_AFTER_DAYS } from "@/lib/build/signals";

const NOW = "2026-10-01T12:00:00Z";
const DAY_MS = 86_400_000;
const FRESH_SINCE = new Date(Date.parse(NOW) - STALE_AFTER_DAYS * DAY_MS).toISOString();

const callsOf = (builderId: number) => calls.filter((call) => call.builder === builderId);
const named = (own: Recorded[], method: string) => own.filter((call) => call.method === method).map((call) => call.args);

/** Every filter a request sent, with the select string and head option, for comparing requests. */
function filtersOf(own: Recorded[]) {
  return {
    select: named(own, "select")[0],
    status: named(own, "in"),
    or: named(own, "or"),
    eq: named(own, "eq"),
    gte: named(own, "gte"),
  };
}

beforeEach(() => {
  calls = [];
  builders = 0;
  answer = () => ({ count: 0, error: null });
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("countGalleryLenses", () => {
  it("sends one estimated head count per lens, together, and returns each under its lens", async () => {
    const counts: Record<string, number> = { all: 40, proven: 12, rebuilt: 5, unsolved: 7 };
    answer = (own) => {
      const gte = named(own, "gte");
      const select = String(named(own, "select")[0][0]);
      const lens = select.includes("bounties")
        ? "unsolved"
        : gte.some((args) => args[0] === "reproduction_count")
          ? "proven"
          : gte.some((args) => args[0] === "rebuild_count")
            ? "rebuilt"
            : "all";
      return { count: counts[lens], error: null };
    };

    const result = await countGalleryLenses();

    expect(result).toEqual(counts);
    expect(Object.keys(result)).toEqual([...GALLERY_LENSES]);
    expect(calls.filter((call) => call.method === "from").map((call) => call.args[0])).toEqual([
      "builds",
      "builds",
      "builds",
      "builds",
    ]);
    for (let id = 1; id <= 4; id += 1) {
      expect(named(callsOf(id), "select")[0][1]).toEqual({ count: "estimated", head: true });
      expect(named(callsOf(id), "select")[0][0]).not.toBe("*");
    }
  });

  it("applies each lens the same filter listGallery applies", async () => {
    for (const lens of GALLERY_LENSES) {
      calls = [];
      builders = 0;
      await countGalleryLenses();
      const counted = filtersOf(callsOf(GALLERY_LENSES.indexOf(lens) + 1));

      calls = [];
      builders = 0;
      await listGallery({ lens });
      const listed = filtersOf(callsOf(1));

      // Membership and lens clauses are the same; only the select string and the
      // embed filters (which a page needs and a count does not) differ.
      expect(counted.status).toEqual([["status", ["published", "gallery"]]]);
      expect(counted.or).toEqual(listed.or);
      expect(counted.gte).toEqual(listed.gte);
      expect(counted.eq.find((args) => args[0] === "bounties.status")).toEqual(
        lens === "unsolved" ? ["bounties.status", "open"] : undefined,
      );
    }
  });

  it("uses the gallery's thresholds in the membership clause", async () => {
    await countGalleryLenses();
    const clause = String(named(callsOf(1), "or")[0][0]);
    expect(clause).toContain("status.eq.gallery");
    for (const [shape, bar] of Object.entries(GALLERY_THRESHOLD)) {
      expect(clause).toContain(`and(shape.eq.${shape},completeness.gte.${bar})`);
    }
  });

  it("puts the proven lens' boundary at the stale window", async () => {
    await countGalleryLenses();
    const proven = filtersOf(callsOf(GALLERY_LENSES.indexOf("proven") + 1));
    expect(proven.gte).toEqual([
      ["reproduction_count", 1],
      ["last_confirmed_at", FRESH_SINCE],
    ]);
  });

  it("joins bounties inner under the unsolved lens only", async () => {
    await countGalleryLenses();
    GALLERY_LENSES.forEach((lens: GalleryLens, index) => {
      const select = String(named(callsOf(index + 1), "select")[0][0]);
      expect(select.includes("bounties!bounties_build_id_fkey!inner(id)")).toBe(lens === "unsolved");
    });
  });

  it("returns 0 for a lens whose count comes back empty", async () => {
    answer = () => ({ count: null, error: null });
    await expect(countGalleryLenses()).resolves.toEqual({ all: 0, proven: 0, rebuilt: 0, unsolved: 0 });
  });

  it("throws an error naming the operation when a request fails", async () => {
    answer = () => ({ count: null, error: { message: "boom" } });
    await expect(countGalleryLenses()).rejects.toThrow("countGalleryLenses failed: boom");
  });
});

describe("getGalleryStats", () => {
  /** Answers each request by what it counts: runs, fresh gallery builds, or all gallery builds. */
  function answerWith(figures: { all: number | null; fresh: number | null; runs: number | null }) {
    answer = (own) => {
      if (named(own, "from")[0][0] === "build_reproductions") return { count: figures.runs, error: null };
      const fresh = named(own, "gte").some((args) => args[0] === "last_confirmed_at");
      return { count: fresh ? figures.fresh : figures.all, error: null };
    };
  }

  it("reports the gallery's size, this week's runs, a null goal and the fresh share", async () => {
    answerWith({ all: 200, fresh: 150, runs: 312 });

    await expect(getGalleryStats()).resolves.toEqual({
      inGallery: 200,
      reproducedThisWeek: 312,
      weeklyGoal: null,
      freshPct: 75,
    });
  });

  it("counts the All lens over the gallery's membership, and freshness over the stale window", async () => {
    answerWith({ all: 10, fresh: 5, runs: 1 });
    await getGalleryStats();

    const gallery = [1, 2].map((id) => filtersOf(callsOf(id)));
    const all = gallery.find((request) => request.gte.length === 0);
    const fresh = gallery.find((request) => request.gte.length > 0);

    expect(all?.status).toEqual([["status", ["published", "gallery"]]]);
    expect(all?.or).toEqual(fresh?.or);
    // Fresh asks only for the confirmation window: no reproduction clause.
    expect(fresh?.gte).toEqual([["last_confirmed_at", FRESH_SINCE]]);
  });

  it("counts this week's runs from Monday 00:00 UTC", async () => {
    answerWith({ all: 1, fresh: 1, runs: 1 });
    await getGalleryStats();

    const runs = callsOf(3);
    expect(named(runs, "from")[0]).toEqual(["build_reproductions"]);
    expect(named(runs, "gte")).toEqual([["created_at", "2026-09-28T00:00:00.000Z"]]);
  });

  it("rounds to a whole percentage", async () => {
    answerWith({ all: 3, fresh: 1, runs: 0 });
    expect((await getGalleryStats()).freshPct).toBe(33);
  });

  it("reports 0% for an empty gallery rather than dividing by zero", async () => {
    answerWith({ all: 0, fresh: 0, runs: 0 });
    expect(await getGalleryStats()).toEqual({
      inGallery: 0,
      reproducedThisWeek: 0,
      weeklyGoal: null,
      freshPct: 0,
    });
  });

  it("treats empty counts as 0", async () => {
    answerWith({ all: null, fresh: null, runs: null });
    expect(await getGalleryStats()).toEqual({
      inGallery: 0,
      reproducedThisWeek: 0,
      weeklyGoal: null,
      freshPct: 0,
    });
  });

  it("never reports more than 100% when an estimate overshoots", async () => {
    answerWith({ all: 100, fresh: 140, runs: 0 });
    expect((await getGalleryStats()).freshPct).toBe(100);
  });

  it("throws an error naming the operation when a count fails", async () => {
    answer = () => ({ count: null, error: { message: "boom" } });
    await expect(getGalleryStats()).rejects.toThrow(/getGalleryStats.* failed: boom/);
  });
});

describe("getGalleryShapeFacets (UI-P28)", () => {
  /** Answers each shape's request by the shape it asked about. */
  function answerByShape(figures: Partial<Record<string, number>>) {
    answer = (own) => {
      const shape = own.find((call) => call.method === "eq" && call.args[0] === "shape")?.args[1] as string;
      return { count: figures[shape] ?? 0, error: null };
    };
  }

  it("counts every shape over the gallery's membership, one estimated head request each", async () => {
    answerByShape({});
    await getGalleryShapeFacets();

    expect(builders).toBe(GALLERY_SHAPES.length);
    for (let id = 1; id <= builders; id += 1) {
      const own = callsOf(id);
      expect(named(own, "select")[0][1]).toEqual({ count: "estimated", head: true });
      expect(named(own, "in")).toEqual([["status", ["published", "gallery"]]]);
      expect(named(own, "or")).toHaveLength(1);
    }
    expect(GALLERY_SHAPES).toEqual(["app", "agent", "workflow", "prompt", "dataset", "study", "media", "technique", "other"]);
  });

  it("orders by count, then name, and leaves out shapes with none", async () => {
    answerByShape({ agent: 402, workflow: 318, app: 402, study: 88 });
    await expect(getGalleryShapeFacets()).resolves.toEqual([
      { value: "agent", count: 402 },
      { value: "app", count: 402 },
      { value: "workflow", count: 318 },
      { value: "study", count: 88 },
    ]);
  });
});

describe("listGallery's shape filter (UI-P28)", () => {
  it("narrows to the named shapes, drops unknown ones, and sends nothing when there are none", async () => {
    await listGallery({ shapes: ["agent", "toaster", "agent", "study"] });
    expect(named(callsOf(1), "in")).toContainEqual(["shape", ["agent", "study"]]);

    calls = [];
    builders = 0;
    await listGallery({ shapes: [] });
    expect(named(callsOf(1), "in").some((args) => args[0] === "shape")).toBe(false);
  });
});

