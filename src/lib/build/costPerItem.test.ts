// SV-29 P5: costs per item.

import { describe, expect, it } from "vitest";

import { dailyLine, runCostOf, runLine, runTotals, volumeOf } from "./cost";
import { tileCostLines } from "./costView";
import { buildSteps } from "./graph";
import { modelRunOf } from "./modelRun";

const node = (id: string, position: number, type: string, payload: Record<string, unknown>) => ({ id, build_id: "b", parent_id: null, position, type, title: null, note: null, payload, source_ref: null, is_gap: false, event_id: null, created_at: "" });
const perItem = { per: "item", item_noun: "product", cost: 0.0005, currency: "USD", pricing: "batch", source: "maker" };

describe("cost per item", () => {
  it("shows with its noun and, for batch, its pricing basis", () => {
    expect(runLine(runCostOf(perItem), true)).toBe("about $0.0005 per product (batch pricing)");
    expect(runLine(runCostOf({ ...perItem, pricing: "standard" }), true)).toBe("about $0.0005 per product");
  });
  it("hides the money from a reader unless the maker ticked Show readers", () => {
    expect(runLine(runCostOf({ ...perItem, ms: 120 }), false)).toBe("120 ms");
    expect(runLine(runCostOf(perItem), false)).toBeNull();
  });
  it("shows a per-day line only with a volume, and only with money", () => {
    const run = runCostOf(perItem);
    expect(dailyLine(run, null, true)).toBeNull();
    expect(dailyLine(run, { count: 10_000_000, per: "day" }, false)).toBeNull();
    expect(dailyLine(run, { count: 10_000_000, per: "day" }, true)).toBe("About $5,000 a day at 10,000,000 items · worked out from the cost per item");
    expect(dailyLine(runCostOf({ per: "call", cost: 1, source: "maker" }), { count: 5, per: "day" }, true)).toBeNull();
  });
  it("reads through the steps and the tile's cost lines", () => {
    const [step] = buildSteps([node("d", 0, "decision", { provider: "gemma", model: "g", questions: [{ id: "q", type: "yesno", instructions: "" }], run_cost: perItem, volume: { count: 10_000_000, per: "day" } })] as never[]);
    expect(step.volume).toEqual({ count: 10_000_000, per: "day" });
    const lines = tileCostLines(step, "maker", []);
    expect(lines.run).toBe("about $0.0005 per product (batch pricing)");
    expect(lines.daily).toMatch(/^About \$5,000 a day/);
    expect(tileCostLines(step, "reader", []).daily).toBeUndefined();
  });
  it("never sums across units", () => {
    const tiles = [
      { id: "a", name: "A", run: runCostOf(perItem), mainPath: true },
      { id: "b", name: "B", run: runCostOf({ per: "call", cost: 0.001, currency: "USD", source: "maker" }), mainPath: true },
    ];
    expect(runTotals(tiles)?.kind).toBe("list");
    expect(volumeOf({ count: 0, per: "day" })).toBeNull();
  });
});

describe("batch inference", () => {
  it("saves on the model run", () => {
    expect(modelRunOf({ precision: "full", batch: true })).toEqual({ precision: "full", batch: true });
    expect(modelRunOf({ batch: false })).toBeNull();
  });
});
