// BF-11 (B1): a filter that holds a value draws its column. The columns are worked out from the address, never stored.

import { describe, expect, it } from "vitest";

import { parseGalleryParams } from "@/lib/build/galleryParams";
import { AUTONOMY_VALUES, TAXONOMY } from "@/lib/classify/taxonomy";
import { MODEL_VERSIONS } from "@/lib/models/registry";
import { TOOLS } from "@/lib/tools/registry";

import { ALL_COLUMNS } from "./BuildsTableView";
import { FILTER_COLUMN, activeFilterIds, drawnColumns, filteredColumns, panelSections } from "./buildsModel";

const params = (search: string) => parseGalleryParams(new URLSearchParams(search));
const facetKey = (facet: keyof typeof TAXONOMY) => `${facet}:${TAXONOMY[facet].find((value) => value.depth === (facet === "stack" ? 1 : 0))!.id}`;

describe("BF-11 filter columns", () => {
  it("FILTER_COLUMN names a column for every filter id panelSections can emit", () => {
    const sections = panelSections({
      facets: [],
      shapes: [],
      open: false,
      counts: {},
      patterns: [{ value: "router", count: 1 }],
      order: "count",
      spread: { steps: new Map(), sessions: new Map(), reproductions: new Map(), rebuilds: new Map(), likes: new Map() },
      worksOn: [{ model: MODEL_VERSIONS[0], builds: 1 }],
    });
    const ids = sections.map((section) => section.id);
    expect(ids.length).toBeGreaterThan(25);
    for (const id of ids) {
      expect(FILTER_COLUMN[id], id).toBeDefined();
      expect(ALL_COLUMNS).toContain(FILTER_COLUMN[id]);
    }
  });

  it("activeFilterIds: one id per filter holding a value", () => {
    const field = TAXONOMY.field.filter((value) => value.depth === 0);
    expect(activeFilterIds(params(`f=field:${field[0].id}&f=field:${field[1].id}`))).toEqual(["field"]);
    expect(activeFilterIds(params(`tool=${TOOLS[0].id}`))).toEqual(["stack"]);
    expect(activeFilterIds(params(`f=${facetKey("stack")}`))).toEqual(["stack"]);
    expect(activeFilterIds(params("steps=5-30"))).toEqual(["steps"]);
    expect(activeFilterIds(params("within=30"))).toEqual(["within"]);
    expect(activeFilterIds(params("state=stale"))).toEqual(["state"]);
    expect(activeFilterIds(params(`model=${MODEL_VERSIONS[0].id}`))).toEqual(["model"]);
    expect(activeFilterIds(params("pattern=router"))).toEqual(["pattern"]);
    expect(activeFilterIds(params("open=1"))).toEqual(["open"]);
    expect(activeFilterIds(params("shape=agent&shape=app"))).toEqual(["shape"]);
    expect(activeFilterIds(params("q=notes"))).toEqual([]);
  });

  it("drawnColumns: the reader's columns, then the filtered ones not already there, in the table's own order", () => {
    expect(drawnColumns(["build", "field"], ["autonomy", "field"], true, true)).toEqual(["build", "field", "autonomy"]);
    expect(drawnColumns(["build"], ["autonomy", "shape"], true, true)).toEqual(["build", "shape", "autonomy"]);
  });

  it("drawnColumns: with the setting off, only the reader's columns", () => {
    expect(drawnColumns(["build", "field"], ["autonomy"], false, true)).toEqual(["build", "field"]);
  });

  it("drawnColumns: a filtered column that is not available (Steps without the stored counts) is left out", () => {
    expect(drawnColumns(["build"], ["steps", "autonomy"], true, false)).toEqual(["build", "autonomy"]);
  });

  it("filteredColumns: Last confirmed and Confirmed or stale both mark the one column", () => {
    expect(filteredColumns(params("within=30&state=confirmed"))).toEqual(["confirmed"]);
    expect(filteredColumns(params(`f=autonomy:${AUTONOMY_VALUES[0].id}&tool=${TOOLS[0].id}`))).toEqual(["autonomy", "tools"]);
  });
});
