// refreshMakingStats — what it reads, what it writes, what it never writes,
// and that it never throws once the sessions are read.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "./sessions";

const maybeSingle = vi.fn();
const fromBuilds = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => fromBuilds(table) },
}));

const listBuildSessions = vi.fn();
vi.mock("./sessions", () => ({
  listBuildSessions: (...a: unknown[]) => listBuildSessions(...a),
}));

const updateBuild = vi.fn();
vi.mock("./builds", () => ({
  updateBuild: (...a: unknown[]) => updateBuild(...a),
}));

import { addMadeWithTools, nextMadeWith, type MakingSession, refreshMakingStats, setMadeWithEntry, setMadeWithModel, setSessionTool, toolLabel, withTools } from "./making";

const BUILD_ID = "33333333-0000-4000-8000-000000000003";

function session(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "s",
    client: "claude-code",
    model: "claude-sonnet-5-5",
    targetBuildId: null,
    modelName: "Sonnet 5.5",
    firstPrompt: "SECRET CONVERSATION TEXT",
    promptCount: 9,
    turnCount: 38,
    createdAt: "2026-10-05T10:00:00Z",
    buildId: BUILD_ID,
    ...overrides,
  };
}

function build(madeWith: string[] = [], making: unknown = {}) {
  maybeSingle.mockResolvedValue({ data: { made_with: madeWith, making }, error: null });
}

const patch = () => updateBuild.mock.calls[0][1] as Record<string, unknown>;

beforeEach(() => {
  maybeSingle.mockReset();
  updateBuild.mockReset();
  updateBuild.mockResolvedValue({});
  listBuildSessions.mockReset();
  fromBuilds.mockReset();
  fromBuilds.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle }) }),
  }));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("refreshMakingStats", () => {
  it("writes the counts, deduplicated models in session order, and the making object", async () => {
    listBuildSessions.mockResolvedValue([
      session(),
      session({ client: "chatgpt", model: "gpt-6-luna", modelName: "GPT-6 Luna", promptCount: 3, turnCount: 10 }),
      session({ promptCount: 1, turnCount: 2 }),
    ]);
    build();
    await refreshMakingStats(BUILD_ID);

    expect(listBuildSessions).toHaveBeenCalledWith(BUILD_ID);
    expect(updateBuild.mock.calls[0][0]).toBe(BUILD_ID);
    expect(patch()).toMatchObject({
      session_count: 3,
      prompt_count: 13,
      ai_turn_count: 50,
      models_used: ["Sonnet 5.5", "GPT-6 Luna"],
      making: {
        sessions: [
          { client: "claude-code", model: "Sonnet 5.5", prompts: 9, turns: 38 },
          { client: "chatgpt", model: "GPT-6 Luna", prompts: 3, turns: 10 },
          { client: "claude-code", model: "Sonnet 5.5", prompts: 1, turns: 2 },
        ],
        excluded_models: [],
      },
    });
  });

  it("never writes conversation text", async () => {
    listBuildSessions.mockResolvedValue([session()]);
    build();
    await refreshMakingStats(BUILD_ID);
    expect(JSON.stringify(patch())).not.toContain("SECRET CONVERSATION TEXT");
  });

  it("writes each session's id and start date, and reads an entry without them", async () => {
    listBuildSessions.mockResolvedValue([session({ id: "imp-1", createdAt: "2026-10-05T10:00:00Z" })]);
    build();
    await refreshMakingStats(BUILD_ID);
    const { sessions } = patch().making as { sessions: Record<string, unknown>[] };
    expect(sessions[0]).toMatchObject({ id: "imp-1", started_at: "2026-10-05T10:00:00Z", client: "claude-code" });

    const old: MakingSession = { client: "claude", model: "Sonnet 5.5", prompts: 1, turns: 2 };
    expect(old.id).toBeUndefined();
    expect(old.started_at).toBeUndefined();
  });

  it("leaves excluded models out of models_used and made_with, and keeps excluded_models", async () => {
    listBuildSessions.mockResolvedValue([
      session(),
      session({ model: "gpt-6-luna", modelName: "GPT-6 Luna" }),
    ]);
    build([], { excluded_models: ["Sonnet 5.5"] });
    await refreshMakingStats(BUILD_ID);

    expect(patch().models_used).toEqual(["GPT-6 Luna"]);
    expect(patch().made_with).toEqual(["Claude Code", "GPT-6 Luna"]);
    expect((patch().making as { excluded_models: string[] }).excluded_models).toEqual(["Sonnet 5.5"]);
    // the session still shows what it ran on in the making object
    expect((patch().making as { sessions: { model: string }[] }).sessions[0].model).toBe("Sonnet 5.5");
  });

  it("adds to made_with without removing or duplicating anything", async () => {
    listBuildSessions.mockResolvedValue([session()]);
    build(["Cursor", "claude code", "Hand-added"]);
    await refreshMakingStats(BUILD_ID);
    expect(patch().made_with).toEqual(["Cursor", "claude code", "Hand-added", "Sonnet 5.5"]);
  });

  it("names no tool for web or unknown clients and skips sessions with no model", async () => {
    listBuildSessions.mockResolvedValue([
      session({ client: "web", model: null, modelName: null }),
      session({ client: null, model: null, modelName: null }),
    ]);
    build();
    await refreshMakingStats(BUILD_ID);
    expect(patch().made_with).toEqual([]);
    expect(patch().models_used).toEqual([]);
    expect(patch().session_count).toBe(2);
  });

  it("writes zeros for a build with no sessions", async () => {
    listBuildSessions.mockResolvedValue([]);
    build();
    await refreshMakingStats(BUILD_ID);
    expect(patch()).toMatchObject({ session_count: 0, prompt_count: 0, ai_turn_count: 0, models_used: [] });
  });

  it("ignores a malformed making column", async () => {
    listBuildSessions.mockResolvedValue([session()]);
    build([], ["not", "an", "object"]);
    await refreshMakingStats(BUILD_ID);
    expect((patch().making as { excluded_models: string[] }).excluded_models).toEqual([]);
  });

  it("logs and returns when the build cannot be read, or the write fails", async () => {
    listBuildSessions.mockResolvedValue([session()]);
    maybeSingle.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(refreshMakingStats(BUILD_ID)).resolves.toBeUndefined();
    expect(updateBuild).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.any(String), { code: "42501", buildId: BUILD_ID });

    build();
    updateBuild.mockRejectedValue(new Error("write failed with a value in it"));
    await expect(refreshMakingStats(BUILD_ID)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenLastCalledWith(expect.any(String), { code: "unknown", buildId: BUILD_ID });
  });
});

describe("Made with, changed in the composer (UI-P48)", () => {
  it("unticking a model removes it from made_with and remembers it in excluded_models", () => {
    expect(nextMadeWith({ madeWith: ["Claude Code", "Sonnet 5.5"], excluded: [] }, "Sonnet 5.5", false, "model")).toEqual({
      madeWith: ["Claude Code"],
      excluded: ["Sonnet 5.5"],
    });
  });

  it("ticking it again puts it back and forgets the exclusion, ignoring case", () => {
    expect(nextMadeWith({ madeWith: ["Claude Code"], excluded: ["sonnet 5.5"] }, "Sonnet 5.5", true, "model")).toEqual({
      madeWith: ["Claude Code", "Sonnet 5.5"],
      excluded: [],
    });
  });

  it("an entry typed by hand only comes and goes; nothing is excluded", () => {
    const state = { madeWith: ["Midjourney"], excluded: ["Opus 5.5"] };
    expect(nextMadeWith(state, "Midjourney", false, "entry")).toEqual({ madeWith: [], excluded: ["Opus 5.5"] });
    expect(nextMadeWith({ madeWith: [], excluded: [] }, "Figma", true, "entry")).toEqual({ madeWith: ["Figma"], excluded: [] });
  });

  it("setMadeWithModel writes made_with without the model and excluded_models with it, then refreshes the stats", async () => {
    const sessions = [{ client: "claude-code", model: "Sonnet 5.5", prompts: 4, turns: 8 }];
    const row = (madeWith: string[], excluded: string[]) => ({ data: { made_with: madeWith, making: { sessions, excluded_models: excluded } }, error: null });
    maybeSingle
      .mockResolvedValueOnce(row(["Claude Code", "Sonnet 5.5"], [])) // the change's own read
      .mockResolvedValueOnce(row(["Claude Code"], ["Sonnet 5.5"])) // the refresh's read, after the change
      .mockResolvedValueOnce(row(["Claude Code"], ["Sonnet 5.5"])); // the read back
    listBuildSessions.mockResolvedValue([session()]);
    const done = await setMadeWithModel(BUILD_ID, "Sonnet 5.5", false);

    const write = patch();
    expect(updateBuild.mock.calls[0][0]).toBe(BUILD_ID);
    expect(write.made_with).toEqual(["Claude Code"]);
    expect(write.making).toEqual({ sessions, excluded_models: ["Sonnet 5.5"] });
    // The refresh ran after it, and kept the model out of both lists.
    expect(listBuildSessions).toHaveBeenCalledWith(BUILD_ID);
    const refreshed = updateBuild.mock.calls[1][1] as Record<string, unknown>;
    expect(refreshed.made_with).toEqual(["Claude Code"]);
    expect(refreshed.models_used).toEqual([]);
    expect(done).toEqual({ madeWith: ["Claude Code"], excluded: ["Sonnet 5.5"] });
  });

  it("setMadeWithEntry adds a tool typed by hand to made_with only", async () => {
    build(["Claude Code"]);
    const done = await setMadeWithEntry(BUILD_ID, "Midjourney", true);
    expect(patch()).toEqual({ made_with: ["Claude Code", "Midjourney"] });
    expect(done).toEqual({ madeWith: ["Claude Code", "Midjourney"], excluded: [] });
    expect(listBuildSessions).not.toHaveBeenCalled();
  });

  it("setMadeWithEntry saves a name the tool list knows as the tool's name", async () => {
    build(["Claude Code"]);
    const done = await setMadeWithEntry(BUILD_ID, "lovable.dev", true);
    expect(patch()).toEqual({ made_with: ["Claude Code", "Lovable"] });
    expect(done.madeWith).toEqual(["Claude Code", "Lovable"]);
  });

  it("setMadeWithEntry still takes out an entry saved under the old spelling", async () => {
    build(["lovable.dev", "Cursor"]);
    const done = await setMadeWithEntry(BUILD_ID, "lovable.dev", false);
    expect(patch()).toEqual({ made_with: ["Cursor"] });
    expect(done.madeWith).toEqual(["Cursor"]);
  });

  it("addMadeWithTools writes once, only the names that were missing", async () => {
    build(["Claude Code"], { excluded_models: ["Opus 5.5"] });
    const done = await addMadeWithTools(BUILD_ID, ["claude code", "Base44", "base44"]);
    expect(updateBuild).toHaveBeenCalledTimes(1);
    expect(patch()).toEqual({ made_with: ["Claude Code", "Base44"] });
    expect(done).toEqual({ madeWith: ["Claude Code", "Base44"], excluded: ["Opus 5.5"] });
  });

  it("addMadeWithTools does not write when nothing is missing", async () => {
    build(["Claude Code", "Base44"]);
    const done = await addMadeWithTools(BUILD_ID, ["BASE44"]);
    expect(updateBuild).not.toHaveBeenCalled();
    expect(done.madeWith).toEqual(["Claude Code", "Base44"]);
  });

  it("names the tool a client adds, and none for web or unknown", () => {
    expect(toolLabel("claude-code")).toBe("Claude Code");
    expect(toolLabel("web")).toBeNull();
    expect(toolLabel(null)).toBeNull();
  });
});

describe("withTools", () => {
  it("appends the names that are missing, in the order given", () => {
    expect(withTools(["Claude Code"], ["Lovable", "Base44"])).toEqual(["Claude Code", "Lovable", "Base44"]);
  });

  it("ignores case and keeps the entry already there", () => {
    expect(withTools(["Claude Code", "Lovable"], ["lovable", "CLAUDE CODE", "Bolt"])).toEqual(["Claude Code", "Lovable", "Bolt"]);
  });

  it("adds a name once, and never an empty one", () => {
    expect(withTools([], ["Bolt", "bolt", "  ", ""])).toEqual(["Bolt"]);
  });

  it("returns the same list when nothing is missing", () => {
    const list = ["Claude Code", "Lovable"];
    expect(withTools(list, ["lovable"])).toBe(list);
    expect(withTools(list, [])).toBe(list);
  });
});

describe("setSessionTool (TF-13)", () => {
  const making = { sessions: [{ id: "s9", client: "unknown" }], excluded_models: ["X"], session_tools: { other: "cursor" } };

  it("writes only session_tools, keeps the rest of making, and adds the tool to Made with", async () => {
    listBuildSessions.mockResolvedValue([session({ id: "s9", client: "unknown" })]);
    build(["Claude"], making);
    await setSessionTool(BUILD_ID, "s9", "perplexity");
    expect(updateBuild).toHaveBeenCalledTimes(2);
    expect(updateBuild.mock.calls[0][1]).toEqual({ making: { ...making, session_tools: { other: "cursor", s9: "perplexity" } } });
    expect(updateBuild.mock.calls[1][1]).toEqual({ made_with: ["Claude", "Perplexity"] });
  });

  it("takes a chosen tool back with null and leaves Made with alone", async () => {
    listBuildSessions.mockResolvedValue([session({ id: "s9", client: "unknown" })]);
    build(["Perplexity"], { ...making, session_tools: { s9: "perplexity" } });
    await setSessionTool(BUILD_ID, "s9", null);
    expect(updateBuild).toHaveBeenCalledTimes(1);
    expect(patch()).toEqual({ making: { ...making, session_tools: {} } });
  });

  it("refuses a session that is not in this build, and writes nothing", async () => {
    listBuildSessions.mockResolvedValue([session({ id: "someone-else" })]);
    build([], making);
    await expect(setSessionTool(BUILD_ID, "s9", "perplexity")).rejects.toThrow("That session is not in this build.");
    expect(updateBuild).not.toHaveBeenCalled();
  });

  it("is kept by refreshMakingStats", async () => {
    listBuildSessions.mockResolvedValue([session({ id: "s9", client: "unknown" })]);
    build([], { ...making, session_tools: { s9: "perplexity" } });
    await refreshMakingStats(BUILD_ID);
    expect((patch().making as { session_tools: unknown }).session_tools).toEqual({ s9: "perplexity" });
  });
});

describe("sessions made in the composer (CA-04 P1)", () => {
  it("writes one session's tool and day into making.sessions_meta, keeping everything else", async () => {
    const { setSessionMeta } = await import("./making");
    build(["Claude"], { sessions: [], excluded_models: ["X"], session_tools: { s1: "perplexity" }, sessions_meta: { "typed-a": { tool: "claude", date: "2026-10-01" } } });
    await setSessionMeta(BUILD_ID, "typed-b", { tool: "Claude Code", date: "2026-10-20" });
    const making = patch().making as Record<string, unknown>;
    expect(making.excluded_models).toEqual(["X"]);
    expect(making.session_tools).toEqual({ s1: "perplexity" });
    expect(making.sessions_meta).toEqual({ "typed-a": { tool: "claude", date: "2026-10-01" }, "typed-b": { tool: "claude-code", date: "2026-10-20" } });
  });

  it("refuses a key that is only ever read (typed-legacy) and a day that is not one, before reading anything", async () => {
    const { setSessionMeta } = await import("./making");
    await expect(setSessionMeta(BUILD_ID, "typed-legacy-1", { tool: null, date: "2026-10-20" })).rejects.toThrow(/not saved yet/);
    await expect(setSessionMeta(BUILD_ID, "typed-b", { tool: null, date: "20 Oct" })).rejects.toThrow(/2026-10-12/);
    expect(updateBuild).not.toHaveBeenCalled();
    expect(fromBuilds).not.toHaveBeenCalled();
  });

  it("reads sessions_meta defensively: a session made here without a day is skipped, unknown keys are dropped", async () => {
    const { sessionsMetaOf } = await import("./making");
    expect(
      sessionsMetaOf({
        sessions_meta: {
          "typed-a": { tool: " claude ", date: "2026-10-01", secret: "x" },
          "typed-b": { tool: "claude" },
          imp1: { goal: { condition: "tests pass" } },
          bad: "nope",
        },
      }),
    ).toEqual({ "typed-a": { tool: "claude", date: "2026-10-01" }, imp1: { tool: null, date: "", goal: { condition: "tests pass" } } });
    expect(sessionsMetaOf(null)).toEqual({});
  });

  it("makes keys that read as sessions made here, and never as an old build's", async () => {
    const { isLegacySession, isTypedSession, newSessionKey } = await import("./making");
    const key = newSessionKey();
    expect(key).toMatch(/^typed-/);
    expect(isTypedSession(key)).toBe(true);
    expect(isLegacySession(key)).toBe(false);
    expect(isTypedSession("typed-legacy-2")).toBe(false);
  });
});
