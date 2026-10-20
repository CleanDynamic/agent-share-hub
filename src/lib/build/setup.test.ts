// CA-04 P4 — the session setup: where dropped files go, what is kept of them, and the folder it downloads as.

import { beforeEach, describe, expect, it, vi } from "vitest";

const placeTopNode = vi.fn();
const placeChildNode = vi.fn();
vi.mock("./composeCover", () => ({
  placeTopNode: (...a: unknown[]) => placeTopNode(...a),
  placeChildNode: (...a: unknown[]) => placeChildNode(...a),
}));
const upsertNode = vi.fn();
vi.mock("./nodes", () => ({ upsertNode: (...a: unknown[]) => upsertNode(...a), reorderNodes: vi.fn(), getNodeTree: vi.fn(), deleteNode: vi.fn() }));

import {
  addSetupFile,
  addSetupRule,
  addSetupServer,
  readHooks,
  readMcpJson,
  readSkillTop,
  routeSetupFiles,
  setNotShared,
  setupItemsOf,
  type DroppedFile,
} from "./setup";
import { mcpJson, rootPath, setupFolder, settingsJson } from "./setupFolder";
import { readZip, writeZip } from "./zip";
import type { ReaderSetupItem } from "./readerSteps";
import type { BuildNode, NodeTree } from "./types";

/** A session's setup as the build page reads it: instructions, a skill with a file, two servers, the hooks, and a file not shared. */
function readSetupForTest(mcp: string, settings: string, skill: string): ReaderSetupItem[] {
  const base = { description: null, notShared: false, files: [], server: null, rule: null, path: null };
  return [
    { ...base, id: "i1", kind: "instructions", kindLabel: "Instructions", name: "CLAUDE.md", download: "https://example.com/claude.md", path: "project/CLAUDE.md" },
    { ...base, id: "i2", kind: "instructions", kindLabel: "Instructions", name: "copilot-instructions.md", download: "https://example.com/copilot.md", path: ".github/copilot-instructions.md" },
    { ...base, id: "i3", kind: "instructions", kindLabel: "Instructions", name: "secret-notes.md", download: "https://example.com/secret-notes.md", notShared: true },
    {
      ...base,
      id: "s1",
      kind: "skill",
      kindLabel: "Skill",
      name: readSkillTop(skill).name ?? "",
      description: readSkillTop(skill).description,
      download: "https://example.com/skill.md",
      path: "order-forms/SKILL.md",
      files: [{ id: "f1", name: "form.tsx", path: "order-forms/form.tsx", download: "https://example.com/form.tsx" }],
    },
    ...readMcpJson(mcp).map((server, at) => ({ ...base, id: `m${at}`, kind: "server" as const, kindLabel: "MCP server", name: server.name, download: null, server })),
    ...readHooks(settings).map((rule, at) => ({ ...base, id: `r${at}`, kind: "rule" as const, kindLabel: "Rule", name: rule.command, download: null, rule })),
  ];
}

beforeEach(() => {
  placeTopNode.mockReset();
  placeTopNode.mockImplementation(async (_b: string, _t: unknown, node: Record<string, unknown>) => ({ id: "n", build_id: "b", parent_id: null, position: 1, ...node }));
  placeChildNode.mockReset();
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
});

const MCP = JSON.stringify({
  mcpServers: {
    github: { type: "http", url: "https://api.githubcopilot.com/mcp/", headers: { Authorization: "Bearer ghp_SECRET_TOKEN" } },
    files: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem"], env: { API_KEY: "sk-SECRET-VALUE" } },
  },
});

const SETTINGS = JSON.stringify({
  permissions: { allow: ["Bash(npm test)"] },
  hooks: {
    PostToolUse: [{ matcher: "Edit|Write", hooks: [{ type: "command", command: "npm test" }] }],
    SessionStart: [{ hooks: [{ type: "command", command: "git status" }] }],
    Notification: [{ hooks: [{ type: "command", command: "say done" }] }],
  },
});

const SKILL = `---
name: order-forms
description: Builds an order form for a small shop, "with" a total that always adds up.
---

# Order forms
`;

describe("where a dropped file goes", () => {
  it("routes every name that says what it is, and leaves the rest as the build's files", () => {
    const files: DroppedFile[] = [
      { name: "CLAUDE.md", path: "CLAUDE.md" },
      { name: "AGENTS.md", path: "repo/AGENTS.md" },
      { name: "style.mdc", path: ".cursor/rules/style.mdc" },
      { name: "copilot-instructions.md", path: ".github/copilot-instructions.md" },
      { name: "SKILL.md", path: "order-forms/SKILL.md", text: SKILL },
      { name: "form.tsx", path: "order-forms/form.tsx" },
      { name: ".mcp.json", path: ".mcp.json", text: MCP },
      { name: "settings.json", path: ".claude/settings.json", text: SETTINGS },
      { name: "menu.pdf", path: "menu.pdf" },
    ];
    const { drafts, rest } = routeSetupFiles(files);
    expect(drafts.map((draft) => draft.kind)).toEqual(["skill", "instructions", "instructions", "instructions", "instructions", "server", "server", "rule", "rule", "rule"]);
    expect(drafts[0]).toEqual({ kind: "skill", file: 4, name: "order-forms", description: 'Builds an order form for a small shop, "with" a total that always adds up.', files: [5] });
    expect(rest).toEqual([8]);
  });

  it("takes a settings.json dropped on its own as rules only when it has hooks", () => {
    expect(routeSetupFiles([{ name: "settings.json", path: "settings.json", text: SETTINGS }]).drafts).toHaveLength(3);
    expect(routeSetupFiles([{ name: "settings.json", path: "settings.json", text: "{}" }]).rest).toEqual([0]);
  });
});

describe("what is kept", () => {
  it("reads a SKILL.md's top block word for word", () => {
    expect(readSkillTop(SKILL)).toEqual({ name: "order-forms", description: 'Builds an order form for a small shop, "with" a total that always adds up.' });
    expect(readSkillTop("---\nname: \"quoted name\"\n---\n")).toEqual({ name: "quoted name", description: null });
    expect(readSkillTop("# no top block")).toEqual({ name: null, description: null });
  });

  it("replaces every env and header value with ${NAME}, and never saves a value", async () => {
    const servers = readMcpJson(MCP);
    expect(servers.map((server) => [server.name, server.type, server.url, server.command])).toEqual([
      ["github", "http", "https://api.githubcopilot.com/mcp/", null],
      ["files", null, null, "npx"],
    ]);
    expect(servers[0].headers).toEqual({ Authorization: "${Authorization}" });
    expect(servers[1].env).toEqual({ API_KEY: "${API_KEY}" });
    // Even a server handed over with its values still in it is saved with placeholders.
    await addSetupServer("b", [], "typed-a", { ...servers[1], env: { API_KEY: "sk-SECRET-VALUE" } });
    for (const server of servers) await addSetupServer("b", [], "typed-a", server);
    const saved = JSON.stringify(placeTopNode.mock.calls.map((call) => call[2]));
    expect(saved).not.toContain("SECRET");
    expect(saved).not.toContain("ghp_");
    expect(placeTopNode.mock.calls[0][2].payload).toMatchObject({ service: "files", setup: { session: "typed-a", kind: "server" }, connection: "mcp", runs_at: "local", server: { env: { API_KEY: "${API_KEY}" } } });
    expect(placeTopNode.mock.calls[1][2].payload).toMatchObject({ service: "github", runs_at: "web" });
  });

  it("turns each hook into a rule: its event in plain words, its matcher as the filter, its command as the code", async () => {
    const rules = readHooks(SETTINGS);
    expect(rules).toEqual([
      { when: "After a tool runs", filter: "Edit|Write", command: "npm test" },
      { when: "When the session starts", filter: null, command: "git status" },
      { when: "Notification", filter: null, command: "say done" },
    ]);
    await addSetupRule("b", [], "typed-a", rules[0]);
    expect(placeTopNode.mock.calls[0][2]).toMatchObject({ type: "code", payload: { source: "npm test", language: "bash", setup: { session: "typed-a", kind: "rule" }, rule: { when: "After a tool runs", filter: "Edit|Write" } } });
    expect(JSON.stringify(placeTopNode.mock.calls[0][2])).not.toContain("permissions");
  });

  it("files a skill with its name and description, and the files beside it inside it", async () => {
    await addSetupFile("b", [], { session: "typed-a", kind: "skill", title: "SKILL.md", path: "order-forms/SKILL.md", media_id: "m1", skill: readSkillTop(SKILL) });
    expect(placeTopNode.mock.calls[0][2].payload).toEqual({
      title: "SKILL.md",
      path: "order-forms/SKILL.md",
      media_id: "m1",
      setup: { session: "typed-a", kind: "skill" },
      skill: { name: "order-forms", description: 'Builds an order form for a small shop, "with" a total that always adds up.' },
    });
    await addSetupFile("b", [], { session: "typed-a", kind: "skill", title: "form.tsx", media_id: "m2", parentId: "skill-1" });
    expect(placeChildNode.mock.calls[0][2]).toBe("skill-1");
  });
});

describe("Not shared", () => {
  it("keeps the name and a skill's description, and drops what a reader could open", async () => {
    const node = { id: "s", build_id: "b", parent_id: null, position: 1, type: "document", title: null, note: null, source_ref: null, event_id: null, is_gap: false, created_at: "", payload: { title: "SKILL.md", media_id: "m1", setup: { session: "typed-a", kind: "skill" }, skill: { name: "order-forms", description: "d" } } } as unknown as BuildNode;
    const saved = (await setNotShared(node, true)) as BuildNode;
    expect(saved.payload).toEqual({ title: "SKILL.md", setup: { session: "typed-a", kind: "skill" }, skill: { name: "order-forms", description: "d" }, not_shared: true });
    const [item] = setupItemsOf([{ ...saved, children: [] } as NodeTree]);
    expect([item.name, item.description, item.notShared, item.mediaId]).toEqual(["order-forms", "d", true, null]);
  });

  it("refuses anything that is not part of a setup", async () => {
    const node = { id: "p", type: "prompt", payload: { text: "x" } } as unknown as BuildNode;
    await expect(setNotShared(node, true)).rejects.toThrow(/setup/);
  });
});

describe("the setup, as a folder", () => {
  it("writes a ZIP that reads back byte for byte", () => {
    const encoder = new TextEncoder();
    const entries = [
      { path: "CLAUDE.md", data: encoder.encode("# Rules\n") },
      { path: ".claude/skills/order-forms/SKILL.md", data: encoder.encode(SKILL) },
      { path: "empty.txt", data: new Uint8Array(0) },
      { path: "bin.dat", data: new Uint8Array([0, 255, 1, 254]) },
    ];
    const back = readZip(writeZip(entries));
    expect(back.map((entry) => entry.path)).toEqual(entries.map((entry) => entry.path));
    back.forEach((entry, at) => expect([...entry.data]).toEqual([...entries[at].data]));
  });

  it("puts each item where its tool expects it, placeholders and all, and leaves out what is not shared", async () => {
    const items = readSetupForTest(MCP, SETTINGS, SKILL);
    const loaded: string[] = [];
    const { entries, missing } = await setupFolder(items, async (url) => {
      loaded.push(url);
      return new TextEncoder().encode(`bytes of ${url}`);
    });
    expect(entries.map((entry) => entry.path)).toEqual(["CLAUDE.md", ".github/copilot-instructions.md", ".claude/skills/order-forms/SKILL.md", ".claude/skills/order-forms/form.tsx", ".mcp.json", ".claude/settings.json"]);
    expect(missing).toEqual([]);
    expect(loaded).not.toContain("https://example.com/secret-notes.md");
    const text = (path: string) => new TextDecoder().decode(entries.find((entry) => entry.path === path)?.data);
    expect(JSON.parse(text(".mcp.json")).mcpServers.github.headers).toEqual({ Authorization: "${Authorization}" });
    expect(JSON.parse(text(".claude/settings.json")).hooks.PostToolUse).toEqual([{ matcher: "Edit|Write", hooks: [{ type: "command", command: "npm test" }] }]);
    expect(rootPath("project/CLAUDE.md")).toBe("CLAUDE.md");
    expect(mcpJson([])).toBe('{\n  "mcpServers": {}\n}\n');
    expect(settingsJson([])).toBe('{\n  "hooks": {}\n}\n');
  });
});
