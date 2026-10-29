// SV-22 P3: a build in review stays out of Builds. Every read of the gallery's membership sends in_review = false; before the
// migration is applied the first read says the column is missing, is run again without it, and the column is not asked for again.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  method: string;
  args: unknown[];
  builder: number;
}

let calls: Recorded[] = [];
let builders = 0;
let failWith: unknown = null;

function builder() {
  const id = (builders += 1);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "or", "eq", "gte", "order", "limit", "range", "overlaps", "contains"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ method, args, builder: id });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    const asked = calls.some((call) => call.builder === id && call.method === "eq" && call.args[0] === "in_review");
    return Promise.resolve(failWith && asked ? { data: null, count: null, error: failWith } : { data: [], count: 0, error: null }).then(resolve);
  };
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

import { countGalleryLenses, listBuildsTable, listGallery, resetReviewColumn } from "@/lib/build/gallery";

const reviewFilters = () => calls.filter((call) => call.method === "eq" && call.args[0] === "in_review");

beforeEach(() => {
  calls = [];
  builders = 0;
  failWith = null;
  resetReviewColumn();
});

describe("builds in review", () => {
  it("are left out of the gallery page, its counts and the table", async () => {
    await listGallery();
    expect(reviewFilters()).toHaveLength(1);
    expect(reviewFilters()[0].args).toEqual(["in_review", false]);

    calls = [];
    await countGalleryLenses();
    expect(reviewFilters().length).toBeGreaterThanOrEqual(1);

    calls = [];
    await listBuildsTable();
    expect(reviewFilters()).toHaveLength(1);
  });

  it("are read without the filter, once, while the column is missing", async () => {
    failWith = { code: "42703", message: "column builds.in_review does not exist" };
    await expect(listGallery()).resolves.toEqual({ builds: [], total: 0 });
    expect(reviewFilters()).toHaveLength(1);

    calls = [];
    await listGallery();
    expect(reviewFilters()).toHaveLength(0);
  });

  it("still throw any other failure", async () => {
    failWith = { code: "XX000", message: "boom" };
    await expect(listGallery()).rejects.toThrow(/listGallery failed/);
  });
});
