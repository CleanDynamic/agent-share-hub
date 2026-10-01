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
  countGalleryLenses,
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
