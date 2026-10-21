import { describe, expect, it } from "vitest";

import { costLines, runTilesOf, showsCost, tileCostLines } from "./costView";
import type { SessionGroup, Step } from "./graph";

const step = (id: string, kind: Step["kind"], extra: Partial<Step> = {}): Step =>
  ({ id, kind, number: id, title: null, defaultTitle: id, text: "", words: 0, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...extra }) as Step;
const group = (extras: SessionGroup["extras"]): SessionGroup => ({ sessionId: "s", number: 1, tool: "Claude Code", model: null, startedAt: "2026-10-01T10:00:00", stepNumbers: ["1"], extras });

describe("cost lines (CA-13 P8)", () => {
  const steps = [
    step("1", "prompt", { buildCost: { ms: 1200, tokensIn: 3000, tokensOut: 400, cost: 0.01, currency: "GBP", source: "maker" } }),
    step("2", "decision", { runCost: { per: "call", ms: 120, cost: 0.0001, currency: "GBP", source: "maker" } }),
    step("3", "agent", { runCost: { per: "call", ms: 280, cost: 0.0029, currency: "GBP", source: "run" }, helpers: [{ provider: "scaledown", job: "compress", did: { before: 400_000, after: 90_000, unit: "tokens", source: "maker" } }] }),
    step("4", "prompt"),
  ];
  const sessions = [group({ ms: 3 * 3_600_000 + 12 * 60_000, tokens: 1_000_000, cost: 8.39, currency: "GBP", showCost: true })];

  it("keeps to-build and to-run apart, each saying how many parts it counted", () => {
    const lines = costLines(steps, sessions, "maker");
    expect(lines.build).toBe("To build: 3 h 12 min · 1M tokens · £8.40 · from 2 of 5 steps");
    expect(lines.run).toEqual(["To run: about £0.003 a call · 400 ms"]);
    expect(lines.savings).toBe("Helpers cut about 310k tokens a run");
  });

  it("shows readers money only when the maker ticked Show readers, and time and tokens always", () => {
    const hidden = costLines(steps, [group({ ...sessions[0].extras, showCost: undefined })], "reader");
    expect(hidden.build).toBe("To build: 3 h 12 min · 1M tokens · from 2 of 5 steps");
    expect(hidden.run).toEqual(["To run: 400 ms"]);
    expect(costLines(steps, sessions, "reader").build).toContain("£8.40");
    expect(showsCost(sessions)).toBe(true);
  });

  it("lists each runtime tile when their units differ, and puts a branch tile off the main path", () => {
    const mixed = [steps[1], step("5", "agent", { runCost: { per: "hour", cost: 7, currency: "GBP", source: "maker" } })];
    expect(costLines(mixed, [], "maker").run).toEqual(["2 · 2 · Each call: 120 ms · £0.0001", "5 · 5 · Per hour: £7.00"]);
    const branch = step("6", "agent", { runsWhen: { decision: "2", question: "team", is: ["billing"] } });
    expect(runTilesOf([steps[1], branch]).map((tile) => tile.mainPath)).toEqual([true, false]);
  });

  it("says nothing when no figure was given, so a build with none looks exactly as before", () => {
    expect(costLines([step("1", "prompt")], [group({})], "maker")).toEqual({ build: null, run: [], savings: null });
    expect(tileCostLines(step("1", "prompt"), "maker", [])).toEqual({ build: null, run: null });
  });

  it("gives a tile its own line", () => {
    expect(tileCostLines(steps[0], "maker", [])).toEqual({ build: "Made in 1.2 s · 3,400 tokens · £0.01", run: null });
    expect(tileCostLines(steps[1], "maker", [])).toEqual({ build: null, run: "Each call: 120 ms · £0.0001" });
  });
});
