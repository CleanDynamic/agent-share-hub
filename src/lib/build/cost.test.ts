import { describe, expect, it } from "vitest";

import { buildCostOf, buildLine, buildTotals, buildTotalsLine, costRefusal, duration, money, originalBuildLine, originalRunLine, partOfBuildCost, partOfSession, runCostOf, runLine, runTotals, runTotalsLines, tokensWords, type RunCost, type RunTile } from "./cost";

describe("figures and wording (CA-13 P8)", () => {
  it("says time, tokens and money as the page does", () => {
    expect(duration(120)).toBe("120 ms");
    expect(duration(1200)).toBe("1.2 s");
    expect(duration(4 * 3_600_000 + 12 * 60_000)).toBe("4 h 12 min");
    expect(tokensWords(3400)).toBe("3,400 tokens");
    expect(tokensWords(1_200_000)).toBe("1.2M tokens");
    expect(money(8.4)).toBe("£8.40");
    expect(money(0.0001)).toBe("£0.0001");
    expect(money(0.003, "USD")).toBe("$0.003");
  });

  it("reads build_cost and run_cost defensively, and run_cost needs its per", () => {
    expect(buildCostOf({ ms: 1200, tokensIn: 3000, tokensOut: 400, cost: 0.01, currency: "GBP", source: "run" })).toEqual({ ms: 1200, tokensIn: 3000, tokensOut: 400, cost: 0.01, currency: "GBP", source: "run" });
    expect(buildCostOf({ ms: -1 })).toBeNull();
    expect(buildCostOf("x")).toBeNull();
    expect(runCostOf({ ms: 120, cost: 0.0001 })).toBeNull();
    expect(runCostOf({ per: "call", ms: 120, cost: 0.0001 })).toMatchObject({ per: "call", ms: 120, cost: 0.0001, source: "maker" });
    expect(costRefusal({ cost: -3 })).toMatch(/Cost: 0 to/);
    expect(costRefusal({ ms: 1.5 })).toMatch(/milliseconds/);
    expect(costRefusal({ ms: 100, tokensIn: 5, cost: 2 })).toBeNull();
  });

  it("writes a tile's one quiet line, and nothing when there is no figure", () => {
    expect(buildLine({ ms: 1200, tokensIn: 3000, tokensOut: 400, cost: 0.01, currency: "GBP", source: "maker" })).toBe("Made in 1.2 s · 3,400 tokens · £0.01");
    expect(runLine({ per: "call", ms: 120, cost: 0.0001, currency: "GBP", source: "maker" })).toBe("Each call: 120 ms · £0.0001");
    expect(runLine({ per: "hour", cost: 7, currency: "GBP", source: "maker" })).toBe("Per hour: £7.00");
    expect(buildLine(null)).toBeNull();
  });

  it("hides money from readers unless the maker shows costs, and keeps time and tokens", () => {
    const figures = { ms: 1200, tokensIn: 3400, cost: 0.01, currency: "GBP" as const, source: "maker" as const };
    expect(buildLine(figures, false)).toBe("Made in 1.2 s · 3,400 tokens");
    expect(runLine({ per: "call", cost: 0.5, source: "maker" }, false)).toBeNull();
    expect(originalBuildLine(figures, false)).toBe("The original took 1.2 s · 3,400 tokens to make");
    expect(originalRunLine({ per: "call", ms: 120, cost: 0.0001, currency: "GBP", source: "maker" }, true)).toBe("Each call took the original 120 ms · £0.0001");
  });
});

describe("to build (never to run)", () => {
  it("sums the sessions and tiles that have figures and says how many it counted, so it is never overstated", () => {
    const parts = [
      partOfSession({ ms: 3 * 3_600_000, tokens: 1_000_000, cost: 6, currency: "GBP" }),
      partOfSession({ ms: 72 * 60_000, tokens: 100_000, cost: 2.4, currency: "GBP" }),
      partOfBuildCost({ tokensIn: 50_000, tokensOut: 50_000, source: "maker" }),
      {},
      {},
    ];
    const totals = buildTotals(parts);
    expect(totals).toMatchObject({ ms: 3 * 3_600_000 + 72 * 60_000, tokens: 1_200_000, counted: 3, of: 5 });
    expect(buildTotalsLine(totals)).toBe("To build: 4 h 12 min · 1.2M tokens · £8.40 · from 3 of 5 steps");
    expect(buildTotalsLine(buildTotals([partOfSession({ tokens: 5 })]))).toBe("To build: 5 tokens");
    expect(buildTotals([{}, {}])).toBeNull();
  });

  it("keeps two currencies apart and hides money from readers", () => {
    const totals = buildTotals([partOfSession({ cost: 5, currency: "GBP" }), partOfSession({ cost: 2, currency: "USD" })]);
    expect(buildTotalsLine(totals)).toBe("To build: £5.00 and $2.00");
    expect(buildTotalsLine(totals, false)).toBeNull();
  });

  it("never reads a run cost: a build with only run figures has no 'to build'", () => {
    expect(buildTotals([partOfBuildCost(buildCostOf({ per: "call", ms: 120 }))])).toMatchObject({ ms: 120 });
    expect(buildTotals([])).toBeNull();
  });
});

describe("to run (summed only across matching units)", () => {
  const call = (cost: number, ms: number): RunCost => ({ per: "call", cost, ms, currency: "GBP", source: "maker" });
  const tile = (id: string, run: RunCost | null, mainPath = true): RunTile => ({ id, name: id, run, mainPath });

  it("sums per-call figures when every tile on the main path is per call, and says how many it counted", () => {
    const totals = runTotals([tile("decision", call(0.0001, 120)), tile("agent", call(0.0029, 280)), tile("code", null)]);
    expect(totals).toMatchObject({ kind: "sum", ms: 400, counted: 2, of: 3 });
    expect(runTotalsLines(totals)).toEqual(["To run: about £0.003 a call · 400 ms · from 2 of 3 steps"]);
    expect(runTotalsLines(totals, false)).toEqual(["To run: 400 ms · from 2 of 3 steps"]);
  });

  it("lists each tile's own figure and adds nothing across different units", () => {
    const totals = runTotals([tile("decision", call(0.0001, 120)), tile("agent", { per: "hour", cost: 7, currency: "GBP", source: "maker" })]);
    expect(totals?.kind).toBe("list");
    expect(runTotalsLines(totals)).toEqual(["decision · Each call: 120 ms · £0.0001", "agent · Per hour: £7.00"]);
  });

  it("does not count a branch tile in the sum, and has nothing when there is no figure", () => {
    const totals = runTotals([tile("decision", call(0.0001, 120)), tile("billing", call(0.5, 900), false)]);
    expect(totals).toMatchObject({ kind: "sum", ms: 120, counted: 1, of: 1 });
    expect(runTotals([tile("a", null)])).toBeNull();
  });

  it("is never added to the build's total", () => {
    const build = buildTotals([partOfSession({ cost: 8.4, tokens: 1000 })]);
    const run = runTotals([tile("d", call(0.0001, 120))]);
    expect(buildTotalsLine(build)).not.toContain("0.0001");
    expect(runTotalsLines(run).join(" ")).not.toContain("8.40");
  });
});
