import { describe, expect, it } from "vitest";

import type { SessionGroup, Step } from "@/lib/build/graph";
import type { SessionSummary } from "@/lib/build/sessions";
import type { BuildNode } from "@/lib/build/types";

import { alsoInLine, isChatExport, looksLikeChatExport, librarySources, projectFileReminders, sourceFiles, sourceSessions, unfinishedSources } from "./sourcesModel";

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

  it("draws prompts written here as one session with no app chosen", () => {
    const rows = sourceSessions([group({ sessionId: null, tool: null, model: null, startedAt: "typed here", stepNumbers: ["1"] })], [step({})]);
    expect(rows[0]).toMatchObject({ key: "typed-1", tool: "No harness chosen", detail: "" });
    expect(rows[0].prompts).toHaveLength(1);
  });

  it("keeps a session in the build that has no prompt yet, numbered on", () => {
    const rows = sourceSessions([group({})], [step({ sessionId: "a" })], [summary({ id: "a" }), summary({ id: "z", client: "claude-code" })]);
    expect(rows.map((r) => [r.key, r.number, r.prompts.length])).toEqual([["a", 1, 1], ["z", 2, 0]]);
  });
});

describe("sourceSessions: a session given its tool (TF-13)", () => {
  const steps = [step({ sessionId: "a" })];

  it("shows the chosen tool, and offers the picker, when the client names none", () => {
    const rows = sourceSessions([group({ tool: "Perplexity" })], steps, [summary({ id: "a", client: "unknown" })], { a: "perplexity" });
    expect(rows[0]).toMatchObject({ tool: "Perplexity", pickTool: { value: "perplexity" } });
  });

  it("reads 'No harness chosen' until one is chosen, and offers the picker", () => {
    const rows = sourceSessions([group({ tool: null })], steps, [summary({ id: "a", client: "web" })]);
    expect(rows[0]).toMatchObject({ tool: "No harness chosen", pickTool: { value: null } });
  });

  it("offers no picker when the client names the tool", () => {
    const rows = sourceSessions([group({ tool: "Claude" })], steps, [summary({ id: "a", client: "claude" })], { a: "perplexity" });
    expect(rows[0].tool).toBe("Claude");
    expect(rows[0].pickTool).toBeUndefined();
  });

  it("gives a session with no prompt yet its chosen tool too", () => {
    const rows = sourceSessions([], [], [summary({ id: "z", client: "unknown" })], { z: "perplexity" });
    expect(rows[0]).toMatchObject({ tool: "Perplexity", pickTool: { value: "perplexity" } });
  });

  it("offers none for prompts typed here", () => {
    const rows = sourceSessions([group({ sessionId: null, tool: null, startedAt: "typed here" })], [step({})]);
    expect(rows[0].pickTool).toBeUndefined();
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

  it("lists every finished session: waiting, in this draft, in other drafts and expired, none hidden", () => {
    const rows = librarySources(
      [
        summary({ id: "1", status: "parsed", draftIds: [] }),
        summary({ id: "2", status: "claimed", buildId: "b", draftIds: ["b"] }),
        summary({ id: "3", status: "expired", draftIds: ["x", "y"] }),
        summary({ id: "4", status: "claimed", buildId: "other", draftIds: ["other"] }),
      ],
      new Set(["1"]),
      Date.now(),
      "b",
    );
    expect(rows.map((r) => [r.id, r.inThisDraft, r.alsoIn, r.adding])).toEqual([
      ["1", false, null, true],
      ["2", true, null, false],
      ["3", false, "Also in 2 drafts", false],
      ["4", false, "Also in 1 draft", false],
    ]);
    // SV-05 P3: the line starts with the app (No harness chosen when it is not known), then the model, the day and the count.
    expect(rows[0]).toMatchObject({ label: "Opus 5.5", line: expect.stringMatching(/ · Opus 5\.5 · 1 Mar · 2 prompts$/) });
    expect(JSON.stringify(rows)).not.toMatch(/expired/i);
  });

  it("counts a session claimed before CA-12 as in the draft it names, when the read gave no draft list", () => {
    const rows = librarySources([summary({ id: "1", status: "claimed", buildId: "b" })], new Set(), Date.now(), "b");
    expect(rows[0]).toMatchObject({ inThisDraft: true, alsoIn: null });
  });

  it("says where else a session is, not counting this draft", () => {
    expect(alsoInLine(["b"], "b")).toBeNull();
    expect(alsoInLine(["b", "c"], "b")).toBe("Also in 1 draft");
    expect(alsoInLine(["b", "c", "d"], "b")).toBe("Also in 2 drafts");
    expect(alsoInLine(["c"], null)).toBe("Also in 1 draft");
  });

  it("splits imports that are not sessions yet into Still arriving and Didn't finish", () => {
    const groups = unfinishedSources(
      [
        { id: "a", status: "open", client: "claude", createdAt: "2026-03-04T10:00:00Z" },
        { id: "b", status: "assembling", client: null, createdAt: "2026-03-05T10:00:00Z" },
        { id: "c", status: "failed", client: "chatgpt", createdAt: "2026-03-06T10:00:00Z", reason: "It couldn't be read." },
        { id: "d", status: "duplicate", client: null, createdAt: "2026-03-07T10:00:00Z", reason: "You had already sent this one." },
      ],
      Date.now(),
    );
    expect(groups.arriving.map((i) => [i.id, i.line])).toEqual([["a", "Sent 4 Mar"], ["b", "Sent 5 Mar"]]);
    expect(groups.didntFinish.map((i) => [i.id, i.line])).toEqual([["c", "It couldn't be read."], ["d", "You had already sent this one."]]);
    expect(unfinishedSources([], Date.now())).toEqual({ arriving: [], didntFinish: [] });
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
    expect(projectFileReminders(tools("ChatGPT", "No harness chosen"), [])).toEqual([]);
    expect(projectFileReminders(tools("Claude Code"), files("docs/claude.md"))).toEqual([]);
    // SKILL.md is a second file: it does not stand in for the first.
    expect(projectFileReminders(tools("Claude Code"), files("SKILL.md"))).toHaveLength(1);
  });

  it("lists a tool once however many sessions it has, and at most two rows", () => {
    expect(projectFileReminders(tools("Claude Code", "Claude Code"), [])).toHaveLength(1);
    expect(projectFileReminders(tools("Claude Code", "Codex", "Cursor", "GitHub Copilot"), []).map((r) => r.toolId)).toEqual(["claude-code", "codex"]);
  });
});
