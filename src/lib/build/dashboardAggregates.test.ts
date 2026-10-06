import { describe, expect, it } from "vitest";

import { makerRows, modelRows } from "@/lib/build/dashboardAggregates";
import type { DashboardRow } from "@/lib/build/gallery";

function row(
  id: string,
  creator: string,
  extra: Partial<DashboardRow> & { sessions?: DashboardRow["making"]["sessions"]; total?: number } = {}
): DashboardRow {
  const { sessions = [], total = 0, ...rest } = extra;
  return {
    id,
    slug: id,
    title: `Build ${id}`,
    creator: { id: creator, handle: creator },
    outcome: null,
    madeFor: [],
    modelsUsed: [],
    sessionCount: sessions.length,
    promptCount: sessions.reduce((n, s) => n + s.prompts, 0),
    aiTurnCount: sessions.reduce((n, s) => n + s.turns, 0),
    making: { sessions },
    reproduction_count: 0,
    last_confirmed_at: null,
    last_confirmed_model: null,
    published_at: "2026-09-01T00:00:00Z",
    status: "gallery",
    shape: "app",
    completeness: 90,
    engagement: { runs: total, rebuilds: 0, comments: 0, saves: 0, total },
    lastActivity: { at: "2026-09-01T00:00:00Z", what: "Published" },
    series: new Array(14).fill(0),
    proof: [],
    ...rest,
  };
}

const session = (model: string | null, prompts: number, turns: number) => ({ client: "claude", model, prompts, turns });

const fixture: DashboardRow[] = [
  row("a", "ada", {
    sessions: [session("claude-sonnet-5-5", 10, 20), session("Sonnet 5.5", 5, 8), session("Opus 5.5", 3, 4)],
    modelsUsed: ["Sonnet 5.5", "Opus 5.5"],
    total: 10,
    published_at: "2026-09-10T00:00:00Z",
  }),
  row("b", "ada", {
    sessions: [session("sonnet-5.5", 2, 2), session("my-local-llama", 1, 1), session(null, 4, 4)],
    modelsUsed: ["claude-sonnet-5-5", "my-local-llama"],
    total: 5,
    published_at: "2026-09-20T00:00:00Z",
  }),
  row("c", "bo", {
    sessions: [session("Opus 5.5", 7, 9)],
    modelsUsed: ["Opus 5.5"],
    total: 1,
    published_at: null,
  }),
];

describe("modelRows", () => {
  const rows = modelRows(fixture);
  const by = (name: string) => rows.find((r) => r.modelName === name)!;

  it("merges spellings of a version and counts each build once", () => {
    expect(by("Sonnet 5.5")).toMatchObject({
      modelId: "sonnet-5-5",
      lab: "Anthropic",
      builds: 2,
      sessions: 3,
      prompts: 17,
      turns: 30,
      engagement: { runs: 15, rebuilds: 0, comments: 0, saves: 0, total: 15 },
      lastUsed: { at: "2026-09-20T00:00:00Z", buildTitle: "Build b" },
    });
  });

  it("sums engagement over the builds that used a model, not its sessions", () => {
    expect(by("Opus 5.5")).toMatchObject({ builds: 2, sessions: 2, engagement: { total: 11 } });
    // build c has no published_at, so only build a dates it
    expect(by("Opus 5.5").lastUsed).toEqual({ at: "2026-09-10T00:00:00Z", buildTitle: "Build a" });
  });

  it("keeps an unlisted model under its text and no model under Unknown model", () => {
    expect(by("my-local-llama")).toMatchObject({ modelId: null, lab: null, builds: 1 });
    expect(by("Unknown model")).toMatchObject({ modelId: null, prompts: 4 });
  });

  it("lists the most used first and gives a version nobody used no row", () => {
    expect(rows.map((r) => r.modelName)).toEqual(["Opus 5.5", "Sonnet 5.5", "my-local-llama", "Unknown model"]);
    expect(rows.some((r) => r.modelName === "GPT-6 Luna")).toBe(false);
  });

  it("is empty for no rows", () => {
    expect(modelRows([])).toEqual([]);
  });
});

describe("makerRows", () => {
  const rows = makerRows(fixture);

  it("sums a creator's builds", () => {
    expect(rows[0]).toMatchObject({
      creator: { id: "ada", handle: "ada" },
      builds: 2,
      sessions: 6,
      prompts: 25,
      turns: 39,
      engagement: { total: 15 },
      lastPublishedAt: "2026-09-20T00:00:00Z",
    });
  });

  it("lists distinct models by name, spellings merged", () => {
    expect(rows[0].models).toEqual(["my-local-llama", "Opus 5.5", "Sonnet 5.5"]);
  });

  it("has a null lastPublishedAt for a creator with nothing dated, and orders by builds", () => {
    expect(rows.map((r) => r.creator.id)).toEqual(["ada", "bo"]);
    expect(rows[1].lastPublishedAt).toBeNull();
  });
});
