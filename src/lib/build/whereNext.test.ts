// Where next's data layer (RC-P14b).
//
// A stand-in for the PostgREST builder records every call and records a
// REQUEST when a builder is awaited, which is when supabase-js goes to the
// network. Each request is answered by what it filters on, so the claims are
// about how many requests there are, what each one asks, and which answer
// lands in which row.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}

let calls: Recorded[] = [];
let builders = 0;
let answers: { rebuilds: unknown[]; tool: unknown[]; maker: unknown[] } = { rebuilds: [], tool: [], maker: [] };

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "or", "overlaps", "order", "limit", "range"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args, builder: id });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [], builder: id });
    const filters = mine();
    const on = (column: string) => filters.some((call) => call.args[0] === column);
    const data = on("parent_build_id") ? answers.rebuilds : on("creator_id") ? answers.maker : answers.tool;
    return Promise.resolve({ data, error: null, count: data.length }).then(resolve);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => builder(table), rpc: vi.fn() },
}));

import { GALLERY_BUILD_COLUMNS, listGallery } from "@/lib/build/gallery";
import { WHERE_NEXT_PER_ROW, firstTool, galleryEligible, getWhereNext } from "@/lib/build/whereNext";

const THIS = "build-this";

function header(id: string, over: Record<string, unknown> = {}) {
  return { id, slug: `slug-${id}`, title: `Build ${id}`, creator_id: "maker-1", ...over };
}

const requests = () => calls.filter((call) => call.method === "request");
const callsOf = (builderId: number) => calls.filter((call) => call.builder === builderId);

beforeEach(() => {
  calls = [];
  builders = 0;
  answers = { rebuilds: [], tool: [], maker: [] };
});

describe("getWhereNext", () => {
  it("asks three times, together, each on the card's columns, capped at three, never this build", async () => {
    const pending = getWhereNext({ buildId: THIS, creatorId: "maker-1", madeWith: ["Claude", "n8n"] });
    /* All three builders exist before any answer is read: Promise.all, not a chain. */
    expect(builders).toBe(3);
    await pending;

    expect(requests()).toHaveLength(3);
    for (const id of [1, 2, 3]) {
      const own = callsOf(id);
      expect(own[0].table).toBe("builds");
      expect(String(own.find((call) => call.method === "select")?.args[0])).toContain(GALLERY_BUILD_COLUMNS);
      expect(own.find((call) => call.method === "limit")?.args).toEqual([3]);
      expect(own.find((call) => call.method === "neq")?.args).toEqual(["id", THIS]);
      expect(own.find((call) => call.method === "in")?.args).toEqual(["status", ["published", "gallery"]]);
    }
    expect(WHERE_NEXT_PER_ROW).toBe(3);
  });

  it("asks for rebuilds of this build, newest first", async () => {
    await getWhereNext({ buildId: THIS, creatorId: "maker-1", madeWith: ["Claude"] });
    const own = callsOf(1);
    expect(own.find((call) => call.method === "eq")?.args).toEqual(["parent_build_id", THIS]);
    expect(own.filter((call) => call.method === "order").map((call) => call.args[0])).toEqual(["published_at"]);
  });

  it("asks for the first tool's gallery-eligible builds in the gallery's order", async () => {
    await getWhereNext({ buildId: THIS, creatorId: "maker-1", madeWith: ["  ", "Claude", "n8n"] });
    const own = callsOf(2);
    expect(own.find((call) => call.method === "overlaps")?.args).toEqual(["made_with", ["Claude"]]);
    expect(own.find((call) => call.method === "or")?.args[0]).toBe(galleryEligible());
    expect(own.filter((call) => call.method === "order").map((call) => call.args[0])).toEqual([
      "reproduction_count",
      "last_confirmed_at",
      "published_at",
    ]);
  });

  it("asks for the maker's other builds, newest first, with the maker's name", async () => {
    await getWhereNext({ buildId: THIS, creatorId: "maker-1", madeWith: ["Claude"] });
    const own = callsOf(3);
    expect(own.find((call) => call.method === "eq")?.args).toEqual(["creator_id", "maker-1"]);
    expect(String(own.find((call) => call.method === "select")?.args[0])).toContain(
      "maker:profiles!builds_creator_id_fkey(username, display_name)",
    );
  });

  it("sends no request for the tool row when the build names no tool", async () => {
    const next = await getWhereNext({ buildId: THIS, creatorId: "maker-1", madeWith: [] });

    expect(requests()).toHaveLength(2);
    expect(calls.some((call) => call.method === "overlaps")).toBe(false);
    expect(next.sharedTool).toBeNull();
  });

  it("puts each answer in its row, as cards with no nodes or media, and never this build", async () => {
    answers = {
      rebuilds: [header("r1"), header("r2")],
      tool: [header(THIS), header("t1"), header("t2"), header("t3")],
      maker: [
        { ...header("m1"), maker: { username: "sam", display_name: "Sam Ilori" } },
        { ...header("m2"), maker: { username: "sam", display_name: "Sam Ilori" } },
      ],
    };

    const next = await getWhereNext({ buildId: THIS, creatorId: "maker-1", madeWith: ["Claude"] });

    expect(next.rebuilds.map((build) => build.id)).toEqual(["r1", "r2"]);
    expect(next.sharedTool).toEqual({ tool: "Claude", builds: expect.any(Array) });
    expect(next.sharedTool?.builds.map((build) => build.id)).toEqual(["t1", "t2", "t3"]);
    expect(next.fromMaker.map((build) => build.id)).toEqual(["m1", "m2"]);
    expect(next.fromMaker[0]).not.toHaveProperty("maker");
    expect(next.rebuilds[0]).toMatchObject({ nodes: [], media: [] });
    expect(next.makerName).toBe("Sam Ilori");
  });

  it("names the maker by handle when they have no display name", async () => {
    answers.maker = [{ ...header("m1"), maker: { username: "sam", display_name: null } }];
    const next = await getWhereNext({ buildId: THIS, creatorId: "maker-1", madeWith: [] });
    expect(next.makerName).toBe("@sam");
  });
});

describe("firstTool", () => {
  it("is the first named tool, trimmed, or null", () => {
    expect(firstTool(["Claude", "n8n"])).toBe("Claude");
    expect(firstTool([" ", " Zapier "])).toBe("Zapier");
    expect(firstTool([])).toBeNull();
    expect(firstTool(null)).toBeNull();
  });
});

describe("galleryEligible", () => {
  it("is the gallery's own predicate, word for word", async () => {
    await listGallery();
    const sent = calls.find((call) => call.method === "or")?.args[0];
    expect(sent).toBeTruthy();
    expect(galleryEligible()).toBe(sent);
  });
});
