// BF-14 (B6): "Match n of m". A condition is one filter that holds a value and whose database rule the browser can apply to a row
// with proof (COUNTABLE); every other filter is required and stays ANDed on the server. Each evaluator is tested on the cases its
// database rule is tested with in src/lib/build/buildsTable.test.ts.

import { describe, expect, it } from "vitest";

import { confirmedCutoff, type BuildsTableBuild } from "@/lib/build/gallery";
import type { GalleryParams } from "@/lib/build/galleryParams";
import { MODEL_VERSIONS, modelKeysOf } from "@/lib/models/registry";

import { COUNTABLE, conditionsMet, countableIds, matchChoices, matchOf, meets, requiredOnly } from "./buildsModel";

const NOW = Date.parse("2026-11-10T15:00:00Z");
const DAY = 86_400_000;
const base: GalleryParams = { lens: "all", madeFor: [], madeWith: [], query: null };
const build = (over: Partial<BuildsTableBuild> = {}): BuildsTableBuild => ({
  id: "b1", slug: "b1", title: "B", shape: "app", madeWith: [], reproductionCount: 0, lastConfirmedAt: null, lastConfirmedModel: null, publishedAt: null,
  rebuildCount: 0, maker: null, open: { count: 0 }, stepCount: null, sessionCount: null, likeCount: 0, patterns: [], ...over,
});
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

describe("BF-14 meets: one evaluator per countable filter", () => {
  it("COUNTABLE holds the ten filters A1 proved", () => {
    expect([...COUNTABLE].sort()).toEqual(["likes", "model", "pattern", "rebuilds", "reproductions", "shape", "stack", "state", "steps", "within"]);
  });

  it("shape: shape IN the chosen shapes", () => {
    const params = { ...base, shapes: ["app", "agent"] };
    expect(meets(build({ shape: "agent" }), "shape", params, NOW)).toBe(true);
    expect(meets(build({ shape: "workflow" }), "shape", params, NOW)).toBe(false);
  });

  it("tool: made_with holds one of the tool's spellings", () => {
    const params = { ...base, tool: "claude-code" };
    expect(meets(build({ madeWith: ["Claude Code"] }), "stack", params, NOW)).toBe(true);
    expect(meets(build({ madeWith: ["Cursor"] }), "stack", params, NOW)).toBe(false);
  });

  it("pattern: patterns contains it", () => {
    expect(meets(build({ patterns: ["router", "long-running"] }), "pattern", { ...base, pattern: "router" }, NOW)).toBe(true);
    expect(meets(build({ patterns: [] }), "pattern", { ...base, pattern: "router" }, NOW)).toBe(false);
  });

  it("model: worked_models overlaps any spelling of the model", () => {
    const model = MODEL_VERSIONS[0];
    expect(meets(build({ workedModels: [modelKeysOf(model)[0]] }), "model", { ...base, model: model.id }, NOW)).toBe(true);
    expect(meets(build({ workedModels: [] }), "model", { ...base, model: model.id }, NOW)).toBe(false);
  });

  it("within: last confirmed at or after the cutoff from the start of today; never run is out", () => {
    const params = { ...base, within: 30 as const };
    const cutoff = confirmedCutoff(30, new Date(NOW));
    expect(meets(build({ lastConfirmedAt: cutoff }), "within", params, NOW)).toBe(true);
    expect(meets(build({ lastConfirmedAt: new Date(Date.parse(cutoff) - 1).toISOString() }), "within", params, NOW)).toBe(false);
    expect(meets(build({ lastConfirmedAt: null }), "within", params, NOW)).toBe(false);
  });

  it("state: run, and confirmed in the 120-day window or before it", () => {
    expect(meets(build({ reproductionCount: 2, lastConfirmedAt: ago(3) }), "state", { ...base, state: "confirmed" }, NOW)).toBe(true);
    expect(meets(build({ reproductionCount: 0, lastConfirmedAt: ago(3) }), "state", { ...base, state: "confirmed" }, NOW)).toBe(false);
    expect(meets(build({ reproductionCount: 2, lastConfirmedAt: ago(300) }), "state", { ...base, state: "stale" }, NOW)).toBe(true);
    expect(meets(build({ reproductionCount: 2, lastConfirmedAt: ago(3) }), "state", { ...base, state: "stale" }, NOW)).toBe(false);
  });

  it("the ranges: from and to on the counts, a build with no steps left out", () => {
    expect(meets(build({ reproductionCount: 5 }), "reproductions", { ...base, ranges: { reproductions: { min: 3 } } }, NOW)).toBe(true);
    expect(meets(build({ reproductionCount: 2 }), "reproductions", { ...base, ranges: { reproductions: { min: 3 } } }, NOW)).toBe(false);
    expect(meets(build({ rebuildCount: 9 }), "rebuilds", { ...base, ranges: { rebuilds: { max: 8 } } }, NOW)).toBe(false);
    expect(meets(build({ likeCount: 0 }), "likes", { ...base, ranges: { likes: { max: 8 } } }, NOW)).toBe(true);
    expect(meets(build({ stepCount: 12 }), "steps", { ...base, ranges: { steps: { min: 5, max: 30 } } }, NOW)).toBe(true);
    expect(meets(build({ stepCount: null }), "steps", { ...base, ranges: { steps: { max: 30 } } }, NOW)).toBe(false);
  });
});

describe("BF-14 counting conditions", () => {
  const params: GalleryParams = { ...base, shapes: ["app"], pattern: "router", ranges: { steps: { min: 5 } }, facets: ["field:law"], open: true };

  it("conditionsMet counts the filters a build meets, among those that hold a value and can be evaluated", () => {
    expect(countableIds(params)).toEqual(["shape", "pattern", "steps"]);
    expect(conditionsMet(build({ shape: "app", patterns: ["router"], stepCount: 9 }), params, NOW)).toBe(3);
    expect(conditionsMet(build({ shape: "app", patterns: [], stepCount: 2 }), params, NOW)).toBe(1);
  });

  it("a stack facet makes Tools required, even with tool set", () => {
    expect(countableIds({ ...base, tool: "claude-code", shapes: ["app"] })).toEqual(["stack", "shape"]);
    expect(countableIds({ ...base, tool: "claude-code", facets: ["stack:claude-code"], shapes: ["app"] })).toEqual(["shape"]);
  });

  it("matchChoices: with m countable filters on, the choices are All and m-1 down to 1; with fewer than two, there is no choice", () => {
    expect(matchChoices(params)).toEqual([3, 2, 1]);
    expect(matchChoices({ ...base, shapes: ["app"], facets: ["field:law"] })).toEqual([]);
  });

  it("requiredOnly: the address with every countable filter removed", () => {
    const required = requiredOnly({ ...params, match: 2, sort: "rebuilt" });
    expect(required).toMatchObject({ facets: ["field:law"], open: true, sort: "rebuilt" });
    expect(required.shapes).toBeUndefined();
    expect(required.pattern).toBeUndefined();
    expect(required.ranges).toBeUndefined();
    expect(required.match).toBeUndefined();
  });
});

describe("BF-14 matchOf: the match the page applies", () => {
  it("only below the count of countable filters, and only with two or more", () => {
    const params: GalleryParams = { ...base, shapes: ["app"], pattern: "router", ranges: { steps: { min: 5 } } };
    expect(matchOf({ ...params, match: 2 })).toBe(2);
    expect(matchOf({ ...params, match: 3 })).toBeNull();
    expect(matchOf({ ...base, shapes: ["app"], match: 1 })).toBeNull();
    expect(matchOf(params)).toBeNull();
  });
});
