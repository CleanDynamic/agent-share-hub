// SV-27 Part 9: setup, running and an API estimate never share a line or a total; a deployment tile's running cost shows per its
// own unit; Compare keeps To set up and API estimate apart; money is hidden without showCost; a fork drops measured speed.

import { describe, expect, it } from "vitest";

import { selfHostedTree } from "@/dev/fixtures/deployment/self-hosted";

import { totalsRows, differences, type SideTotals } from "./compare";
import { apiEstimateLine, apiEstimateOf, deploymentRunLines, measuredLine, measuredOf, setupCostsOf, setupLine } from "./deploymentCost";
import { methodOf } from "./forkRules";
import { cleanExtras } from "./tileExtras";
import type { NodeTree } from "./types";

const withRunCost = (tree: NodeTree[]): NodeTree[] => tree.map((node) => (node.id === "sh-h1" ? ({ ...node, payload: { ...(node.payload as object), run_cost: { per: "day", cost: 0.4, currency: "GBP", source: "maker" } } } as NodeTree) : node));

describe("costs kept apart", () => {
  it("says setup on its own line, the maker's, never with run or build", () => {
    const costs = setupCostsOf(selfHostedTree);
    expect(costs).toEqual([{ id: "sh-h1", name: "Workstation", amount: 4200 }]);
    const line = setupLine(costs, "GBP", true);
    expect(line).toBe("To set up: £4200.00 · Workstation (maker's figure)");
    expect(line).not.toMatch(/run|build/i);
  });

  it("shows a deployment tile's running cost per its own unit", () => {
    expect(deploymentRunLines(withRunCost(selfHostedTree), true)).toEqual(["Workstation · Per day: £0.40 (maker's figure)"]);
  });

  it("says the API estimate as the maker's, on its own line", () => {
    const estimate = apiEstimateOf({ amount: 20, per: "month" });
    expect(apiEstimateLine(estimate, "GBP", true)).toBe("Through a hosted API instead: about £20.00 a month (maker's estimate)");
    expect(cleanExtras("team", { api_estimate: { amount: 20, per: "month" } })).toEqual({ api_estimate: { amount: 20, per: "month" } });
    expect(() => cleanExtras("agent_config", { api_estimate: { amount: -1, per: "month" } })).toThrow("API estimate");
  });

  it("hides money without showCost", () => {
    expect(setupLine(setupCostsOf(selfHostedTree), "GBP", false)).toBeNull();
    expect(apiEstimateLine({ amount: 20, per: "month" }, "GBP", false)).toBeNull();
    expect(deploymentRunLines(withRunCost(selfHostedTree), false)).toEqual([]);
  });
});

describe("Compare", () => {
  const side = (over: Partial<SideTotals>): SideTotals => ({ build: null, run: null, steps: 3, models: [], patterns: [], money: true, setup: null, estimate: null, currency: "GBP", ...over });

  it("shows To set up and API estimate in their own rows, with a plain difference", () => {
    const a = side({ setup: 4200, estimate: "about £20.00 a month" });
    const b = side({ setup: 200 });
    const rows = totalsRows(a, b);
    expect(rows.find((row) => row.label === "To set up")).toEqual({ label: "To set up", a: "£4200.00", b: "£200.00" });
    expect(rows.find((row) => row.label === "API estimate")).toEqual({ label: "API estimate", a: "about £20.00 a month", b: "–" });
    expect(rows.find((row) => row.label === "To run")?.a).toBe("–");
    expect(differences(a, b)).toContain("about £4000.00 more to set up");
    expect(totalsRows(side({ setup: 4200, money: false }), b).find((row) => row.label === "To set up")?.a).toBe("–");
  });
});

describe("measured speed is evidence", () => {
  it("reads as the maker's or from the run, and a fork drops it", () => {
    expect(measuredLine(measuredOf({ tokens_per_second: 92, time_to_first_token_ms: 240 }))).toBe("92 tokens a second · 240 ms to the first token · Maker's figure");
    expect(measuredLine(measuredOf({ tokens_per_second: 92, source: "run" }))).toBe("92 tokens a second · From the run");
    expect(methodOf({ summary: "x", measured: { tokens_per_second: 92 } })).toEqual({ summary: "x" });
  });
});
