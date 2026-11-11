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
  it("F40: the first screen is Prompt, Agent, Tool, File, Dataset, in that order, those that are live", () => {
    expect(keys(addMenuLayout(ALL, undefined).primary)).toEqual(["prompt", "agent", "tool", "file", "dataset"]);
    expect(keys(addMenuLayout(ALL.map((item) => (item.key === "dataset" ? { ...item, live: false } : item)), undefined).primary)).toEqual(["prompt", "agent", "tool", "file"]);
  });

  it("groups the rest by the fallback table while the registry is not read", () => {
    const layout = addMenuLayout(ALL, undefined);
    expect(layout.groups.map((group) => [group.head, keys(group.entries)])).toEqual([
      ["Artefact", ["code", "repo"]],
      ["Evidence", ["result", "check"]],
      ["Narrative", ["manual", "approval"]],
    ]);
    // F40: no group holds both Check (Evidence) and Approval (Narrative), so Decision is listed with the ungrouped entries; Data is
    // left with Retrieval and Instruction with System prompt, groups of one with no head.
    expect(keys(layout.loose)).toEqual(["retrieval", "decision", "system_prompt"]);
    expect(layout.groups.flatMap((group) => keys(group.entries))).not.toContain("decision");
    expect(keys(layout.deployment)).toEqual(["deploy:host", "deploy:relay"]);
    expect(layout.library?.key).toBe("library");
  });

  it("leaves out entries that are not live, and a group with none", () => {
    const off = ALL.map((item) => (["retrieval", "dataset", "system_prompt", "repo", "code"].includes(item.key) ? { ...item, live: false } : item));
    const layout = addMenuLayout(off, undefined);
    expect(layout.groups.map((group) => group.head)).toEqual(["Evidence", "Narrative"]);
    expect(layout.groups.flatMap((group) => keys(group.entries))).not.toContain("retrieval");
    expect(keys(layout.loose)).toEqual(["decision"]);
  });

  it("keeps Check listed while it cannot be added", () => {
    const layout = addMenuLayout(ALL.map((item) => (item.key === "check" ? { ...item, enabled: false } : item)), undefined);
    expect(layout.groups.find((group) => group.head === "Evidence")?.entries.map((item) => [item.key, item.enabled])).toEqual([
      ["result", true],
      ["check", false],
    ]);
  });

  it("follows the live registry where it differs from the table", () => {
    // The registry puts Result in Narrative and Code in Data.
    const live = { ...ADD_CATEGORY_FALLBACK, result: "narrative", code: "data" };
    const layout = addMenuLayout(ALL, live);
    expect(layout.groups.map((group) => [group.head, keys(group.entries)])).toEqual([
      ["Data", ["retrieval", "code"]],
      ["Narrative", ["result", "manual", "approval"]],
    ]);
    // Artefact is left with the repository alone and Evidence with Check alone: no head, after the headed groups.
    expect(keys(layout.loose)).toEqual(["repo", "check", "decision", "system_prompt"]);
  });

  it("an entry whose type the registry does not know goes by the table", () => {
    const layout = addMenuLayout(ALL, { prompt: "instruction" });
    expect(layout.groups.map((group) => group.head)).toContain("Artefact");
  });
});
