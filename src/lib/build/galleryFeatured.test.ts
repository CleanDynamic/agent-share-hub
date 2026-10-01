// The featured build: "most reproduced this month".
//
// A stand-in for the PostgREST builder records every call and answers each
// request by what it selects: reproduction rows, the ranking columns of the
// candidate builds, or the card the winner is loaded as.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  method: string;
  args: unknown[];
  builder: number;
}

let calls: Recorded[] = [];
let builders = 0;
let reproductions: Array<{ build_id: string }> = [];
let candidates: Array<Record<string, unknown>> = [];
let card: Record<string, unknown> | null = null;
let failure: { on: string; message: string } | null = null;

function builder() {
  const id = (builders += 1);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "eq", "gte", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ method, args, builder: id });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    const own = calls.filter((call) => call.builder === id);
    const table = String(own.find((call) => call.method === "from")?.args[0]);
    const select = String(own.find((call) => call.method === "select")?.args[0]);
    const kind =
      table === "build_reproductions" ? "reproductions" : select.startsWith("id, status") ? "candidates" : "card";
    if (failure?.on === kind) {
      return Promise.resolve({ data: null, error: { message: failure.message } }).then(resolve);
    }
    const data = kind === "reproductions" ? reproductions : kind === "candidates" ? candidates : card ? [card] : [];
    return Promise.resolve({ data, error: null }).then(resolve);
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

import { GALLERY_BUILD_COLUMNS, GALLERY_THRESHOLD, getFeaturedBuild } from "@/lib/build/gallery";

const NOW = new Date("2026-10-01T12:00:00Z");

const requests = (method: string, builderId: number) =>
  calls.filter((call) => call.builder === builderId && call.method === method).map((call) => call.args);

/** `count` reproduction rows for one build. */
const runs = (buildId: string, count: number) => Array.from({ length: count }, () => ({ build_id: buildId }));

/** A published build that clears its bar. */
function inGalleryBuild(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    status: "published",
    shape: "app",
    completeness: GALLERY_THRESHOLD.app,
    last_confirmed_at: null,
    ...over,
  };
}

beforeEach(() => {
  calls = [];
  builders = 0;
  reproductions = [];
  candidates = [];
  card = null;
  failure = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getFeaturedBuild", () => {
  it("returns the build with the most reproductions, with its count and outcome", async () => {
    reproductions = [...runs("a", 2), ...runs("b", 5), ...runs("c", 3)];
    candidates = [inGalleryBuild("a"), inGalleryBuild("b"), inGalleryBuild("c")];
    card = { id: "b", slug: "b-build", title: "B", outcome: "  Turns a PDF into a podcast  ", build_nodes: null, build_media: null, bounties: null };

    const featured = await getFeaturedBuild(NOW);

    expect(featured?.build.id).toBe("b");
    expect(featured?.reproductions30d).toBe(5);
    expect(featured?.outcome).toBe("Turns a PDF into a podcast");
    // Arrives as a card: embeds default to empty arrays, never absent.
    expect(featured?.build.nodes).toEqual([]);
    expect(featured?.build.media).toEqual([]);
  });

  it("reads the last 30 days of build_id only, capped at 5000, with no select('*')", async () => {
    reproductions = runs("a", 1);
    candidates = [inGalleryBuild("a")];
    card = { id: "a", outcome: null };

    await getFeaturedBuild(NOW);

    expect(calls.find((call) => call.method === "from")?.args).toEqual(["build_reproductions"]);
    expect(requests("select", 1)).toEqual([["build_id"]]);
    expect(requests("gte", 1)).toEqual([["created_at", "2026-09-01T12:00:00.000Z"]]);
    expect(requests("limit", 1)).toEqual([[5000]]);
  });

  it("breaks a tie by the most recently confirmed build", async () => {
    reproductions = [...runs("old", 4), ...runs("new", 4), ...runs("never", 4)];
    candidates = [
      inGalleryBuild("old", { last_confirmed_at: "2026-08-01T00:00:00Z" }),
      inGalleryBuild("new", { last_confirmed_at: "2026-09-20T00:00:00Z" }),
      inGalleryBuild("never", { last_confirmed_at: null }),
    ];
    card = { id: "new", outcome: null };

    await getFeaturedBuild(NOW);

    expect(requests("eq", 3)[0]).toEqual(["id", "new"]);
  });

  it("passes over a build the gallery would not show, however often it was run", async () => {
    reproductions = [...runs("draftish", 9), ...runs("below", 8), ...runs("promoted", 2), ...runs("ok", 1)];
    candidates = [
      inGalleryBuild("draftish", { status: "draft" }),
      inGalleryBuild("below", { completeness: GALLERY_THRESHOLD.app - 1 }),
      inGalleryBuild("promoted", { status: "gallery", completeness: 0 }),
      inGalleryBuild("ok"),
    ];
    card = { id: "promoted", outcome: null };

    const featured = await getFeaturedBuild(NOW);

    expect(requests("eq", 3)[0]).toEqual(["id", "promoted"]);
    expect(featured?.reproductions30d).toBe(2);
  });

  it("checks the ranking candidates by their own columns, highest count first", async () => {
    reproductions = [...runs("a", 1), ...runs("b", 3)];
    candidates = [inGalleryBuild("a"), inGalleryBuild("b")];
    card = { id: "b", outcome: null };

    await getFeaturedBuild(NOW);

    expect(requests("select", 2)).toEqual([["id, status, shape, completeness, last_confirmed_at"]]);
    expect(requests("in", 2)).toEqual([["id", ["b", "a"]]]);
  });

  it("loads the winner on the card's columns", async () => {
    reproductions = runs("a", 1);
    candidates = [inGalleryBuild("a")];
    card = { id: "a", outcome: null };

    await getFeaturedBuild(NOW);

    expect(String(requests("select", 3)[0][0]).startsWith(GALLERY_BUILD_COLUMNS)).toBe(true);
  });

  it("returns null when nothing was reproduced, and asks nothing further", async () => {
    await expect(getFeaturedBuild(NOW)).resolves.toBeNull();
    expect(builders).toBe(1);
  });

  it("returns null when nothing reproduced is in the gallery", async () => {
    reproductions = runs("a", 3);
    candidates = [inGalleryBuild("a", { status: "published", completeness: 0 })];

    await expect(getFeaturedBuild(NOW)).resolves.toBeNull();
    expect(builders).toBe(2);
  });

  it("gives a null outcome when the build has none", async () => {
    reproductions = runs("a", 1);
    candidates = [inGalleryBuild("a")];
    card = { id: "a", outcome: "   " };

    expect((await getFeaturedBuild(NOW))?.outcome).toBeNull();
  });

  it("warns once when the row cap is reached, and still returns the top result", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    reproductions = [...runs("top", 3000), ...runs("other", 2000)];
    candidates = [inGalleryBuild("top"), inGalleryBuild("other")];
    card = { id: "top", outcome: null };

    const featured = await getFeaturedBuild(NOW);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(featured?.build.id).toBe("top");
    expect(featured?.reproductions30d).toBe(3000);
  });

  it("does not warn below the cap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    reproductions = runs("a", 4999);
    candidates = [inGalleryBuild("a")];
    card = { id: "a", outcome: null };

    await getFeaturedBuild(NOW);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(["reproductions", "candidates", "card"])("throws an error naming the operation when the %s read fails", async (on) => {
    reproductions = runs("a", 1);
    candidates = [inGalleryBuild("a")];
    card = { id: "a", outcome: null };
    failure = { on, message: "boom" };

    await expect(getFeaturedBuild(NOW)).rejects.toThrow(/getFeaturedBuild \(.+\) failed: boom/);
  });
});
