// BF-14 (B6): match some conditions. Each countable filter is decided in the browser by the same rule the database applies
// (applyTableFilters), on the same cases.

import { describe, expect, it } from "vitest";

import { confirmedCutoff, type BuildsTableBuild } from "@/lib/build/gallery";
import { galleryHref, parseGalleryParams } from "@/lib/build/galleryParams";
import { emptyClassification } from "@/lib/classify/facets";
import { MODEL_VERSIONS, modelKeysOf } from "@/lib/models/registry";

import { activeChips, COUNTABLE, conditionsMet, matchChoices, meets, requiredOnly, withoutChip } from "./buildsModel";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const DAY = 86_400_000;
const params = (search: string) => parseGalleryParams(new URLSearchParams(search));
const build = (over: Partial<BuildsTableBuild> = {}): BuildsTableBuild => ({
  id: "b", slug: "b", title: "B", shape: "app", madeWith: [], reproductionCount: 0, lastConfirmedAt: null, lastConfirmedModel: null, publishedAt: null,
  rebuildCount: 0, maker: null, open: { count: 0 }, stepCount: null, sessionCount: null, likeCount: 0, patterns: [], workedModels: [], ...over,
});
const inField = (id: string) => ({ ...emptyClassification(), declared: { ...emptyClassification().declared, field: [{ id }] } });

describe("meets, one filter at a time, as the database decides it", () => {
  it("a facet: the build's computed facets hold one of the chosen keys (an OR within the facet)", () => {
    const p = params("f=field%3Alaw&f=field%3Aeducation");
    expect(meets(build({ classifiedAs: inField("law") }), "field", p, NOW)).toBe(true);
    expect(meets(build({ classifiedAs: inField("medicine") }), "field", p, NOW)).toBe(false);
    expect(meets(build(), "field", p, NOW)).toBe(false);
  });

  it("Tools and stack: made_with names the tool (tool=), as madeWithSpellings", () => {
    const p = params("tool=claude-code");
    expect(meets(build({ madeWith: ["Claude Code"] }), "stack", p, NOW)).toBe(true);
    expect(meets(build({ madeWith: ["Cursor"] }), "stack", p, NOW)).toBe(false);
  });

  it("Shape: one of the chosen shapes", () => {
    const p = params("shape=agent&shape=workflow");
    expect(meets(build({ shape: "agent" }), "shape", p, NOW)).toBe(true);
    expect(meets(build({ shape: "app" }), "shape", p, NOW)).toBe(false);
  });

  it("Patterns: the build's patterns hold it", () => {
    const p = params("pattern=router");
    expect(meets(build({ patterns: ["router", "long-running"] }), "pattern", p, NOW)).toBe(true);
    expect(meets(build({ patterns: [] }), "pattern", p, NOW)).toBe(false);
  });

  it("a range: between min and max, and a build with no count is left out", () => {
    const p = params("steps=5-30&reproductions=2-");
    expect(meets(build({ stepCount: 5 }), "steps", p, NOW)).toBe(true);
    expect(meets(build({ stepCount: 31 }), "steps", p, NOW)).toBe(false);
    expect(meets(build({ stepCount: null }), "steps", p, NOW)).toBe(false);
    expect(meets(build({ reproductionCount: 2 }), "reproductions", p, NOW)).toBe(true);
    expect(meets(build({ reproductionCount: 1 }), "reproductions", p, NOW)).toBe(false);
  });

  it("Last confirmed: on or after the same cutoff the database reads (confirmedCutoff)", () => {
    const p = params("within=30");
    const cutoff = Date.parse(confirmedCutoff(30, new Date(NOW)));
    expect(meets(build({ lastConfirmedAt: new Date(cutoff).toISOString() }), "within", p, NOW)).toBe(true);
    expect(meets(build({ lastConfirmedAt: new Date(cutoff - 1).toISOString() }), "within", p, NOW)).toBe(false);
    expect(meets(build(), "within", p, NOW)).toBe(false);
  });

  it("Confirmed or stale: run at least once, and inside or outside the window", () => {
    const fresh = build({ reproductionCount: 1, lastConfirmedAt: new Date(NOW - 2 * DAY).toISOString() });
    const stale = build({ reproductionCount: 1, lastConfirmedAt: new Date(NOW - 400 * DAY).toISOString() });
    expect(meets(fresh, "state", params("state=confirmed"), NOW)).toBe(true);
    expect(meets(stale, "state", params("state=confirmed"), NOW)).toBe(false);
    expect(meets(stale, "state", params("state=stale"), NOW)).toBe(true);
    expect(meets(build({ lastConfirmedAt: new Date(NOW - 400 * DAY).toISOString() }), "state", params("state=stale"), NOW)).toBe(false);
  });

  it("Works on model: worked_models holds one of the model's keys", () => {
    const model = MODEL_VERSIONS[0];
    const p = params(`model=${model.id}`);
    expect(meets(build({ workedModels: [modelKeysOf(model)[0]] }), "model", p, NOW)).toBe(true);
    expect(meets(build({ workedModels: [] }), "model", p, NOW)).toBe(false);
  });
});

describe("counting", () => {
  it("conditionsMet counts the filters a build meets, among those that hold a value and can be evaluated", () => {
    const p = params("f=field%3Alaw&shape=agent&steps=5-30&sessions=1-&open=1");
    expect(conditionsMet(build({ classifiedAs: inField("law"), shape: "app", stepCount: 9 }), p, NOW)).toBe(2);
    expect(COUNTABLE.has("sessions")).toBe(false);
    expect(COUNTABLE.has("open")).toBe(false);
  });

  it("matchChoices: with m countable filters on, the choices are All and m-1 down to 1; with fewer than two, there is no choice", () => {
    expect(matchChoices(params("f=field%3Alaw&shape=agent&steps=5-30"))).toEqual([3, 2, 1]);
    expect(matchChoices(params("f=field%3Alaw&open=1&sessions=1-"))).toEqual([]);
    expect(matchChoices(params(""))).toEqual([]);
  });

  it("requiredOnly keeps the lens, the sort, the search and the required filters, and drops the countable ones and match", () => {
    const p = params("lens=proven&f=field%3Alaw&tool=claude-code&shape=agent&steps=5-30&sessions=1-&open=1&sort=newest&match=2&q=notes");
    expect(galleryHref(requiredOnly(p))).toBe("/builds?lens=proven&open=1&sessions=1-&sort=newest&q=notes");
  });

  it('one extra chip reads "Match · at least 2 of 3", and removing it returns to All', () => {
    const p = params("f=field%3Alaw&shape=agent&steps=5-30&match=2");
    expect(activeChips(p).find((chip) => chip.key === "match")).toEqual({ key: "match", name: "Match", value: "at least 2 of 3" });
    expect(withoutChip(p, "match").match).toBeUndefined();
  });
});
