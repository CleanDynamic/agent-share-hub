// BF-12 (B3, B5): the Table sorted in the browser when every matching build is loaded. One comparator, one key per column, stable,
// empty values last in both directions, with a second key for ties.

import { describe, expect, it } from "vitest";

import type { TableRowView } from "./BuildsTableView";
import type { GalleryParams } from "@/lib/build/galleryParams";

import { SERVER_SORT, SORT_COLUMN, nextSort, sortRows, sortedBy } from "./buildsModel";

const row = (id: string, over: Partial<TableRowView> = {}): TableRowView => ({
  id, href: `/b2/${id}`, title: id, maker: "kit", built: "", field: "", tools: [], steps: null, sessions: null, reproductions: 0,
  lit: false, confirmed: "", runs: [], rebuilds: 0, open: "", cost: "", confirmedAt: null, publishedAt: null, ...over,
});
const ids = (rows: readonly TableRowView[]) => rows.map((entry) => entry.id);

describe("BF-12 sortRows", () => {
  it("numbers sort as numbers, descending and ascending", () => {
    const rows = [row("a", { steps: 9 }), row("b", { steps: 22 }), row("c", { steps: 4 })];
    expect(ids(sortRows(rows, "steps", false))).toEqual(["b", "a", "c"]);
    expect(ids(sortRows(rows, "steps", true))).toEqual(["c", "a", "b"]);
  });

  it("words sort by locale, case ignored", () => {
    const rows = [row("a", { field: "sales" }), row("b", { field: "Education" }), row("c", { field: "law" })];
    expect(ids(sortRows(rows, "field", true))).toEqual(["b", "c", "a"]);
    expect(ids(sortRows(rows, "field", false))).toEqual(["a", "c", "b"]);
    const titles = [row("x", { title: "beta" }), row("y", { title: "Alpha" })];
    expect(ids(sortRows(titles, "build", true))).toEqual(["y", "x"]);
  });

  it("a scale column sorts by the taxonomy's order, not the alphabet (Autonomy)", () => {
    const rows = [
      row("full", { extra: { autonomy: "Fully autonomous" } }),
      row("each", { extra: { autonomy: "You do each step" } }),
      row("gates", { extra: { autonomy: "AI acts with approval gates" } }),
      row("suggests", { extra: { autonomy: "AI suggests and you approve" } }),
    ];
    expect(ids(sortRows(rows, "autonomy", true))).toEqual(["each", "suggests", "gates", "full"]);
    expect(ids(sortRows(rows, "autonomy", false))).toEqual(["full", "gates", "suggests", "each"]);
  });

  it("Last confirmed and Published sort by time, newest first when descending", () => {
    const rows = [
      row("old", { confirmedAt: "2026-01-02T00:00:00Z", publishedAt: "2026-03-01T00:00:00Z" }),
      row("new", { confirmedAt: "2026-10-02T00:00:00Z", publishedAt: "2025-03-01T00:00:00Z" }),
      row("mid", { confirmedAt: "2026-05-02T00:00:00Z", publishedAt: "2026-09-01T00:00:00Z" }),
    ];
    expect(ids(sortRows(rows, "confirmed", false))).toEqual(["new", "mid", "old"]);
    expect(ids(sortRows(rows, "published", false))).toEqual(["mid", "old", "new"]);
    expect(ids(sortRows(rows, "published", true))).toEqual(["new", "old", "mid"]);
  });

  it("Tools and stack sorts by the first tool's name; Runs, 12 weeks by the total of the twelve", () => {
    const tools = [row("l", { tools: [{ id: "lovable", name: "Lovable" }] }), row("c", { tools: [{ id: "claude-code", name: "Claude Code" }, { id: "zed", name: "Zed" }] })];
    expect(ids(sortRows(tools, "tools", true))).toEqual(["c", "l"]);
    const runs = [row("few", { runs: [5, 0, 0] }), row("many", { runs: [1, 2, 3, 4] }), row("none", { runs: [] })];
    expect(ids(sortRows(runs, "runs", false))).toEqual(["many", "few", "none"]);
  });

  it("an empty value is last in both directions", () => {
    const rows = [row("empty"), row("a", { steps: 3 }), row("b", { steps: 7 })];
    expect(ids(sortRows(rows, "steps", false))).toEqual(["b", "a", "empty"]);
    expect(ids(sortRows(rows, "steps", true))).toEqual(["a", "b", "empty"]);
    const words = [row("blank"), row("x", { field: "Law" })];
    expect(ids(sortRows(words, "field", false))).toEqual(["x", "blank"]);
    expect(ids(sortRows(words, "field", true))).toEqual(["x", "blank"]);
  });

  it("equal keys keep the order they came in (stable)", () => {
    const rows = [row("1", { rebuilds: 2 }), row("2", { rebuilds: 1 }), row("3", { rebuilds: 2 }), row("4", { rebuilds: 2 })];
    expect(ids(sortRows(rows, "rebuilds", false))).toEqual(["1", "3", "4", "2"]);
    expect(ids(sortRows(rows, "rebuilds", true))).toEqual(["2", "1", "3", "4"]);
    expect(ids(rows)).toEqual(["1", "2", "3", "4"]);
  });

  it("a second key breaks ties, with its own direction", () => {
    const rows = [row("a", { field: "Law", reproductions: 1 }), row("b", { field: "Sales", reproductions: 9 }), row("c", { field: "Law", reproductions: 5 })];
    expect(ids(sortRows(rows, "field", true, "reproductions", false))).toEqual(["c", "a", "b"]);
    expect(ids(sortRows(rows, "field", true, "reproductions", true))).toEqual(["a", "c", "b"]);
  });
});

describe("BF-12 nextSort", () => {
  const base: GalleryParams = { lens: "all", madeFor: [], madeWith: [], query: null };
  const keys = (params: GalleryParams) => ({ sort: params.sort, dir: params.dir, by: params.by, by2: params.by2, dir2: params.dir2 });

  it("SORT_COLUMN is SERVER_SORT turned round", () => {
    expect(SERVER_SORT).toEqual({ reproductions: "reproduced", confirmed: "confirmed", rebuilds: "rebuilt", steps: "steps", sessions: "sessions", published: "newest" });
    for (const [column, sort] of Object.entries(SERVER_SORT)) expect(SORT_COLUMN[sort!]).toBe(column);
  });

  it("a server column: its sort, then ascending, then the default sort", () => {
    const one = nextSort(base, "steps", false);
    expect(keys(one)).toEqual({ sort: "steps", dir: undefined, by: undefined, by2: undefined, dir2: undefined });
    const two = nextSort(one, "steps", false);
    expect(keys(two)).toMatchObject({ sort: "steps", dir: "asc" });
    expect(keys(nextSort(two, "steps", false))).toEqual({ sort: undefined, dir: undefined, by: undefined, by2: undefined, dir2: undefined });
  });

  it("the default sort's column only flips the direction", () => {
    const one = nextSort(base, "reproductions", true);
    expect(keys(one)).toMatchObject({ sort: undefined, dir: "asc" });
    expect(keys(nextSort(one, "reproductions", true))).toMatchObject({ sort: undefined, dir: undefined });
  });

  it("a server column clears the browser's keys", () => {
    expect(keys(nextSort({ ...base, by: "field", dir: "asc", by2: "likes", dir2: "asc" }, "rebuilds", true))).toEqual({ sort: "rebuilt", dir: undefined, by: undefined, by2: undefined, dir2: undefined });
  });

  it("any other column, only when every build is loaded: by, then ascending, then none; the server sort is kept", () => {
    const start = { ...base, sort: "steps" as const };
    expect(nextSort(start, "field", false)).toBe(start);
    const one = nextSort(start, "field", true);
    expect(keys(one)).toEqual({ sort: "steps", dir: undefined, by: "field", by2: undefined, dir2: undefined });
    const two = nextSort(one, "field", true);
    expect(keys(two)).toMatchObject({ by: "field", dir: "asc" });
    expect(keys(nextSort(two, "field", true))).toEqual({ sort: "steps", dir: undefined, by: undefined, by2: undefined, dir2: undefined });
  });
});

describe("BF-12 sortedBy: the Sort menu's choice, the column's first step", () => {
  const base: GalleryParams = { lens: "all", madeFor: [], madeWith: [], query: null };

  it("a server column descending, whatever was before; the resting column is the resting sort", () => {
    expect(sortedBy({ ...base, sort: "steps", dir: "asc" }, "steps", false)).toMatchObject({ sort: "steps", dir: undefined });
    expect(sortedBy({ ...base, sort: "steps", dir: "asc", by: "field" }, "reproductions", true)).toMatchObject({ sort: undefined, dir: undefined, by: undefined });
  });

  it("another column by itself, descending, only when every build is loaded", () => {
    expect(sortedBy({ ...base, by: "field", dir: "asc" }, "field", true)).toMatchObject({ by: "field", dir: undefined });
    const start = { ...base, sort: "rebuilt" as const };
    expect(sortedBy(start, "field", false)).toBe(start);
  });
});

describe("BF-12 nextSort, the second key", () => {
  const base: GalleryParams = { lens: "all", madeFor: [], madeWith: [], query: null };

  it("Shift on another column sets by2, then ascending, then clears it; on the first key it does nothing", () => {
    const start = { ...base, by: "field" };
    const one = nextSort(start, "likes", true, true);
    expect(one).toMatchObject({ by: "field", by2: "likes", dir2: undefined });
    const two = nextSort(one, "likes", true, true);
    expect(two).toMatchObject({ by2: "likes", dir2: "asc" });
    expect(nextSort(two, "likes", true, true)).toMatchObject({ by: "field", by2: undefined, dir2: undefined });
    expect(nextSort(start, "field", true, true)).toBe(start);
  });

  it("with a server sort as the first key, Shift takes it into the browser as by", () => {
    expect(nextSort({ ...base, sort: "steps", dir: "asc" }, "field", true, true)).toMatchObject({ sort: "steps", by: "steps", dir: "asc", by2: "field" });
  });

  it("only when every build is loaded", () => {
    const start = { ...base, by: "field" };
    expect(nextSort(start, "likes", false, true)).toBe(start);
  });
});
