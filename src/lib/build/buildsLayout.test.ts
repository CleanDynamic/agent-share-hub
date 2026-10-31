// SV-24 P2: the Builds layout: what is read back is checked, the order moves only the filters that are drawn, and a drag lands
// where the pointer passed.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_LAYOUT,
  HEIGHT_MAX,
  HEIGHT_MIN,
  LAYOUT_KEY,
  dropIndex,
  effectiveOrder,
  isEmptyLayout,
  moved,
  orderedBy,
  parseLayout,
  placed,
  readStoredLayout,
  withCalculation,
  withHeight,
  writeStoredLayout,
} from "./buildsLayout";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("parseLayout", () => {
  it("keeps what is valid and drops the rest", () => {
    const layout = parseLayout({
      order: ["field", "field", 3, "", "task"],
      opened: ["task"],
      heights: { field: 9999, task: 10, bad: "tall" },
      columns: ["build", "steps", 7],
      calculations: [{ column: "steps", kind: "sum" }, { column: "steps", kind: "sum" }, { column: "field", kind: "average" }, null],
    });
    expect(layout.order).toEqual(["field", "task"]);
    expect(layout.heights).toEqual({ field: HEIGHT_MAX, task: HEIGHT_MIN });
    expect(layout.columns).toEqual(["build", "steps"]);
    expect(layout.calculations).toEqual([{ column: "steps", kind: "sum" }]);
  });

  it("reads anything that is not an object as no layout, and an absent column list as the default", () => {
    for (const raw of [null, "x", 4, [], undefined]) expect(parseLayout(raw)).toEqual(EMPTY_LAYOUT);
    expect(parseLayout({}).columns).toBeNull();
    expect(isEmptyLayout(parseLayout({}))).toBe(true);
    expect(isEmptyLayout(withHeight(EMPTY_LAYOUT, "field", 200))).toBe(false);
  });
});

describe("the browser's copy", () => {
  it("round-trips under the versioned key", () => {
    const layout = withCalculation(withHeight(EMPTY_LAYOUT, "field", 200), { column: "steps", kind: "median" }, true);
    writeStoredLayout(layout);
    expect(Object.keys(localStorage)).toEqual([LAYOUT_KEY]);
    expect(readStoredLayout()).toEqual(layout);
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

describe("ordering", () => {
  const ids = ["field", "task", "setting", "built"];

  it("puts the named ids first, drops those that are gone, and keeps the rest in their order", () => {
    expect(effectiveOrder(ids, ["built", "gone", "field"])).toEqual(["built", "field", "task", "setting"]);
    expect(orderedBy(ids.map((id) => ({ id })), ["setting"]).map((item) => item.id)).toEqual(["setting", "field", "task", "built"]);
  });

  it("moves a filter one place among those drawn open, leaving the closed ones where they are", () => {
    const effective = ["field", "task", "setting", "built"];
    const visible = ["field", "setting"]; // task and built are closed rows
    expect(moved(effective, visible, "setting", "up")).toEqual(["setting", "task", "field", "built"]);
    expect(moved(effective, visible, "field", "down")).toEqual(["setting", "task", "field", "built"]);
  });

  it("does nothing at either end of the list, or for a filter that is not drawn", () => {
    const effective = ["field", "task"];
    expect(moved(effective, ["field", "task"], "field", "up")).toEqual(effective);
    expect(moved(effective, ["field", "task"], "task", "down")).toEqual(effective);
    expect(placed(effective, ["field"], "task", 0)).toEqual(effective);
  });

  it("places a dragged filter at an index, clamped", () => {
    expect(placed(["a", "b", "c"], ["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
    expect(placed(["a", "b", "c"], ["a", "b", "c"], "c", -5)).toEqual(["c", "a", "b"]);
    expect(placed(["a", "b", "c"], ["a", "b", "c"], "a", 99)).toEqual(["b", "c", "a"]);
  });
});

describe("dropIndex", () => {
  const centres = [{ id: "a", centre: 50 }, { id: "b", centre: 150 }, { id: "c", centre: 250 }];

  it("counts the others the dragged centre has passed", () => {
    expect(dropIndex(centres, "a", 40)).toBe(0);
    expect(dropIndex(centres, "a", 200)).toBe(1);
    expect(dropIndex(centres, "a", 900)).toBe(2);
    expect(dropIndex(centres, "c", 60)).toBe(1);
  });
});
