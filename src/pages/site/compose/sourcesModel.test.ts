import { describe, expect, it } from "vitest";

import type { SessionGroup, Step } from "@/lib/build/graph";
import type { SessionSummary } from "@/lib/build/sessions";
import type { BuildNode } from "@/lib/build/types";

import { isChatExport, looksLikeChatExport, librarySources, projectFileReminders, sourceFiles, sourceSessions } from "./sourcesModel";

const step = (over: Partial<Step>): Step => ({
  id: "n1", kind: "prompt", number: "1", title: null, defaultTitle: "Prompt 1", text: "x", words: 1, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...over,
});
const group = (over: Partial<SessionGroup>): SessionGroup => ({ sessionId: "a", number: 1, tool: "Claude", model: "Opus 5.5", startedAt: "2026-03-03T10:00:00", stepNumbers: ["1"], ...over });
const summary = (over: Partial<SessionSummary>): SessionSummary => ({
  id: "x", client: "claude", model: null, targetBuildId: null, modelName: "Opus 5.5", firstPrompt: null, promptCount: 2, turnCount: 4, createdAt: "2026-03-01T10:00:00", buildId: null, status: "parsed", ...over,
});

describe("sourceSessions", () => {
  it("nests the prompts a session gave, with default titles marked", () => {
    const steps = [step({ id: "n1", number: "1", sessionId: "a" }), step({ id: "n2", number: "2", sessionId: "a", title: "Copy" }), step({ id: "n3", number: "3", sessionId: "b" })];
    const rows = sourceSessions([group({ stepNumbers: ["1", "2"] }), group({ sessionId: "b", number: 2, tool: "Claude Code" })], steps);
    expect(rows.map((r) => [r.number, r.tool, r.detail])).toEqual([[1, "Claude", "Opus 5.5 · 3 Mar"], [2, "Claude Code", "Opus 5.5 · 3 Mar"]]);
    expect(rows[0].prompts.map((p) => [p.number, p.title, p.isDefault])).toEqual([["1", "Prompt 1", true], ["2", "Copy", false]]);
  });

  it("draws prompts written here as one 'typed here' session", () => {
    const rows = sourceSessions([group({ sessionId: null, tool: null, model: null, startedAt: "typed here", stepNumbers: ["1"] })], [step({})]);
    expect(rows[0]).toMatchObject({ key: "typed-1", tool: "Unknown tool", detail: "typed here" });
    expect(rows[0].prompts).toHaveLength(1);
  });

  it("keeps a session in the build that has no prompt yet, numbered on", () => {
    const rows = sourceSessions([group({})], [step({ sessionId: "a" })], [summary({ id: "a" }), summary({ id: "z", client: "claude-code" })]);
    expect(rows.map((r) => [r.key, r.number, r.prompts.length])).toEqual([["a", 1, 1], ["z", 2, 0]]);
  });
});

describe("sourceFiles and librarySources", () => {
  it("says where a file came from", () => {
    const node = (id: string, payload: object) => ({ id, type: "document", parent_id: null, payload }) as unknown as BuildNode;
    const rows = sourceFiles([node("1", { title: "menu.pdf", session_id: "a" }), node("2", { title: "logo.png" })], [group({})]);
    expect(rows.map((r) => r.note)).toEqual(["opened in session 1", "added by you"]);
  });

  it("notes a file a step makes with the step's number", () => {
    const node = (id: string, payload: object) => ({ id, type: "document", parent_id: null, payload }) as unknown as BuildNode;
    const steps = [step({ id: "p1", number: "1" }), step({ id: "p2", number: "2" })];
    const rows = sourceFiles([node("1", { title: "brand-guide.md", made_by: "p2" }), node("2", { title: "logo.png" })], [group({})], steps);
    expect(rows.map((r) => r.note)).toEqual(["made in step 2", "added by you"]);
  });

  it("lists only parsed sessions that are in no build", () => {
    const rows = librarySources([summary({ id: "1" }), summary({ id: "2", buildId: "b" }), summary({ id: "3", status: "claimed" })], new Set(["1"]), Date.now());
    expect(rows).toEqual([{ id: "1", label: "Opus 5.5", line: "1 Mar · 2 prompts", adding: true }]);
  });
});

const lovableExport = JSON.stringify({ messages: [{ id: "m1", role: "user", content: "Build me a box.", createdAt: "2026-08-18T09:12:04.000Z", createTime: "2026-08-18T09:12:05.100Z", patch: [], images: [], raw: {} }] });

describe("looksLikeChatExport", () => {
  it("does not take a workflow for a chat", () => {
    expect(looksLikeChatExport(JSON.stringify({ nodes: [{ id: 1 }], connections: {} }))).toBe(false);
    expect(looksLikeChatExport(JSON.stringify({ nodes: [{ id: 1 }], links: [] }))).toBe(false);
    expect(looksLikeChatExport("not json")).toBe(false);
  });

  it("takes ChatGPT, Claude and Lovable exports", () => {
    expect(looksLikeChatExport(JSON.stringify([{ title: "t", mapping: {} }]))).toBe(true);
    expect(looksLikeChatExport(JSON.stringify({ conversations: [{ mapping: {} }] }))).toBe(true);
    expect(looksLikeChatExport(JSON.stringify([{ uuid: "u", chat_messages: [] }]))).toBe(true);
    expect(looksLikeChatExport(JSON.stringify({ messages: [{ chat_messages: [] }] }))).toBe(true);
    expect(looksLikeChatExport(lovableExport)).toBe(true);
  });
});

describe("isChatExport", () => {
  const dropped = (name: string, type: string, text: string) => new File([text], name, { type });

  it("takes a jsonl file without reading it", async () => {
    expect(await isChatExport({ name: "chat.jsonl", type: "" })).toBe(true);
  });

  it("reads a json file before deciding", async () => {
    expect(await isChatExport(dropped("flow.json", "application/json", '{"nodes":[],"connections":{}}'))).toBe(false);
    expect(await isChatExport(dropped("export.json", "", '[{"mapping":{}}]'))).toBe(true);
    expect(await isChatExport(dropped("menu.pdf", "application/pdf", "x"))).toBe(false);
  });
});

describe("projectFileReminders", () => {
  const tools = (...names: string[]) => names.map((tool) => ({ tool }));
  const files = (...names: string[]) => names.map((name) => ({ name }));

  it("asks for the first project file of each coding tool in the build that has none", () => {
    expect(projectFileReminders(tools("Claude Code"), [])).toEqual([{ toolId: "claude-code", line: "Claude Code reads CLAUDE.md", file: "CLAUDE.md" }]);
    expect(projectFileReminders(tools("Cursor"), files("menu.pdf"))).toEqual([{ toolId: "cursor", line: "Cursor reads .cursor/rules/", file: ".cursor/rules/" }]);
  });

  it("says nothing for a chat tool, an unknown tool, or a tool with its file in the build", () => {
    expect(projectFileReminders(tools("ChatGPT", "Unknown tool"), [])).toEqual([]);
    expect(projectFileReminders(tools("Claude Code"), files("docs/claude.md"))).toEqual([]);
    // SKILL.md is a second file: it does not stand in for the first.
    expect(projectFileReminders(tools("Claude Code"), files("SKILL.md"))).toHaveLength(1);
  });

  it("lists a tool once however many sessions it has, and at most two rows", () => {
    expect(projectFileReminders(tools("Claude Code", "Claude Code"), [])).toHaveLength(1);
    expect(projectFileReminders(tools("Claude Code", "Codex", "Cursor", "GitHub Copilot"), []).map((r) => r.toolId)).toEqual(["claude-code", "codex"]);
  });
});
