// SV-24 P2: the Builds layout: what is read back is checked, and it is kept under one versioned key. BF-07: the filters have no
// order, no opened list and no heights any more; a layout written before still reads, without them.

import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_LAYOUT, LAYOUT_KEY, isEmptyLayout, parseLayout, readStoredLayout, withCalculation, withColumns, withFilterColumns, writeStoredLayout } from "./buildsLayout";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("parseLayout", () => {
  it("keeps what is valid and drops the rest", () => {
    const layout = parseLayout({
      columns: ["build", "steps", 7],
      calculations: [{ column: "steps", kind: "sum" }, { column: "steps", kind: "sum" }, { column: "field", kind: "average" }, null],
    });
    expect(layout.columns).toEqual(["build", "steps"]);
    expect(layout.calculations).toEqual([{ column: "steps", kind: "sum" }]);
  });

  it("reads anything that is not an object as no layout, and an absent column list as the default", () => {
    for (const raw of [null, "x", 4, [], undefined]) expect(parseLayout(raw)).toEqual(EMPTY_LAYOUT);
    expect(parseLayout({}).columns).toBeNull();
    expect(isEmptyLayout(parseLayout({}))).toBe(true);
    expect(isEmptyLayout(withColumns(EMPTY_LAYOUT, ["build", "field"]))).toBe(false);
  });

  /* ── BF-07 P3 (A6) ── */

  it("buildsLayout: parseLayout ignores order, opened and heights from an older layout and keeps columns and calculations", () => {
    const layout = parseLayout({ order: ["field", "task"], opened: ["task"], heights: { field: 200 }, columns: ["build", "skill"], calculations: [{ column: "steps", kind: "median" }] });
    expect(layout).toEqual({ columns: ["build", "skill"], calculations: [{ column: "steps", kind: "median" }], filterColumns: true });
    expect(Object.keys(layout).sort()).toEqual(["calculations", "columns", "filterColumns"]);
  });

  it("buildsLayout: a layout with only old keys is empty", () => {
    const layout = parseLayout({ order: ["autonomy"], opened: ["task"], heights: { field: 480 } });
    expect(layout).toEqual(EMPTY_LAYOUT);
    expect(isEmptyLayout(layout)).toBe(true);
  });
});

describe("BF-11 filterColumns", () => {
  it("filterColumns is true by default, false only when the stored value is exactly false", () => {
    expect(EMPTY_LAYOUT.filterColumns).toBe(true);
    expect(parseLayout({}).filterColumns).toBe(true);
    for (const raw of [0, "false", null, "no"]) expect(parseLayout({ filterColumns: raw }).filterColumns).toBe(true);
    expect(parseLayout({ filterColumns: false }).filterColumns).toBe(false);
  });

  it("a layout that differs only by filterColumns being false is not empty", () => {
    expect(isEmptyLayout(withFilterColumns(EMPTY_LAYOUT, false))).toBe(false);
    expect(isEmptyLayout(withFilterColumns(withFilterColumns(EMPTY_LAYOUT, false), true))).toBe(true);
  });
});

describe("the browser's copy", () => {
  it("round-trips under the versioned key", () => {
    const layout = withCalculation(withColumns(EMPTY_LAYOUT, ["build", "field"]), { column: "steps", kind: "median" }, true);
    writeStoredLayout(layout);
    expect(Object.keys(localStorage)).toEqual([LAYOUT_KEY]);
    expect(LAYOUT_KEY).toBe("builds:layout:v1");
    expect(readStoredLayout()).toEqual(layout);
  });

  it("reads an older copy, holding the filters' order, without it", () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ order: ["field"], opened: [], heights: { task: 240 }, columns: null, calculations: [{ column: "reproductions", kind: "sum" }] }));
    expect(readStoredLayout()).toEqual({ columns: null, calculations: [{ column: "reproductions", kind: "sum" }], filterColumns: true });
  });

  it("reads nothing when the stored text is broken, and a failing store is not an error", () => {
    localStorage.setItem(LAYOUT_KEY, "{not json");
    expect(readStoredLayout()).toEqual(EMPTY_LAYOUT);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeStoredLayout(EMPTY_LAYOUT)).not.toThrow();
    expect(readStoredLayout()).toEqual(EMPTY_LAYOUT);
  });
});
