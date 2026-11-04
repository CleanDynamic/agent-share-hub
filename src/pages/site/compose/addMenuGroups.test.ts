// UX-02 P6: the Add step tile menu's layout. Prompt first; the rest grouped by the category of the node type each creates, from the
// live registry, else the fallback table; a group of one has no head and stands after the headed groups; not-live entries are left
// out; Deployment its own group; From Library last.

import { describe, expect, it } from "vitest";

import { addMenuLayout, ADD_CATEGORY_FALLBACK, type LayoutEntry } from "./addMenuGroups";

const entry = (key: string, type: string | null, over: Partial<LayoutEntry> = {}): LayoutEntry => ({ key, name: key, line: "", enabled: true, live: true, type, ...over });

const ALL: LayoutEntry[] = [
  entry("prompt", "prompt"),
  entry("agent", "agent_config"),
  entry("decision", "decision"),
  entry("retrieval", "retrieval_config"),
  entry("system_prompt", "system_prompt"),
  entry("file", "document"),
  entry("dataset", "dataset"),
  entry("tool", "integration"),
  entry("repo", "repo"),
  entry("manual", "manual_step"),
  entry("approval", "manual_step"),
  entry("code", "code"),
  entry("check", "eval_run"),
  entry("result", "result"),
  entry("library", null),
  entry("deploy:host", "host", { group: "Deployment" }),
  entry("deploy:relay", "relay"),
];

const keys = (list: readonly LayoutEntry[]) => list.map((item) => item.key);

describe("UX-02 P6 · addMenuLayout", () => {
  it("puts Prompt first, alone", () => {
    expect(addMenuLayout(ALL, undefined).first?.key).toBe("prompt");
  });

  it("groups by the fallback table while the registry is not read", () => {
    const layout = addMenuLayout(ALL, undefined);
    expect(layout.groups.map((group) => [group.head, keys(group.entries)])).toEqual([
      ["Configuration", ["agent", "tool"]],
      ["Data", ["dataset", "retrieval"]],
      ["Artefact", ["file", "code", "repo"]],
      ["Evidence", ["result", "check"]],
      ["Narrative", ["decision", "manual", "approval"]],
    ]);
    // Instruction holds only System prompt: a group of one has no head.
    expect(keys(layout.loose)).toEqual(["system_prompt"]);
    expect(keys(layout.deployment)).toEqual(["deploy:host", "deploy:relay"]);
    expect(layout.library?.key).toBe("library");
  });

  it("leaves out entries that are not live, and a group with none", () => {
    const off = ALL.map((item) => (["retrieval", "dataset", "system_prompt", "repo"].includes(item.key) ? { ...item, live: false } : item));
    const layout = addMenuLayout(off, undefined);
    expect(layout.groups.map((group) => group.head)).toEqual(["Configuration", "Artefact", "Evidence", "Narrative"]);
    expect(layout.groups.flatMap((group) => keys(group.entries))).not.toContain("retrieval");
    expect(layout.loose).toEqual([]);
  });

  it("keeps Check listed while it cannot be added", () => {
    const layout = addMenuLayout(ALL.map((item) => (item.key === "check" ? { ...item, enabled: false } : item)), undefined);
    expect(layout.groups.find((group) => group.head === "Evidence")?.entries.map((item) => [item.key, item.enabled])).toEqual([
      ["result", true],
      ["check", false],
    ]);
  });

  it("follows the live registry where it differs from the table", () => {
    // The registry puts Decision in Configuration (its CA-13 row) and Result in Narrative.
    const live = { ...ADD_CATEGORY_FALLBACK, decision: "configuration", result: "narrative" };
    const layout = addMenuLayout(ALL, live);
    expect(layout.groups.find((group) => group.head === "Configuration")?.entries.map((item) => item.key)).toEqual(["agent", "tool", "decision"]);
    // Evidence is left with Check alone: no head, after the headed groups.
    expect(layout.groups.map((group) => group.head)).not.toContain("Evidence");
    expect(keys(layout.loose)).toEqual(["check", "system_prompt"]);
  });

  it("an entry whose type the registry does not know goes by the table", () => {
    const layout = addMenuLayout(ALL, { prompt: "instruction" });
    expect(layout.groups.map((group) => group.head)).toContain("Configuration");
  });
});
