// SV-24 P2: the Table's columns the reader chose, and the footer's calculations, worked out from the rows on the page.

import { describe, expect, it } from "vitest";

import { ALL_COLUMNS, COLUMN_ORDER, EXTRA_COLUMNS, type TableRowView } from "./BuildsTableView";
import { availableColumns, calculate, calculationOptions, calculationsFor, chosenColumns, columnsLabel, columnsMenu, footerCalculations, tableRow, toggledColumns } from "./buildsModel";
import { emptyClassification } from "@/lib/classify/facets";
import { MODEL_VERSIONS, modelKeysOf } from "@/lib/models/registry";

const row = (over: Partial<TableRowView> = {}): TableRowView => ({
  id: "b1", href: "/b2/b1", title: "T", maker: "kit", built: "Agent", field: "Sales", tools: [{ id: "claude-code", name: "Claude Code" }], steps: 10, sessions: 2, reproductions: 4,
  lit: true, confirmed: "", runs: [], rebuilds: 1, open: "", cost: "Free", ...over,
});

describe("the columns", () => {
  // BF-10: four more, 28 in all.
  it("are 28: the board's twelve and sixteen more, the extras after", () => {
    expect(COLUMN_ORDER).toHaveLength(12);
    expect(EXTRA_COLUMNS).toHaveLength(16);
    expect(ALL_COLUMNS).toHaveLength(28);
    expect(ALL_COLUMNS.slice(0, 12)).toEqual(COLUMN_ORDER);
    // BF-12: the list kept in src/lib is the view's own, in the same order.
    expect(ALL_COLUMNS).toEqual([...COLUMN_ORDER, ...EXTRA_COLUMNS]);
    expect(new Set(ALL_COLUMNS).size).toBe(28);
  });

  it("offer all 28 once the stored counts are live, and 25 until then (no Steps, Sessions or Works on model)", () => {
    expect(availableColumns(true)).toHaveLength(28);
    expect(availableColumns(false)).toHaveLength(25);
    expect(availableColumns(false)).not.toContain("steps");
    expect(availableColumns(false)).not.toContain("works");
  });

  it("are the default twelve until the reader chooses", () => {
    expect(chosenColumns(null, true)).toEqual(COLUMN_ORDER);
    expect(columnsLabel(chosenColumns(null, true), true)).toBe("12 of 28");
    expect(columnsLabel(chosenColumns(null, false), false)).toBe("10 of 25");
  });

  it("keep what the reader chose, in the table's own order, always with Build, and never one that is not live", () => {
    expect(chosenColumns(["skill", "cost", "steps"], true)).toEqual(["build", "steps", "cost", "skill"]);
    expect(chosenColumns(["skill", "steps", "nope"], false)).toEqual(["build", "skill"]);
    expect(chosenColumns([], true)).toEqual(["build"]);
  });

  it("toggle one column, and Build stays", () => {
    const chosen = chosenColumns(null, true);
    expect(toggledColumns(chosen, "task")).toContain("task");
    expect(toggledColumns(chosen, "cost")).not.toContain("cost");
    expect(toggledColumns(chosen, "build")).toContain("build");
  });

  it("make the chooser's checklist with Build fixed on", () => {
    const menu = columnsMenu(chosenColumns(null, true), true, () => undefined);
    expect(menu.options).toHaveLength(28);
    expect(menu.options.find((option) => option.id === "build")).toMatchObject({ on: true, locked: true });
    expect(menu.options.find((option) => option.id === "task")).toMatchObject({ on: false, name: "Task" });
    expect(menu.onReset).toBeUndefined();
  });
});

describe("the extra columns' values", () => {
  it("are worked out only for the columns drawn", () => {
    const build = {
      id: "b1", slug: "b1", title: "T", shape: "agent", madeWith: [], reproductionCount: 0, lastConfirmedAt: null, lastConfirmedModel: null, publishedAt: null, rebuildCount: 0,
      maker: null, open: { count: 0, reward: null }, classifiedAs: { ...emptyClassification(), derived: { skill: { values: ["no-coding"] } } },
    };
    expect(tableRow(build as never, 0).extra).toBeUndefined();
    const withExtras = tableRow(build as never, 0, ["shape", "task", "skill"]);
    expect(withExtras.extra?.shape).toBe("Agent");
    expect(withExtras.extra?.skill).toBe("No coding");
    expect(withExtras.extra?.task).toBe("");
  });
});

describe("the calculations", () => {
  const rows = [row({ steps: 10, reproductions: 4, field: "Sales" }), row({ id: "b2", steps: 4, reproductions: 1, field: "Law" }), row({ id: "b3", steps: null, reproductions: 3, field: "Sales", tools: [{ id: "lovable", name: "Lovable" }] })];

  it("offer a sum and a median of a count, and the most common of a word", () => {
    expect(calculationsFor("steps")).toEqual(["sum", "median"]);
    expect(calculationsFor("field")).toEqual(["common"]);
    expect(calculationsFor("skill")).toEqual(["common"]);
    expect(calculationsFor("build")).toEqual([]);
    expect(calculationsFor("runs")).toEqual([]);
  });

  it("work out from the rows on the page, leaving out a row with no count", () => {
    expect(calculate({ column: "steps", kind: "sum" }, rows)).toBe("14");
    expect(calculate({ column: "steps", kind: "median" }, rows)).toBe("7");
    expect(calculate({ column: "reproductions", kind: "sum" }, rows)).toBe("8");
    expect(calculate({ column: "reproductions", kind: "median" }, rows)).toBe("3");
    expect(calculate({ column: "field", kind: "common" }, rows)).toBe("Sales");
    expect(calculate({ column: "tools", kind: "common" }, rows)).toBe("Claude Code");
  });

  it("are none where no row has a value, or the kind does not fit the column", () => {
    expect(calculate({ column: "steps", kind: "sum" }, [row({ steps: null })])).toBeNull();
    expect(calculate({ column: "field", kind: "sum" }, rows)).toBeNull();
    expect(calculate({ column: "skill", kind: "common" }, [row()])).toBeNull();
  });

  it("list the ones added as footer entries, for the drawn columns only, and say where they cannot be worked out", () => {
    const added = [{ column: "steps", kind: "sum" as const }, { column: "cost", kind: "common" as const }, { column: "skill", kind: "common" as const }];
    const entries = footerCalculations(added, ["build", "steps", "cost"], rows, () => undefined);
    expect(entries.map((entry) => entry.text)).toEqual(["Sum, Steps 14", "Most common, Cost to run Free"]);
    expect(footerCalculations([{ column: "steps", kind: "median" }], ["build", "steps"], [row({ steps: null })], () => undefined)[0].text).toBe("Median, Steps –");
  });

  it("make the menu from the drawn columns that can have one, with the ones added ticked", () => {
    const options = calculationOptions([{ column: "steps", kind: "sum" }], ["build", "steps", "field", "runs"]);
    expect(options.map((option) => option.column)).toEqual(["steps", "field"]);
    expect(options[0].kinds).toEqual([{ kind: "sum", label: "Sum", on: true }, { kind: "median", label: "Median", on: false }]);
    expect(options[1].kinds).toEqual([{ kind: "common", label: "Most common", on: false }]);
  });
});

/* ── BF-10 P2 ── */

describe("the four new columns", () => {
  const NOW = Date.parse("2026-11-10T12:00:00Z");
  const base = {
    id: "b1", slug: "b1", title: "T", shape: "agent", madeWith: [], reproductionCount: 0, lastConfirmedAt: null, lastConfirmedModel: null, publishedAt: null, rebuildCount: 0,
    maker: null, open: { count: 0 },
  };
  const keyOf = (index: number) => modelKeysOf(MODEL_VERSIONS[index])[0];
  const extra = (over: object) => tableRow({ ...base, ...over }, NOW, ["works", "likes", "patterns", "published"]).extra!;

  it('Works on model lists up to two model names and "+ n" for the rest; none is empty', () => {
    const names = [0, 1, 2, 3].map((index) => MODEL_VERSIONS[index].name);
    expect(extra({ workedModels: [keyOf(0)] }).works).toBe(names[0]);
    expect(extra({ workedModels: [keyOf(0), keyOf(0), keyOf(1)] }).works).toBe(`${names[0]}, ${names[1]}`);
    expect(extra({ workedModels: [keyOf(0), keyOf(1), keyOf(2), keyOf(3)] }).works).toBe(`${names[0]}, ${names[1]} + 2`);
    expect(extra({ workedModels: [] }).works).toBe("");
    expect(extra({}).works).toBe("");
  });

  it("Likes is the number", () => {
    expect(extra({ likeCount: 4 }).likes).toBe("4");
    expect(extra({ likeCount: 0 }).likes).toBe("0");
  });

  it('Patterns joins the pattern labels with ", "', () => {
    expect(extra({ patterns: ["router", "structured-output"] }).patterns).toBe("Uses a router, Structured output");
    expect(extra({ patterns: [] }).patterns).toBe("");
  });

  it("Published is how long ago, as Last confirmed writes it", () => {
    const at = "2026-11-08T12:00:00Z";
    expect(extra({ publishedAt: at }).published).toBe("2d ago");
    expect(tableRow({ ...base, lastConfirmedAt: at }, NOW).confirmed).toBe("2d ago");
    expect(extra({ publishedAt: null }).published).toBe("");
  });

  it("the calculations read the lists and the number, not the joined cell", () => {
    const rows = [tableRow({ ...base, likeCount: 3, patterns: ["router"], workedModels: [keyOf(0), keyOf(1)] }, NOW, ["works", "likes", "patterns"]), tableRow({ ...base, likeCount: 5, workedModels: [keyOf(1)] }, NOW, ["works", "likes", "patterns"])];
    expect(calculate({ column: "likes", kind: "sum" }, rows)).toBe("8");
    expect(calculate({ column: "works", kind: "common" }, rows)).toBe(MODEL_VERSIONS[1].name);
    expect(calculate({ column: "patterns", kind: "common" }, rows)).toBe("Uses a router");
  });
});
