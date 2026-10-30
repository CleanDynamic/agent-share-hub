// SV-23: the number filters in the panel: the histogram, the slider's ends as an address, the chip and the footer's median.

import { describe, expect, it } from "vitest";

import { parseGalleryParams } from "@/lib/build/galleryParams";

import { activeChips, histogramOf, liveCatalogue, medianOf, panelSections, tableFooter, toggled, withRange, withoutChip } from "./buildsModel";
import type { RangeSection } from "./BuildsFiltersView";

const params = (search: string) => parseGalleryParams(new URLSearchParams(search));
const STATE = { facets: [], shapes: [], open: false, counts: null, patterns: null, opened: new Set<string>(), orders: {} };

describe("histogramOf", () => {
  it("makes twelve bars, the tallest full height, with the cap's builds in the last", () => {
    const bars = histogramOf(new Map([[0, 2], [30, 8], [60, 4]]), 60, undefined);
    expect(bars).toHaveLength(12);
    expect(Math.max(...bars.map((bar) => bar.height))).toBe(1);
    expect(bars[0].height).toBe(0.25);
    expect(bars[11].height).toBe(0.5);
    expect(bars.every((bar) => bar.inRange)).toBe(true);
  });

  it("marks the bars the chosen range reaches", () => {
    const bars = histogramOf(new Map([[1, 1]]), 60, { min: 20, max: 40 });
    const inside = bars.flatMap((bar, at) => (bar.inRange ? [at] : []));
    expect(inside[0]).toBeGreaterThan(0);
    expect(inside.at(-1)).toBeLessThan(11);
  });

  it("is flat for no builds", () => {
    expect(histogramOf(undefined, 20, undefined).every((bar) => bar.height === 0)).toBe(true);
  });
});

describe("withRange", () => {
  it("writes the slider's ends, leaving an end at the scale's edge as no limit", () => {
    expect(withRange(params(""), "steps", [5, 30]).ranges).toEqual({ steps: { min: 5, max: 30 } });
    expect(withRange(params(""), "steps", [5, 60]).ranges).toEqual({ steps: { min: 5 } });
    expect(withRange(params(""), "sessions", [0, 4]).ranges).toEqual({ sessions: { max: 4 } });
  });

  it("takes the filter away when both ends are at the edges, and keeps the others", () => {
    expect(withRange(params("steps=5-30"), "steps", [0, 60]).ranges).toBeUndefined();
    expect(withRange(params("steps=5-30&sessions=2-"), "steps", [0, 60]).ranges).toEqual({ sessions: { min: 2 } });
  });
});

describe("the chip and the panel", () => {
  it("has a chip for each range, and removing it leaves the rest", () => {
    const chosen = params("steps=5-30&sessions=2-");
    expect(activeChips(chosen)).toEqual([
      { key: "range:steps", name: "Steps", value: "5 to 30" },
      { key: "range:sessions", name: "Sessions", value: "2 or more" },
    ]);
    expect(withoutChip(chosen, "range:steps").ranges).toEqual({ sessions: { min: 2 } });
    expect(withoutChip(withoutChip(chosen, "range:steps"), "range:sessions").ranges).toBeUndefined();
  });

  it("draws no range before the spread has answered", () => {
    expect(panelSections({ ...STATE, spread: null }).some((section) => section.id === "steps")).toBe(false);
  });

  it("draws a range closed, or open with its value in words once chosen", () => {
    const spread = { steps: new Map([[4, 3]]), sessions: new Map([[1, 3]]) };
    const closed = panelSections({ ...STATE, spread }).find((section) => section.id === "steps");
    expect(closed).toMatchObject({ kind: "closed", value: "Any" });
    const open = panelSections({ ...STATE, spread, ranges: { steps: { min: 5, max: 30 } } }).find((section) => section.id === "steps") as RangeSection;
    expect(open).toMatchObject({ kind: "range", valueText: "5 to 30", value: [5, 30], min: 0, max: 60 });
    expect(open.describe(5, "min")).toBe("5 or more");
    expect(open.describe(60, "max")).toBe("no limit");
    expect(open.describe(30, "max")).toBe("up to 30");
  });
});

describe("the median", () => {
  it("is the middle, or the mean of the two in the middle", () => {
    expect(medianOf([])).toBeNull();
    expect(medianOf([9, 1, 5])).toBe(5);
    expect(medianOf([4, 12])).toBe(8);
  });

  it("names steps in the footer, and says nothing when no row has a count", () => {
    const row = (steps: number | null) => ({ field: "", tools: [], reproductions: 0, steps }) as never;
    expect(tableFooter(2, [row(4), row(12), row(null)]).median).toBe("Median 8 steps");
    expect(tableFooter(1, [row(1)]).median).toBe("Median 1 step");
    expect(tableFooter(1, [row(null)]).median).toBeUndefined();
  });
});

describe("the proof (SV-23 P2)", () => {
  const OPUS = { model: { id: "opus-5-5", name: "Opus 5.5" }, builds: 18 } as never;
  const SPREAD = { reproductions: new Map([[1, 3]]), rebuilds: new Map(), likes: new Map(), steps: new Map(), sessions: new Map() };
  const ids = (state: object) => panelSections({ ...STATE, ...state }).map((section) => section.id);

  it("draws Last confirmed and Confirmed or stale without any stored count, and the rest with it", () => {
    expect(ids({ spread: null, worksOn: null })).toEqual(expect.arrayContaining(["within", "state", "shape"]));
    expect(ids({ spread: null, worksOn: null })).not.toContain("model");
    expect(ids({ spread: null, worksOn: null })).not.toContain("reproductions");
    expect(ids({ spread: SPREAD, worksOn: [OPUS] }).filter((id) => ["reproductions", "model", "within", "state", "rebuilds", "likes", "shape", "steps", "sessions"].includes(id))).toEqual([
      "reproductions", "model", "within", "state", "rebuilds", "likes", "shape", "steps", "sessions",
    ]);
  });

  it("holds the chosen value on each, and opens it", () => {
    const sections = panelSections({ ...STATE, spread: SPREAD, worksOn: [OPUS], model: "opus-5-5", within: 30, confirmState: "stale" });
    expect(sections.find((section) => section.id === "model")).toMatchObject({ kind: "word", options: [{ key: "opus-5-5", label: "Opus 5.5", count: 18, checked: true }] });
    expect(sections.find((section) => section.id === "within")).toMatchObject({ kind: "word", options: expect.arrayContaining([{ key: "within:30", label: "Within 30 days", checked: true }]) });
    expect(sections.find((section) => section.id === "state")).toMatchObject({ kind: "word" });
  });

  it("is a choice of one: choosing the held value clears it, another replaces it", () => {
    expect(toggled(params("model=opus-5-5"), "model", "opus-5-5").model).toBeUndefined();
    expect(toggled(params(""), "model", "opus-5-5").model).toBe("opus-5-5");
    expect(toggled(params("within=7"), "within", "within:30").within).toBe(30);
    expect(toggled(params("within=7"), "within", "within:7").within).toBeUndefined();
    expect(toggled(params("state=stale"), "state", "state:confirmed").state).toBe("confirmed");
    expect(toggled(params("state=stale"), "state", "state:stale").state).toBeUndefined();
  });

  it("has a chip for each, in words, and removing it clears only it", () => {
    const chosen = params("model=opus-5-5&within=30&state=stale&reps=2");
    expect(activeChips(chosen).map((chip) => [chip.name, chip.value])).toEqual([["Works on", "Opus 5.5"], ["Last confirmed", "Within 30 days"], ["Confirmed or stale", "Stale"]]);
    expect(withoutChip(chosen, "model").model).toBeUndefined();
    expect(withoutChip(chosen, "within").within).toBeUndefined();
    expect(withoutChip(chosen, "state").state).toBeUndefined();
    expect(withoutChip(chosen, "within").state).toBe("stale");
  });

  it("lists in the catalogue only the filters that work", () => {
    const names = (groups: ReturnType<typeof liveCatalogue>, group: string) => groups.find((entry) => entry.name === group)?.items;
    expect(names(liveCatalogue(true, false), "Proof")).toBe("Last confirmed, Confirmed or stale");
    expect(names(liveCatalogue(true, false, true, true), "Proof")).toBe("Reproductions, Works on model, Last confirmed, Confirmed or stale, Rebuilds, Likes");
    expect(names(liveCatalogue(true, true, true, true), "Structure")).toBe("Shape, Steps, Sessions, Patterns");
  });
});
