import { describe, expect, it } from "vitest";

import { SUGGESTED_TOOLS, TOOLS, TOOL_GROUPS } from "@/lib/tools/registry";

import { TOOL_PICKER_COPY, pickerRows, toolsForStep, type PickerRow } from "./toolPickerModel";

/** A manual step: every tool but the retired one fits it, so these rows are the whole list. */
const base = { query: "", inBuild: [], expanded: false, allowNone: false, step: "manual" as const };
const PICKABLE = TOOLS.filter((tool) => tool.status !== "retired");
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
    expect(rows[rows.length - 1]).toEqual({ kind: "showAll", count: PICKABLE.length });
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
    expect(ids(rows)).toHaveLength(PICKABLE.length);
    expect(ids(rows)).not.toContain("sora");
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

describe("pickerRows for a step (CA-02)", () => {
  const prompt = { ...base, step: "prompt" as const };
  const row = (rows: PickerRow[], id: string) => rows.find((r) => r.kind === "tool" && r.tool.id === id);

  it("leaves tools that do not fit a prompt out of Suggested and Show all", () => {
    const all = ids(pickerRows({ ...prompt, expanded: true }));
    expect(all).not.toContain("hermes-agent");
    expect(all).not.toContain("manus");
    expect(all).not.toContain("gmail");
    expect(all).not.toContain("sora");
    expect(all).toContain("claude");
    expect(all).toEqual(toolsForStep("prompt").map((tool) => tool.id));
    const rows = pickerRows(prompt);
    expect(rows[rows.length - 1]).toEqual({ kind: "showAll", count: toolsForStep("prompt").length });
  });

  it("leaves the build's own tools out too when they do not fit", () => {
    expect(ids(pickerRows({ ...prompt, inBuild: ["Hermes Agent", "Claude"] })).slice(0, 1)).toEqual(["claude"]);
  });

  it("still shows a named tool that runs prompts by itself, last, unavailable but pickable, with where it goes", () => {
    const rows = pickerRows({ ...prompt, query: "hermes" });
    expect(rows[0]).toEqual({ kind: "tool", tool: TOOLS.find((t) => t.id === "hermes-agent"), unavailable: true, pickable: true, line: TOOL_PICKER_COPY.runsItself("Hermes Agent") });
    expect(TOOL_PICKER_COPY.runsItself("Hermes Agent")).toBe("Hermes Agent runs prompts by itself. Add it as an agent.");
    const mixed = pickerRows({ ...prompt, query: "ma", expanded: true });
    const manus = mixed.findIndex((r) => r.kind === "tool" && r.tool.id === "manus");
    const gamma = mixed.findIndex((r) => r.kind === "tool" && r.tool.id === "gamma");
    expect(gamma).toBeLessThan(manus);
  });

  it("shows any other tool that does not fit as unavailable, and not pickable", () => {
    expect(row(pickerRows({ ...prompt, query: "gmail" }), "gmail")).toMatchObject({ unavailable: true, pickable: false, line: "Add it with Add › Tool" });
    expect(row(pickerRows({ ...base, step: "tool", query: "claude" }), "claude")).toMatchObject({ unavailable: true, pickable: false, line: "Add it with Add › Prompt" });
  });

  it("never shows a retired tool, even by name", () => {
    // "cursor ai" contains "sora", so Cursor still matches; Sora itself never shows.
    expect(ids(pickerRows({ ...prompt, query: "sora" }))).not.toContain("sora");
    expect(ids(pickerRows({ ...base, query: "Sora" }))).not.toContain("sora");
    expect(pickerRows({ ...base, query: "Sora" }).some((r) => r.kind === "use")).toBe(false);
  });

  it("keeps Use \"{query}\" for a tool nobody knows", () => {
    expect(pickerRows({ ...prompt, query: "My own script" })).toEqual([{ kind: "use", name: "My own script" }]);
  });

  it("notes the workflow of an automation tool named on a prompt", () => {
    expect(row(pickerRows({ ...prompt, query: "n8n" }), "n8n")).toMatchObject({ line: "Add its workflow with Add › File" });
    expect(row(pickerRows({ ...prompt, query: "n8n" }), "n8n")).not.toHaveProperty("unavailable");
    expect(row(pickerRows({ ...base, query: "n8n" }), "n8n")).not.toHaveProperty("line");
  });

  it("offers harnesses for an agent, and Hermes Agent as an agent", () => {
    const all = ids(pickerRows({ ...base, step: "agent", expanded: true }));
    expect(all).toContain("hermes-agent");
    expect(all).toContain("claude-code");
    expect(all).not.toContain("gemini");
  });
});
