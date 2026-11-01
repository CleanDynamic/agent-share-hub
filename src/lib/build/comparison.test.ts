// SV-29 P3: a Check that compares approaches.

import { describe, expect, it } from "vitest";

import { buildSteps } from "./graph";
import { blankRows, chartPoints, comparisonOf, comparisonPatchRefusal, defaultMetric, designLine, metricChoices, metricName, rowsOf, rowsRefusal, sortedRows, testSetLine, testedKindOf, type ComparisonRow } from "./comparison";
import { methodOf } from "./forkRules";
import { SCORING_LABEL, cleanExtras } from "./tileExtras";

const node = (id: string, position: number, type: string, payload: Record<string, unknown>) => ({ id, build_id: "b", parent_id: null, position, type, title: null, note: null, payload, source_ref: null, is_gap: false, event_id: null, created_at: "" });

const row = (label: string, value: number, patch: Partial<ComparisonRow> = {}): ComparisonRow => ({ kind: "approach", label, tiles: [], value: { value, source: "run" }, ...patch });

const rows: ComparisonRow[] = [
  row("Retrieval, then Gemma picks", 0.819, { outcome: "rejected", reason: "Lower than the decision model", costPerItem: { cost: 0.0005, currency: "USD", source: "maker" } }),
  row("Beam search", 0.923, { outcome: "rejected", reason: "Correct root scored 0.03 against 0.44; the path was pruned at depth 0", costPerItem: { cost: 0.0025, currency: "USD", source: "maker" } }),
  row("Retrieval, then the decision model picks", 0.972, { outcome: "chosen", costPerItem: { cost: 0.0005, currency: "USD", source: "maker" } }),
  row("Exhaustive", 0.98, { outcome: "rejected", reason: "Over 2,000 times the cost", costPerItem: { cost: 1.08, currency: "USD", source: "maker" } }),
];

describe("the metric defaults from the question type", () => {
  it("follows the tested tile", () => {
    const decision = (type: string) => ({ kind: "decision", decision: { questions: [{ type }] } }) as never;
    expect(defaultMetric(testedKindOf(decision("choice"))).id).toBe("accuracy");
    expect(defaultMetric(testedKindOf(decision("multi"))).id).toBe("micro_f1");
    expect(defaultMetric(testedKindOf(decision("rank"))).id).toBe("ndcg_at_k");
    expect(defaultMetric(testedKindOf(decision("score"))).id).toBe("weighted_kappa");
    expect(defaultMetric(testedKindOf(decision("extract"))).id).toBe("exact_match");
    expect(defaultMetric(testedKindOf({ kind: "retrieval" })).id).toBe("recall_at_k");
    expect(defaultMetric(testedKindOf({ kind: "prompt" })).id).toBe("pass_rate");
    expect(metricChoices("rank")).toEqual(["ndcg_at_k", "mrr", "recall_at_k"]);
    expect(metricChoices("other")).toEqual(["pass_rate", "custom"]);
  });
  it("a custom metric needs a name and a unit", () => {
    expect(() => cleanExtras("eval_run", { metric: { id: "custom", name: "Tone" } })).toThrow();
    expect(metricName({ id: "custom", name: "Tone", unit: "points" })).toBe("Tone (points)");
  });
});

describe("rows", () => {
  it("a rejected row without a reason is refused, and so is a ruled-out one", () => {
    expect(rowsRefusal([row("A", 0.5, { outcome: "rejected" }), row("B", 0.6)])).toMatch(/say why/);
    expect(rowsRefusal([row("A", 0.5, { kind: "hypothesis", outcome: "ruled out" }), row("B", 0.6)])).toMatch(/say why/);
    expect(rowsRefusal([row("A", 0.5, { kind: "hypothesis", outcome: "ruled out", reason: "Tested" }), row("B", 0.6)])).toBeNull();
  });
  it("two chosen rows are refused", () => {
    expect(rowsRefusal([row("A", 0.5, { outcome: "chosen" }), row("B", 0.6, { outcome: "chosen" })])).toMatch(/Only one row/);
    expect(() => cleanExtras("eval_run", { rows: [row("A", 0.5, { outcome: "chosen" }), row("B", 0.6, { outcome: "chosen" })] })).toThrow(/Only one/);
  });
  it("holds 2 to 12 rows and an outcome that fits its kind", () => {
    expect(rowsRefusal([row("A", 1)])).toMatch(/2 to 12/);
    expect(rowsRefusal(Array.from({ length: 13 }, (_, i) => row(`r${i}`, 0.5)))).toMatch(/2 to 12/);
    expect(rowsRefusal([row("A", 1, { kind: "hypothesis", outcome: "chosen" }), row("B", 1)])).toMatch(/hypothesis/);
  });
  it("sorts by the metric with the chosen row first", () => {
    const order = sortedRows(rows, { id: "accuracy" }).map((r) => r.label);
    expect(order).toEqual(["Retrieval, then the decision model picks", "Exhaustive", "Beam search", "Retrieval, then Gemma picks"]);
  });
  it("sorts a lower-is-better metric ascending", () => {
    expect(sortedRows([row("A", 0.4), row("B", 0.1)], { id: "mae" }).map((r) => r.label)).toEqual(["B", "A"]);
  });
  it("charts accuracy against cost for the rows that have both", () => {
    expect(chartPoints(rows)).toHaveLength(4);
    expect(chartPoints([row("A", 0.5), row("B", 0.6)])).toHaveLength(0);
  });
  it("an existing ab Check with no rows opens with two empty rows", () => {
    expect(blankRows()).toHaveLength(2);
  });
});

describe("the controlled experiment", () => {
  it("is held to the rows: its control is one of them", () => {
    const payload = { scoring: { how: "ab" }, rows: [row("No AGENTS.md", 0.4), row("AGENTS.md present", 0.6)] };
    const design = { control: "No AGENTS.md", varied: "AGENTS.md present", runs_per_arm: 10, fresh_context: true };
    expect(comparisonPatchRefusal(payload, { design })).toBeNull();
    expect(comparisonPatchRefusal(payload, { design: { ...design, control: "Nope" } })).toMatch(/control/);
    expect(designLine({ control: "No AGENTS.md", varied: "AGENTS.md present", runsPerArm: 10, freshContext: true })).toBe("Control: No AGENTS.md. Varied: AGENTS.md present. 10 runs per arm, each in a fresh context.");
    expect(() => cleanExtras("eval_run", { design: { ...design, runs_per_arm: 101 } })).toThrow();
  });
  it("rows need a comparison of approaches", () => {
    expect(comparisonPatchRefusal({ scoring: { how: "pass_fail" } }, { rows: [row("A", 1), row("B", 1)] })).toMatch(/comparison of approaches/);
  });
});

describe("the test set", () => {
  it("saves and reads, and reads as a line", () => {
    const cleaned = cleanExtras("eval_run", { test_set: { size: 1000, labelled_by: "annotators", labelled_at: "2026-10" } });
    const facts = comparisonOf({ test_set: cleaned.test_set });
    expect(testSetLine(facts.testSet!)).toBe("1,000 test items, labelled by annotators in Oct 2026");
    expect(() => cleanExtras("eval_run", { test_set: { size: 1000, labelled_by: "annotators", labelled_at: "Oct" } })).toThrow();
  });
});

describe("old checks and screen words", () => {
  it("an old ab Check reads as before, and the stored value stays ab", () => {
    const [step] = buildSteps([node("c", 0, "eval_run", { tested: "x", passing: "y", scoring: { how: "ab" } })] as never[]);
    expect(step.check?.scoring?.how).toBe("ab");
    expect(step.check?.comparison).toBeUndefined();
    expect(SCORING_LABEL.ab).toBe("Comparison of approaches");
  });
  it("reads the rows into the Check's facts", () => {
    const [step] = buildSteps([node("c", 0, "eval_run", { tested: "x", passing: "y", scoring: { how: "ab" }, rows: cleanExtras("eval_run", { rows }).rows })] as never[]);
    expect(step.check?.comparison?.rows).toHaveLength(4);
    expect(rowsOf(step.check?.comparison?.rows)).toHaveLength(4);
  });
});

describe("a fork", () => {
  it("keeps the rows and labels them as the original's", () => {
    const payload = { tested: "x", passing: "y", scoring: { how: "ab" }, rows: cleanExtras("eval_run", { rows }).rows, test_set: { size: 1000, labelled_by: "maker" } };
    const kept = methodOf(payload) as typeof payload;
    const [step] = buildSteps([node("c", 0, "eval_run", kept)] as never[]);
    expect(step.check?.fromOriginal).toBe(true);
    expect(step.check?.comparison?.rows.every((r) => r.value?.source === "original")).toBe(true);
    expect(step.check?.comparison?.rows.every((r) => !r.costPerItem || r.costPerItem.source === "original")).toBe(true);
  });
});
