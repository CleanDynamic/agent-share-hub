// BF-12 (B3, B5): sorting the loaded rows in the browser, and the press cycle of a head. Pure.

import { describe, expect, it } from "vitest";

import { parseGalleryParams } from "@/lib/build/galleryParams";
import { AUTONOMY_VALUES } from "@/lib/classify/taxonomy";

import type { TableRowView } from "./BuildsTableView";
import { nextSort, sortRows } from "./buildsModel";

const row = (id: string, over: Partial<TableRowView> = {}): TableRowView => ({
  id, href: `/b2/${id}`, title: id, maker: "kit", built: "", field: "", tools: [], steps: null, sessions: null, reproductions: 0,
  lit: false, confirmed: "", runs: [], rebuilds: 0, open: "", cost: "", ...over,
});
const ids = (rows: readonly TableRowView[]) => rows.map((entry) => entry.id);
const params = (search: string) => parseGalleryParams(new URLSearchParams(search));

describe("sortRows", () => {
  it("numbers sort as numbers, descending and ascending", () => {
    const rows = [row("a", { steps: 9 }), row("b", { steps: 22 }), row("c", { steps: 4 })];
    expect(ids(sortRows(rows, "steps", false))).toEqual(["b", "a", "c"]);
    expect(ids(sortRows(rows, "steps", true))).toEqual(["c", "a", "b"]);
  });

  it("words sort by locale, case ignored", () => {
    const rows = [row("a", { field: "sales" }), row("b", { field: "Education" }), row("c", { field: "law" })];
    expect(ids(sortRows(rows, "field", true))).toEqual(["b", "c", "a"]);
    expect(ids(sortRows(rows, "field", false))).toEqual(["a", "c", "b"]);
  });

  it("a scale column sorts by the taxonomy's order, not the alphabet", () => {
    const [first, second, third] = AUTONOMY_VALUES;
    const rows = [row("a", { extra: { autonomy: third.label } }), row("b", { extra: { autonomy: first.label } }), row("c", { extra: { autonomy: second.label } })];
    expect(ids(sortRows(rows, "autonomy", true))).toEqual(["b", "c", "a"]);
    expect(ids(sortRows(rows, "autonomy", false))).toEqual(["a", "c", "b"]);
  });

  it("Last confirmed and Published sort by time, newest first when descending", () => {
    const rows = [row("a", { confirmedAt: "2026-10-01T00:00:00Z", publishedAt: "2026-01-03T00:00:00Z" }), row("b", { confirmedAt: "2026-11-01T00:00:00Z", publishedAt: "2026-01-01T00:00:00Z" }), row("c", { confirmedAt: "2026-09-01T00:00:00Z", publishedAt: "2026-01-02T00:00:00Z" })];
    expect(ids(sortRows(rows, "confirmed", false))).toEqual(["b", "a", "c"]);
    expect(ids(sortRows(rows, "published", false))).toEqual(["a", "c", "b"]);
    expect(ids(sortRows(rows, "published", true))).toEqual(["b", "c", "a"]);
  });

  it("Tools and stack sorts by the first tool's name; Runs, 12 weeks by the total of the twelve", () => {
    const tools = [row("a", { tools: [{ id: "n8n", name: "n8n" }] }), row("b", { tools: [{ id: "claude-code", name: "Claude Code" }, { id: "zed", name: "Zed" }] }), row("c", { tools: [{ id: "lovable", name: "Lovable" }] })];
    expect(ids(sortRows(tools, "tools", true))).toEqual(["b", "c", "a"]);
    const runs = [row("a", { runs: [1, 1, 1] }), row("b", { runs: [5] }), row("c", { runs: [0, 2] })];
    expect(ids(sortRows(runs, "runs", false))).toEqual(["b", "a", "c"]);
  });

  it("an empty value is last in both directions", () => {
    const rows = [row("a", { steps: null }), row("b", { steps: 3 }), row("c", { steps: 7 })];
    expect(ids(sortRows(rows, "steps", false))).toEqual(["c", "b", "a"]);
    expect(ids(sortRows(rows, "steps", true))).toEqual(["b", "c", "a"]);
    const words = [row("a", { field: "" }), row("b", { field: "Law" })];
    expect(ids(sortRows(words, "field", true))).toEqual(["b", "a"]);
    expect(ids(sortRows(words, "field", false))).toEqual(["b", "a"]);
  });

  it("equal keys keep the order they came in", () => {
    const rows = [row("a", { field: "Law" }), row("b", { field: "Law" }), row("c", { field: "Law" })];
    expect(ids(sortRows(rows, "field", false))).toEqual(["a", "b", "c"]);
    expect(ids(sortRows(rows, "field", true))).toEqual(["a", "b", "c"]);
    expect(sortRows(rows, "field", true)).not.toBe(rows);
  });

  it("a second key breaks ties, with its own direction", () => {
    const rows = [row("a", { field: "Law", steps: 1 }), row("b", { field: "Sales", steps: 5 }), row("c", { field: "Law", steps: 9 })];
    expect(ids(sortRows(rows, "field", true, "steps", false))).toEqual(["c", "a", "b"]);
    expect(ids(sortRows(rows, "field", true, "steps", true))).toEqual(["a", "c", "b"]);
  });
});

describe("nextSort", () => {
  it("a database column: sort, then ascending, then back to the default", () => {
    const first = nextSort(params(""), "steps", false);
    expect(first).toMatchObject({ sort: "steps" });
    expect(first.dir).toBeUndefined();
    const second = nextSort(first, "steps", false);
    expect(second).toMatchObject({ sort: "steps", dir: "asc" });
    const third = nextSort(second, "steps", false);
    expect(third.sort).toBeUndefined();
    expect(third.dir).toBeUndefined();
  });

  it("the default sort's column only flips the direction", () => {
    const first = nextSort(params(""), "reproductions", true);
    expect(first).toMatchObject({ dir: "asc" });
    expect(first.sort).toBeUndefined();
    expect(nextSort(first, "reproductions", true).dir).toBeUndefined();
  });

  it("any other column, only when everything is loaded: by, then ascending, then cleared, keeping the sort", () => {
    expect(nextSort(params("sort=newest"), "field", false)).toEqual(params("sort=newest"));
    const first = nextSort(params("sort=newest"), "field", true);
    expect(first).toMatchObject({ by: "field", sort: "newest" });
    const second = nextSort(first, "field", true);
    expect(second).toMatchObject({ by: "field", dir: "asc", sort: "newest" });
    const third = nextSort(second, "field", true);
    expect(third.by).toBeUndefined();
    expect(third.dir).toBeUndefined();
    expect(third.sort).toBe("newest");
  });

  it("a database column clears a browser sort", () => {
    const next = nextSort(params("by=field&dir=asc&by2=steps"), "rebuilds", true);
    expect(next).toMatchObject({ sort: "rebuilt" });
    expect([next.by, next.dir, next.by2, next.dir2]).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("a second key: set, flipped, cleared; only with everything loaded and a first key", () => {
    const by = params("by=field");
    const first = nextSort(by, "reproductions", true, true);
    expect(first).toMatchObject({ by: "field", by2: "reproductions" });
    const second = nextSort(first, "reproductions", true, true);
    expect(second).toMatchObject({ by2: "reproductions", dir2: "asc" });
    const third = nextSort(second, "reproductions", true, true);
    expect(third.by2).toBeUndefined();
    expect(third.dir2).toBeUndefined();
    expect(nextSort(by, "reproductions", false, true)).toEqual(by);
    expect(nextSort(first, "field", true).by2).toBeUndefined();
  });
});
