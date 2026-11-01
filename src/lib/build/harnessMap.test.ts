// SV-28 Part 8: the target harness. Every entry is sourced; Claude Code's folder is the folder as it was.

import { describe, expect, it } from "vitest";

import { assistantTree } from "@/dev/fixtures/deployment/assistant";
import { TOOLS } from "@/lib/tools/registry";

import { HARNESS_MAP, harnessEntry, mappedHarnesses, notCarriedLine } from "./harnessMap";
import type { ReaderSetupItem } from "./readerSteps";
import { setupFolder, setupFolderFor } from "./setupFolder";
import { setupPromptOf } from "./setupPrompt";

const base = { kindLabel: "", description: null, notShared: false, download: null, files: [], server: null, rule: null, workflow: null, path: null };
const items: ReaderSetupItem[] = [
  { ...base, id: "i", kind: "instructions", name: "CLAUDE.md", download: "u:instructions" },
  { ...base, id: "k", kind: "skill", name: "launch-checklist", download: "u:skill", path: "skills/launch-checklist/SKILL.md", files: [{ id: "f", name: "steps.md", path: "skills/launch-checklist/steps.md", download: "u:steps" }] },
  { ...base, id: "s", kind: "server", name: "gmail", server: { name: "gmail", type: "stdio", url: null, command: "npx", args: ["gmail-mcp"], env: { GMAIL_TOKEN: "${GMAIL_TOKEN}" }, headers: {} } as never },
  { ...base, id: "r", kind: "rule", name: "lint", rule: { when: "After a tool runs", filter: "Edit", command: "npm run lint" } },
];
const load = async (url: string) => new TextEncoder().encode(`contents of ${url}`);
const decode = (data: Uint8Array) => new TextDecoder().decode(data);

describe("harnessMap", () => {
  it("every entry has a source and a checked month, and names a harness in the registry with a source", () => {
    expect(HARNESS_MAP.length).toBeGreaterThan(0);
    for (const entry of HARNESS_MAP) {
      expect(entry.source.length).toBeGreaterThan(0);
      for (const url of entry.source) expect(url).toMatch(/^https:\/\//);
      expect(entry.checked).toMatch(/^\d{4}-\d{2}$/);
      const tool = TOOLS.find((candidate) => candidate.id === entry.harness);
      expect(tool?.source).toBeTruthy();
      expect(entry.source).toContain(tool?.source);
    }
  });

  it("does not offer a harness it has no entry for", () => {
    expect(harnessEntry("cursor")).toBeNull();
    expect(harnessEntry("codex")).toBeNull();
    expect(mappedHarnesses().map((entry) => entry.harness)).not.toContain("cursor");
  });

  it("Claude Code's entry matches what setupFolder writes, and its folder is byte-identical to today's", async () => {
    const claude = harnessEntry("claude-code");
    expect(claude).toMatchObject({ contextFile: "CLAUDE.md", skillsDir: ".claude/skills/<name>/", mcpConfig: ".mcp.json", hooks: ".claude/settings.json" });
    const today = await setupFolder(items, load);
    const mapped = await setupFolderFor(items, load, claude);
    expect(mapped.entries.map((entry) => [entry.path, decode(entry.data)])).toEqual(today.entries.map((entry) => [entry.path, decode(entry.data)]));
    expect(mapped.notCarried).toEqual([]);
    expect(today.entries.map((entry) => entry.path)).toEqual(["CLAUDE.md", ".claude/skills/launch-checklist/SKILL.md", ".claude/skills/launch-checklist/steps.md", ".mcp.json", ".claude/settings.json"]);
  });

  it("each mapped harness writes its own file names", async () => {
    const devin = await setupFolderFor(items, load, harnessEntry("devin-desktop"));
    expect(devin.entries.map((entry) => entry.path)).toEqual(["AGENTS.md", ".devin/skills/launch-checklist/SKILL.md", ".devin/skills/launch-checklist/steps.md", "NOT-CARRIED.md"]);
    const hermes = await setupFolderFor(items, load, harnessEntry("hermes-agent"));
    expect(hermes.entries.map((entry) => entry.path)).toEqual(["HERMES.md", ".hermes/skills/launch-checklist/SKILL.md", ".hermes/skills/launch-checklist/steps.md", "NOT-CARRIED.md"]);
    const openclaw = await setupFolderFor(items, load, harnessEntry("openclaw"));
    expect(openclaw.entries[0].path).toBe("AGENTS.md");
    expect(openclaw.entries[1].path).toBe("skills/launch-checklist/SKILL.md");
  });

  it("a field with no equivalent goes to notCarried and to NOT-CARRIED.md", async () => {
    const devin = harnessEntry("devin-desktop");
    if (!devin) throw new Error("no entry");
    const nulled = { ...devin, hooks: null, contextFile: null };
    const folder = await setupFolderFor(items, load, nulled);
    expect(folder.notCarried).toEqual(expect.arrayContaining([notCarriedLine("hooks", nulled), notCarriedLine("contextFile", nulled)]));
    const file = folder.entries.find((entry) => entry.path === "NOT-CARRIED.md");
    expect(decode(file?.data ?? new Uint8Array())).toContain("Hooks: no documented equivalent in Devin Desktop (docs, November 2026)");
    // The setup prompt says the same: an approval mode the harness does not document does not carry over.
    const prompt = setupPromptOf("as-a1", { tree: assistantTree.map((node) => (node.id === "as-a1" ? { ...node, payload: { ...(node.payload as object), approval_mode: "reviewer" } } : node)) as never }, "devin-desktop");
    expect(prompt.notCarried).toContain(notCarriedLine("approvalModes", devin));
    expect(prompt.text).toContain("Create AGENTS.md with this content:");
  });

  it("the setup prompt names the target harness and its own words for a mode", () => {
    const prompt = setupPromptOf("as-a1", { tree: assistantTree.map((node) => (node.id === "as-a1" ? { ...node, payload: { ...(node.payload as object), approval_mode: "full" } } : node)) as never }, "claude-code");
    expect(prompt.text.startsWith("Use Claude Code on an always-on machine (Mac Mini).")).toBe(true);
    expect(prompt.text).toContain("Create CLAUDE.md with this content:");
    expect(prompt.text).toContain("Let it act without asking (in Claude Code: bypassPermissions).");
    expect(prompt.text).toContain("Add the skill inbox-zero in .claude/skills/inbox-zero/: sorts the inbox.");
  });
});
