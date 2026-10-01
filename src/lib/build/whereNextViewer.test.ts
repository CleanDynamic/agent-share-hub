// Where next for the viewer (UI-P25).
//
// A stand-in for the PostgREST builder records every call and answers each
// request by what it filters on: the viewer's runs, the source builds, the
// three where-next rows of each source, the "already ran" check, and the
// sparkline read.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}

interface Answers {
  runs: Array<{ build_id: string; created_at: string }>;
  sources: Array<{ id: string; title: string; creator_id: string; made_with: string[] | null }>;
  /** Rebuilds, keyed by the parent build id. */
  rebuilds: Record<string, unknown[]>;
  /** Made-with rows, keyed by the tool. */
  tool: Record<string, unknown[]>;
  /** Maker rows, keyed by the maker's id. */
  maker: Record<string, unknown[]>;
  /** Builds the viewer has reproduced at any time, among the candidates. */
  already: string[];
  /** Reproduction rows read for the sparklines. */
  sparks: Array<{ build_id: string; created_at: string }>;
}

let calls: Recorded[] = [];
let builders = 0;
let answers: Answers;
let failOn: string | null = null;

function emptyAnswers(): Answers {
  return { runs: [], sources: [], rebuilds: {}, tool: {}, maker: {}, already: [], sparks: [] };
}

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "or", "gte", "overlaps", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args, builder: id });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    const own = mine();
    const arg = (method: string, column: string) => own.find((call) => call.method === method && call.args[0] === column)?.args[1];
    let kind: string;
    let data: unknown;
    if (table === "build_reproductions") {
      if (arg("eq", "user_id") !== undefined && arg("gte", "created_at") !== undefined) {
        kind = "runs";
        data = answers.runs;
      } else if (arg("eq", "user_id") !== undefined) {
        kind = "already";
        data = answers.already.map((build_id) => ({ build_id }));
      } else {
        kind = "sparks";
        data = answers.sparks;
      }
    } else if (String(own.find((call) => call.method === "select")?.args[0]).startsWith("id, title, creator_id")) {
      kind = "sources";
      data = answers.sources;
    } else if (arg("eq", "parent_build_id") !== undefined) {
      kind = "rebuilds";
      data = answers.rebuilds[String(arg("eq", "parent_build_id"))] ?? [];
    } else if (own.some((call) => call.method === "overlaps")) {
      kind = "tool";
      data = answers.tool[String((own.find((call) => call.method === "overlaps")?.args[1] as string[])[0])] ?? [];
    } else {
      kind = "maker";
      data = answers.maker[String(arg("eq", "creator_id"))] ?? [];
    }
    if (failOn === kind) return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve);
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => builder(table), rpc: vi.fn() },
}));

import { WHERE_NEXT_PER_ROW, getWhereNextForViewer } from "@/lib/build/whereNext";

const VIEWER = "viewer-1";
const NOW = "2026-10-01T12:00:00Z"; // a Thursday; the week began 2026-09-28

function card(id: string, over: Record<string, unknown> = {}) {
  return { id, slug: `slug-${id}`, title: `Build ${id}`, creator_id: "maker-1", build_nodes: null, build_media: null, bounties: null, ...over };
}

function source(id: string, over: Record<string, unknown> = {}) {
  return { id, title: `Ran ${id}`, creator_id: "maker-1", made_with: ["Sonnet-4.5"], ...over };
}

const run = (build_id: string, created_at = "2026-09-30T10:00:00Z") => ({ build_id, created_at });
const ines = { username: "ines", display_name: "Ines" };

const requestsTo = (table: string) =>
  [...new Set(calls.filter((call) => call.table === table).map((call) => call.builder))];

beforeEach(() => {
  calls = [];
  builders = 0;
  answers = emptyAnswers();
  failOn = null;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("getWhereNextForViewer", () => {
  it("returns [] for a viewer with no runs this week, and asks nothing more", async () => {
    await expect(getWhereNextForViewer(VIEWER)).resolves.toEqual([]);
    expect(builders).toBe(1);
  });

  it("reads the viewer's runs since Monday 00:00 UTC, newest first, at most 20", async () => {
    await getWhereNextForViewer(VIEWER);

    const own = calls.filter((call) => call.builder === 1);
    expect(own.find((call) => call.method === "select")?.args).toEqual(["build_id, created_at"]);
    expect(own.find((call) => call.method === "eq")?.args).toEqual(["user_id", VIEWER]);
    expect(own.find((call) => call.method === "gte")?.args).toEqual(["created_at", "2026-09-28T00:00:00.000Z"]);
    expect(own.find((call) => call.method === "order")?.args).toEqual(["created_at", { ascending: false }]);
    expect(own.find((call) => call.method === "limit")?.args).toEqual([20]);
  });

  it("suggests rebuilds of a build the viewer ran", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1", { made_with: null })];
    answers.rebuilds = { "ran-1": [card("rb-1", { creator_id: "other" })] };

    const [item] = await getWhereNextForViewer(VIEWER);

    expect(item).toMatchObject({
      build: { id: "rb-1", slug: "slug-rb-1", title: "Build rb-1", cover: null },
      reason: "rebuilt_from_one_you_ran",
      reasonDetail: "Ran ran-1",
    });
  });

  it("suggests more made with the same tool, naming the tool", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1")];
    answers.tool = { "Sonnet-4.5": [card("t-1", { creator_id: "other" })] };

    const items = await getWhereNextForViewer(VIEWER);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ reason: "same_tool", reasonDetail: "Sonnet-4.5", build: { id: "t-1" } });
  });

  it("suggests more from the maker, labelled with their @handle", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1", { made_with: null })];
    answers.maker = { "maker-1": [card("m-1", { maker: ines })] };

    const items = await getWhereNextForViewer(VIEWER);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ reason: "more_from_maker", reasonDetail: "@ines", build: { id: "m-1" } });
  });

  it("leaves out maker rows when the maker cannot be named", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1", { made_with: null })];
    answers.maker = { "maker-1": [card("m-1", { maker: { username: null, display_name: null } })] };

    await expect(getWhereNextForViewer(VIEWER)).resolves.toEqual([]);
  });

  it("orders a source's suggestions rebuilds, same tool, then maker", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1")];
    answers.rebuilds = { "ran-1": [card("rb-1")] };
    answers.tool = { "Sonnet-4.5": [card("t-1")] };
    answers.maker = { "maker-1": [card("m-1", { maker: ines })] };

    const items = await getWhereNextForViewer(VIEWER, 10);

    expect(items.map((item) => [item.build.id, item.reason])).toEqual([
      ["rb-1", "rebuilt_from_one_you_ran"],
      ["t-1", "same_tool"],
      ["m-1", "more_from_maker"],
    ]);
  });

  it("gathers from the newest three runs only", async () => {
    answers.runs = [run("r1"), run("r2"), run("r3"), run("r4")];
    answers.sources = ["r1", "r2", "r3"].map((id) => source(id, { made_with: null }));

    await getWhereNextForViewer(VIEWER);

    const sourceRead = calls.find((call) => call.method === "in" && call.args[0] === "id");
    expect(sourceRead?.args[1]).toEqual(["r1", "r2", "r3"]);
    const parents = calls.filter((call) => call.method === "eq" && call.args[0] === "parent_build_id").map((call) => call.args[1]);
    expect(parents).toEqual(["r1", "r2", "r3"]);
  });

  it("removes builds the viewer created", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1", { made_with: null })];
    answers.rebuilds = { "ran-1": [card("mine", { creator_id: VIEWER }), card("theirs", { creator_id: "other" })] };

    const items = await getWhereNextForViewer(VIEWER);
    expect(items.map((item) => item.build.id)).toEqual(["theirs"]);
  });

  it("removes builds the viewer ran this week, including the ones they ran", async () => {
    answers.runs = [run("ran-1"), run("ran-2")];
    answers.sources = [source("ran-1", { made_with: null }), source("ran-2", { made_with: null })];
    answers.rebuilds = { "ran-1": [card("ran-2"), card("keep")] };

    const items = await getWhereNextForViewer(VIEWER);
    expect(items.map((item) => item.build.id)).toEqual(["keep"]);
  });

  it("removes builds the viewer reproduced before this week", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1", { made_with: null })];
    answers.rebuilds = { "ran-1": [card("old-run"), card("keep")] };
    answers.already = ["old-run"];

    const items = await getWhereNextForViewer(VIEWER);

    expect(items.map((item) => item.build.id)).toEqual(["keep"]);
    const check = calls.filter((call) => call.table === "build_reproductions" && call.method === "in" && call.builder !== 1);
    expect(check[0].args).toEqual(["build_id", ["old-run", "keep"]]);
  });

  it("keeps a build once, under the first reason it was found for", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1")];
    answers.rebuilds = { "ran-1": [card("both")] };
    answers.tool = { "Sonnet-4.5": [card("both"), card("t-1")] };

    const items = await getWhereNextForViewer(VIEWER, 10);
    expect(items.map((item) => [item.build.id, item.reason])).toEqual([
      ["both", "rebuilt_from_one_you_ran"],
      ["t-1", "same_tool"],
    ]);
  });

  it("keeps the first `limit`, three by default", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1", { made_with: null })];
    answers.rebuilds = { "ran-1": ["a", "b", "c", "d"].map((id) => card(id)) };

    expect(WHERE_NEXT_PER_ROW).toBe(3);
    expect((await getWhereNextForViewer(VIEWER)).map((item) => item.build.id)).toEqual(["a", "b", "c"]);
    expect((await getWhereNextForViewer(VIEWER, 2)).map((item) => item.build.id)).toEqual(["a", "b"]);
  });

  it("returns [] when every candidate is excluded", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1", { made_with: null })];
    answers.rebuilds = { "ran-1": [card("mine", { creator_id: VIEWER })] };

    await expect(getWhereNextForViewer(VIEWER)).resolves.toEqual([]);
    // Only the runs read: no already-ran check and no sparkline read for nothing.
    expect(requestsTo("build_reproductions")).toHaveLength(1);
  });

  it("throws an error naming the operation when a read fails", async () => {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1")];
    answers.rebuilds = { "ran-1": [card("a")] };

    for (const [kind, name] of [["runs", "runs"], ["sources", "builds"], ["already", "already run"], ["sparks", "sparks"]] as const) {
      calls = [];
      builders = 0;
      failOn = kind;
      await expect(getWhereNextForViewer(VIEWER)).rejects.toThrow(new RegExp(`getWhereNextForViewer \\(${name}\\) failed: boom`));
    }
  });
});

describe("the sparklines", () => {
  function oneItem() {
    answers.runs = [run("ran-1")];
    answers.sources = [source("ran-1", { made_with: null })];
    answers.rebuilds = { "ran-1": [card("a"), card("b")] };
  }

  it("come from one read of build_id and created_at for the chosen builds over 14 days, capped at 1000", async () => {
    oneItem();
    await getWhereNextForViewer(VIEWER);

    const reads = requestsTo("build_reproductions").filter((id) => {
      const own = calls.filter((call) => call.builder === id);
      return !own.some((call) => call.method === "eq");
    });
    expect(reads).toHaveLength(1);
    const own = calls.filter((call) => call.builder === reads[0]);
    expect(own.find((call) => call.method === "select")?.args).toEqual(["build_id, created_at"]);
    expect(own.find((call) => call.method === "in")?.args).toEqual(["build_id", ["a", "b"]]);
    // 14 UTC days ending today (Oct 1): the first is Sep 18.
    expect(own.find((call) => call.method === "gte")?.args).toEqual(["created_at", "2026-09-18T00:00:00.000Z"]);
    expect(own.find((call) => call.method === "limit")?.args).toEqual([1000]);
  });

  it("are 14 daily counts, oldest first, today last", async () => {
    oneItem();
    answers.sparks = [
      { build_id: "a", created_at: "2026-10-01T09:00:00Z" },
      { build_id: "a", created_at: "2026-10-01T01:00:00Z" },
      { build_id: "a", created_at: "2026-09-30T23:59:00Z" },
      { build_id: "a", created_at: "2026-09-18T00:01:00Z" },
      { build_id: "b", created_at: "2026-09-25T12:00:00Z" },
    ];

    const [a, b] = await getWhereNextForViewer(VIEWER);

    expect(a.spark).toHaveLength(14);
    expect(a.spark).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2]);
    expect(b.spark).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
  });

  it("put a run at 23:59 UTC in its own day and one at 00:01 in the next", async () => {
    oneItem();
    answers.sparks = [
      { build_id: "a", created_at: "2026-09-29T23:59:00Z" },
      { build_id: "a", created_at: "2026-09-30T00:01:00Z" },
    ];

    const [a] = await getWhereNextForViewer(VIEWER);
    // Today is index 13: Sep 30 is 12 and Sep 29 is 11.
    expect(a.spark[11]).toBe(1);
    expect(a.spark[12]).toBe(1);
  });

  it("are all zeros for a build nobody ran, and ignore rows outside the window", async () => {
    oneItem();
    answers.sparks = [
      { build_id: "a", created_at: "2026-09-17T23:59:00Z" },
      { build_id: "unknown", created_at: "2026-10-01T09:00:00Z" },
    ];

    const [a, b] = await getWhereNextForViewer(VIEWER);
    expect(a.spark).toEqual(new Array(14).fill(0));
    expect(b.spark).toEqual(new Array(14).fill(0));
  });

  it("warn once when the row cap is reached, and still return the counts", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    oneItem();
    answers.sparks = Array.from({ length: 1000 }, () => ({ build_id: "a", created_at: "2026-10-01T09:00:00Z" }));

    const [a] = await getWhereNextForViewer(VIEWER);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(a.spark[13]).toBe(1000);
  });
});
