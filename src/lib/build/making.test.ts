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

import { nextMadeWith, refreshMakingStats, setMadeWithEntry, setMadeWithModel, toolLabel } from "./making";

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

  it("names the tool a client adds, and none for web or unknown", () => {
    expect(toolLabel("claude-code")).toBe("Claude Code");
    expect(toolLabel("web")).toBeNull();
    expect(toolLabel(null)).toBeNull();
  });
});
