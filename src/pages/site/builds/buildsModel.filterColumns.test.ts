// BF-11 (B1): a filter that holds a value has its column drawn, worked out from the address on every render. Nothing is stored.

import { describe, expect, it } from "vitest";

import { DEFAULT_GALLERY_SORT, type GalleryParams } from "@/lib/build/galleryParams";
import { GALLERY_SHAPES, type CountSpread, type WorksOnModelCount } from "@/lib/build/gallery";
import { MODEL_VERSIONS } from "@/lib/models/registry";
import { AUTONOMY_VALUES } from "@/lib/classify/taxonomy";

import { ALL_COLUMNS } from "./BuildsTableView";
import { FILTER_COLUMN, activeFilterIds, columnsMenu, drawnColumns, filteredColumns, panelSections } from "./buildsModel";

const base: GalleryParams = { lens: "all", madeFor: [], madeWith: [], query: null };

describe("BF-11 filter columns", () => {
  it("FILTER_COLUMN names a column for every filter id panelSections can emit", () => {
    const spread: CountSpread = { steps: new Map(), sessions: new Map(), reproductions: new Map(), rebuilds: new Map(), likes: new Map() };
    const worksOn: WorksOnModelCount[] = [{ model: MODEL_VERSIONS[0], builds: 1 }];
    const ids = panelSections({
      facets: [],
      shapes: [],
      open: false,
      counts: {},
      patterns: [{ value: "router", count: 1 }],
      order: "count",
      ranges: {},
      spread,
      worksOn,
    }).map((section) => section.id);
    expect(ids.length).toBe(26);
    for (const id of ids) {
      expect(FILTER_COLUMN, id).toHaveProperty(id);
      expect(ALL_COLUMNS).toContain(FILTER_COLUMN[id]);
    }
  });

  it("activeFilterIds: one id per filter holding a value", () => {
    const autonomy = AUTONOMY_VALUES[0].id;
    expect(activeFilterIds({ ...base, facets: ["field:education", "field:law"] })).toEqual(["field"]);
    expect(activeFilterIds({ ...base, facets: [`autonomy:${autonomy}`] })).toEqual(["autonomy"]);
    expect(activeFilterIds({ ...base, tool: "claude-code" })).toEqual(["stack"]);
    expect(activeFilterIds({ ...base, ranges: { steps: { min: 5 } } })).toEqual(["steps"]);
    expect(activeFilterIds({ ...base, within: 30 })).toEqual(["within"]);
    expect(activeFilterIds({ ...base, state: "stale" })).toEqual(["state"]);
    expect(activeFilterIds({ ...base, model: MODEL_VERSIONS[0].id })).toEqual(["model"]);
    expect(activeFilterIds({ ...base, pattern: "router" })).toEqual(["pattern"]);
    expect(activeFilterIds({ ...base, open: true })).toEqual(["open"]);
    expect(activeFilterIds({ ...base, shapes: [GALLERY_SHAPES[0], GALLERY_SHAPES[1]] })).toEqual(["shape"]);
    expect(activeFilterIds({ ...base, query: "agent" })).toEqual([]);
    expect(activeFilterIds({ ...base, sort: DEFAULT_GALLERY_SORT })).toEqual([]);
  });

  it("drawnColumns: the reader's columns, then the filtered ones not already there, in the table's own order", () => {
    expect(drawnColumns(["build", "field"], ["autonomy", "field"], true, true)).toEqual(["build", "field", "autonomy"]);
    expect(drawnColumns(["build"], ["skill", "tools", "autonomy"], true, true)).toEqual(["build", "tools", "autonomy", "skill"]);
  });

  it("drawnColumns: with the setting off, only the reader's columns", () => {
    expect(drawnColumns(["build", "field"], ["autonomy"], false, true)).toEqual(["build", "field"]);
  });

  it("drawnColumns: a filtered column that is not available (Steps without the stored counts) is left out", () => {
    expect(drawnColumns(["build"], ["steps", "works", "shape"], true, false)).toEqual(["build", "shape"]);
    expect(drawnColumns(["build"], ["steps", "works", "shape"], true, true)).toEqual(["build", "steps", "shape", "works"]);
  });

  it("filteredColumns: Last confirmed and Confirmed or stale both mark the one column", () => {
    expect(filteredColumns({ ...base, within: 30, state: "confirmed" })).toEqual(["confirmed"]);
    expect(filteredColumns({ ...base, tool: "claude-code", facets: ["stack:claude-code"] })).toEqual(["tools"]);
  });

  it("columnsMenu: a column drawn because of a filter is on and locked, and says so", () => {
    const menu = columnsMenu(["build", "field"], true, () => undefined, undefined, ["autonomy", "field"]);
    const autonomy = menu.options.find((option) => option.id === "autonomy");
    expect(autonomy).toMatchObject({ on: true, locked: true, name: "Autonomy, from a filter" });
    expect(menu.options.find((option) => option.id === "field")).toMatchObject({ on: true, name: "Field" });
    expect(menu.options.find((option) => option.id === "field")?.locked).toBeUndefined();
  });
});
