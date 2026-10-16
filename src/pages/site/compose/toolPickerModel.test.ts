import { describe, expect, it } from "vitest";

import { SUGGESTED_TOOLS, TOOLS, TOOL_GROUPS } from "@/lib/tools/registry";

import { pickerRows, type PickerRow } from "./toolPickerModel";

const base = { query: "", inBuild: [], expanded: false, allowNone: false };
const ids = (rows: PickerRow[]) => rows.flatMap((row) => (row.kind === "tool" ? [row.tool.id] : []));

describe("pickerRows", () => {
  it("shows No tool first, only with allowNone", () => {
    expect(pickerRows({ ...base, allowNone: true })[0]).toEqual({ kind: "none" });
    expect(pickerRows(base).some((row) => row.kind === "none")).toBe(false);
    expect(pickerRows({ ...base, allowNone: true, query: "lov" })[0]).toEqual({ kind: "none" });
  });

  it("puts the build's tools first, then suggestions without repeats, at most six tool rows", () => {
    const rows = pickerRows({ ...base, inBuild: ["Lovable", "lovable", "Midjourney", "nothing known"] });
    expect(rows[0]).toEqual({ kind: "heading", label: "In this build" });
    expect(ids(rows).slice(0, 2)).toEqual(["lovable", "midjourney"]);
    expect(ids(rows)).toHaveLength(6);
    expect(new Set(ids(rows)).size).toBe(6);
    expect(rows[rows.length - 1]).toEqual({ kind: "showAll", count: TOOLS.length });
  });

  it("shows the suggestions alone when the build uses nothing", () => {
    const rows = pickerRows(base);
    expect(rows[0]).toEqual({ kind: "heading", label: "Suggested" });
    expect(ids(rows)).toEqual([...SUGGESTED_TOOLS]);
  });

  it("caps the build's own tools at six, leaving no suggestions", () => {
    const rows = pickerRows({ ...base, inBuild: TOOLS.slice(0, 9).map((tool) => tool.id) });
    expect(ids(rows)).toHaveLength(6);
    expect(rows.some((row) => row.kind === "heading" && row.label === "Suggested")).toBe(false);
  });

  it("expands to every tool under its group heading, in group order", () => {
    const rows = pickerRows({ ...base, expanded: true });
    expect(ids(rows)).toHaveLength(TOOLS.length);
    const headings = rows.flatMap((row) => (row.kind === "heading" ? [row.label] : []));
    expect(headings).toEqual(TOOL_GROUPS.map((group) => group.label));
    expect(rows.some((row) => row.kind === "showAll")).toBe(false);
  });

  it("lists a prefix match before a contains match", () => {
    const order = ids(pickerRows({ ...base, query: "ma" }));
    expect(order).toContain("gamma");
    expect(order.indexOf("manus")).toBeLessThan(order.indexOf("gamma"));
    expect(order.indexOf("make")).toBeLessThan(order.indexOf("gamma"));
  });

  it("matches other spellings and limits to six with a Show more row", () => {
    expect(ids(pickerRows({ ...base, query: "windsurf" }))).toEqual(["devin-desktop"]);
    const rows = pickerRows({ ...base, query: "a" });
    expect(ids(rows)).toHaveLength(6);
    const more = rows.find((row) => row.kind === "showMore");
    expect(more && more.kind === "showMore" && more.count).toBeGreaterThan(0);
    expect(ids(pickerRows({ ...base, query: "a", expanded: true })).length).toBeGreaterThan(6);
  });

  it('adds Use "query" last, only when no tool matches exactly', () => {
    expect(pickerRows({ ...base, query: "Photoshop" })).toEqual([{ kind: "use", name: "Photoshop" }]);
    const rows = pickerRows({ ...base, query: "lov" });
    expect(rows[rows.length - 1]).toEqual({ kind: "use", name: "lov" });
    expect(pickerRows({ ...base, query: "Lovable" }).some((row) => row.kind === "use")).toBe(false);
    expect(pickerRows({ ...base, query: "lovable.dev" }).some((row) => row.kind === "use")).toBe(false);
  });

  it("offers a typed name of 1 to 40 characters only", () => {
    expect(pickerRows({ ...base, query: "x".repeat(40) }).some((row) => row.kind === "use")).toBe(true);
    expect(pickerRows({ ...base, query: "x".repeat(41) }).some((row) => row.kind === "use")).toBe(false);
    expect(pickerRows({ ...base, query: "   " }).some((row) => row.kind === "use")).toBe(false);
  });
});
