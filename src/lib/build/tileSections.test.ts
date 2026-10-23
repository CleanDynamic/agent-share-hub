// CA-18 P1: one list of sections for each kind of tile.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildFacts, tileView } from "@/dev/fixtures/detailsKinds";
import { CHECK_DIALOG_COPY } from "@/pages/site/compose/AddCheckDialog";
import { CODE_DIALOG_COPY } from "@/pages/site/compose/AddCodeDialog";
import { DATASET_DIALOG_COPY } from "@/pages/site/compose/AddDatasetDialog";
import { REPO_DIALOG_COPY } from "@/pages/site/compose/AddRepoDialog";
import { RESULT_DIALOG_COPY } from "@/pages/site/compose/AddResultDialog";
import { SYSTEM_PROMPT_DIALOG_COPY } from "@/pages/site/compose/AddSystemPromptDialog";
import { TOOL_DIALOG_COPY } from "@/pages/site/compose/AddToolDialog";
import { AGENT_DIALOG_COPY } from "@/pages/site/compose/AddAgentDialog";
import { MANUAL_DIALOG_COPY } from "@/pages/site/compose/AddManualStepDialog";
import { FULL_PROMPT_COPY } from "@/components/build/FullPromptWindow";

import { TILE_KINDS, notSetLine, readSections, sectionsOf, type TileKind } from "./tileSections";

const labelsOf = (kind: TileKind) => sectionsOf(kind).map((section) => section.label);

describe("the list", () => {
  it("covers the fourteen kinds", () => {
    expect([...TILE_KINDS].sort()).toEqual(["agent", "check", "code", "dataset", "decision", "file", "manual", "prompt", "repo", "result", "session", "system_prompt", "team", "tool"]);
  });

  it("gives every section a key, a label and a hint, once", () => {
    for (const kind of TILE_KINDS) {
      const sections = sectionsOf(kind);
      expect(new Set(sections.map((section) => section.key)).size, kind).toBe(sections.length);
      for (const section of sections) {
        expect(section.label.trim(), `${kind}.${section.key}`).not.toBe("");
        expect(section.hint.trim(), `${kind}.${section.key}`).not.toBe("");
      }
    }
  });

  it("imports no React", () => {
    const source = readFileSync("src/lib/build/tileSections.ts", "utf8");
    expect(source).not.toMatch(/from\s+["']react/);
    expect(source).not.toMatch(/from\s+["'][^"']*\.tsx["']/);
  });

  it("uses the modals' words (CA-15's) for the sections they name", () => {
    const has = (kind: TileKind, label: string) => expect(labelsOf(kind), `${kind}: ${label}`).toContain(label);
    for (const label of [TOOL_DIALOG_COPY.tool, TOOL_DIALOG_COPY.connected, TOOL_DIALOG_COPY.did, TOOL_DIALOG_COPY.permissions, TOOL_DIALOG_COPY.plan, TOOL_DIALOG_COPY.setup, TOOL_DIALOG_COPY.alternatives]) has("tool", label);
    for (const label of [CHECK_DIALOG_COPY.tested, CHECK_DIALOG_COPY.passing, CHECK_DIALOG_COPY.runs, CHECK_DIALOG_COPY.failed, CHECK_DIALOG_COPY.lastRun, CHECK_DIALOG_COPY.method, CHECK_DIALOG_COPY.reviewer, CHECK_DIALOG_COPY.scoring, CHECK_DIALOG_COPY.modelTested, CHECK_DIALOG_COPY.evidence]) has("check", label);
    for (const label of [CODE_DIALOG_COPY.code, CODE_DIALOG_COPY.language, CODE_DIALOG_COPY.filename, CODE_DIALOG_COPY.writtenWith]) has("code", label);
    for (const label of [AGENT_DIALOG_COPY.instructions, AGENT_DIALOG_COPY.starts, AGENT_DIALOG_COPY.limits, AGENT_DIALOG_COPY.output, AGENT_DIALOG_COPY.sample]) has("agent", label);
    has("team", AGENT_DIALOG_COPY.pattern);
    for (const label of [MANUAL_DIALOG_COPY.where, MANUAL_DIALOG_COPY.whatWasDone, MANUAL_DIALOG_COPY.picture]) has("manual", label);
    for (const label of [RESULT_DIALOG_COPY.outputType, RESULT_DIALOG_COPY.url, RESULT_DIALOG_COPY.picturesHead, RESULT_DIALOG_COPY.caption]) has("result", label);
    for (const label of [SYSTEM_PROMPT_DIALOG_COPY.name, SYSTEM_PROMPT_DIALOG_COPY.text, SYSTEM_PROMPT_DIALOG_COPY.appliesTo, SYSTEM_PROMPT_DIALOG_COPY.model, SYSTEM_PROMPT_DIALOG_COPY.version, SYSTEM_PROMPT_DIALOG_COPY.variables]) has("system_prompt", label);
    for (const label of [DATASET_DIALOG_COPY.name, DATASET_DIALOG_COPY.description, DATASET_DIALOG_COPY.use, DATASET_DIALOG_COPY.format, DATASET_DIALOG_COPY.records, DATASET_DIALOG_COPY.columns, DATASET_DIALOG_COPY.source, DATASET_DIALOG_COPY.sample, DATASET_DIALOG_COPY.licence, DATASET_DIALOG_COPY.chunking]) has("dataset", label);
    for (const label of [REPO_DIALOG_COPY.url, REPO_DIALOG_COPY.ownership, REPO_DIALOG_COPY.description, REPO_DIALOG_COPY.thirdParty, REPO_DIALOG_COPY.pinned, REPO_DIALOG_COPY.path, REPO_DIALOG_COPY.modifications, REPO_DIALOG_COPY.keyFiles, REPO_DIALOG_COPY.run]) has("repo", label);
    for (const label of [FULL_PROMPT_COPY.prompt, FULL_PROMPT_COPY.response, FULL_PROMPT_COPY.modelSettings, FULL_PROMPT_COPY.variables]) has("prompt", label);
  });

  it("keeps the modals' hints for the Optional rows", () => {
    const hint = (kind: TileKind, label: string) => sectionsOf(kind).find((section) => section.label === label)?.hint;
    expect(hint("tool", "Permissions")).toBe(TOOL_DIALOG_COPY.permissionsLine);
    expect(hint("check", "Evidence")).toBe(CHECK_DIALOG_COPY.evidenceLine);
    expect(hint("dataset", "Licence")).toBe(DATASET_DIALOG_COPY.licenceLine);
    expect(hint("repo", "Run instructions")).toBe(REPO_DIALOG_COPY.runLine);
    expect(hint("prompt", "Variables")).toBe(FULL_PROMPT_COPY.variablesLine);
    expect(hint("agent", "Limits")).toBe(AGENT_DIALOG_COPY.limitsLine);
  });
});

describe("read", () => {
  it("returns null for every section an empty tile leaves empty, and names them", () => {
    for (const kind of TILE_KINDS) {
      const { sections, notSet } = readSections(tileView(kind, "empty"), buildFacts);
      expect(sections.length + notSet.length, kind).toBe(sectionsOf(kind).length);
      expect(notSet.length, `${kind} has empty sections`).toBeGreaterThan(0);
      for (const section of sections) expect(section.value, `${kind}.${section.key}`).not.toBeNull();
    }
  });

  it("reads a full tile in the order of the list", () => {
    for (const kind of TILE_KINDS) {
      const { sections } = readSections(tileView(kind, "full"), buildFacts);
      const order = labelsOf(kind);
      const at = sections.map((section) => order.indexOf(section.label));
      expect(at, kind).toEqual([...at].sort((a, b) => a - b));
      expect(sections.length, `${kind} reads something`).toBeGreaterThan(1);
    }
  });

  it("reads prose with its count, a response as muted", () => {
    const { sections } = readSections(tileView("prompt", "full"), buildFacts);
    const prompt = sections.find((section) => section.key === "prompt")?.value;
    expect(prompt).toMatchObject({ type: "prose", count: "19 words", copy: true });
    expect(sections.find((section) => section.key === "response")?.value).toMatchObject({ type: "prose", muted: true });
    expect(sections.find((section) => section.key === "variables")?.value).toMatchObject({ type: "rows", count: "1 word a copier replaces" });
  });

  it("reads links as selectable tiles with their number, kind and session", () => {
    const { sections } = readSections(tileView("prompt", "full"), buildFacts);
    const uses = sections.find((section) => section.key === "uses")?.value;
    expect(uses).toMatchObject({ type: "links", count: "2 tiles" });
    if (uses?.type !== "links") throw new Error("links");
    expect(uses.items[0]).toMatchObject({ id: "p2", badge: "2", name: "Write the menu", kind: "Prompt", value: "Session 1" });
    const goes = sections.find((section) => section.key === "goesInto")?.value;
    if (goes?.type !== "links") throw new Error("links");
    expect(goes.items.map((item) => item.name)).toEqual(["Check the prices", "Result"]);
  });

  it("reads a tool's permission and a team's pattern", () => {
    const tool = readSections(tileView("tool", "full"), buildFacts).sections;
    expect(tool.find((section) => section.key === "permissions")?.value).toMatchObject({ rows: [{ label: "Permissions", value: "Read and write" }] });
    const team = readSections(tileView("team", "full"), buildFacts).sections;
    expect(team.find((section) => section.key === "pattern")?.value).toMatchObject({ rows: [{ value: "Lead with delegates" }] });
  });
});

describe("the foot line", () => {
  it("names what is empty once, and says nothing when nothing is", () => {
    expect(notSetLine(["Host platform", "Memory", "Sample run"])).toBe("Not set: Host platform, Memory, Sample run. Edit to add them.");
    expect(notSetLine([])).toBeNull();
  });
});
