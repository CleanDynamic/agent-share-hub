// SV-29 P4: the eval harness on the Check.

import { describe, expect, it } from "vitest";

import { buildSteps, checkRunsOf, checkRunsRefusal, checkStatus, casesRefusal, checkCasesOf } from "./graph";
import { evalHarnessOf, exampleCaseOf, failureTypesOf, failureTypesRefusal, gateDroppedLines, gateLine, gateOf, graderInstruction, graderLine, gradersOf, needsDecisionLine, runHistoryLine, stabilityCounts, stabilityLine, validatedLine } from "./evalHarness";
import { methodOf } from "./forkRules";
import { testSetOf, testSetSourceLine } from "./comparison";
import { cleanExtras } from "./tileExtras";

const node = (id: string, position: number, type: string, payload: Record<string, unknown>) => ({ id, build_id: "b", parent_id: null, position, type, title: null, note: null, payload, source_ref: null, is_gap: false, event_id: null, created_at: "" });

const failureTypes = [
  { name: "Made-up answers", count: 6, read: 20, fix_in: "prompt" },
  { name: "Wrong policy decision", count: 5, read: 20, fix_in: "retrieval" },
  { name: "No page for damaged items", count: 1, read: 20, fix_in: "people", note: "No help-centre page covers damaged items" },
];
const graders = [
  { name: "Faithfulness", kind: "built_in", sees: [], covers: ["Made-up answers"] },
  { name: "Policy correct", kind: "llm_judge", criteria: "Does the answer apply the policy the reference states?", sees: ["question", "answer", "expected", "reference"], threshold: 0.7, covers: ["Wrong policy decision"] },
  { name: "Stays in sources", kind: "llm_judge", criteria: "Is every claim in the answer in what the app retrieved?", sees: ["answer", "retrieved", "tool_results"], threshold: 0.7, covers: ["Made-up answers"], validated: { good: 3, bad: 3, correct: true } },
];
const gate = { runs_in: "github-actions", on: "pull_request", rule: { kind: "pass_to_fail" }, runs: 3, missing_result_fails: true, minutes: { value: 8, source: "maker" }, rejected: [{ rule: "Fail on any regression, one run", why: "A correct answer failed on judge noise." }] };

describe("where the test cases came from", () => {
  it("shows as one line", () => {
    const set = testSetOf({ size: 20, labelled_by: "maker", drawn_from: "real_traffic", trace_tag: "customer", file: "harness/goldens.json" });
    expect(testSetSourceLine(set!)).toBe("20 test cases from real users' questions (tag customer), in harness/goldens.json");
  });
  it("a trace tag belongs to real traffic only", () => {
    expect(testSetOf({ size: 20, labelled_by: "maker", drawn_from: "written", trace_tag: "customer" })?.traceTag).toBeUndefined();
  });
});

describe("failure types", () => {
  it("sort by count and read as 5 of 20", () => {
    const types = failureTypesOf(failureTypes);
    expect(types.map((type) => type.name)).toEqual(["Made-up answers", "Wrong policy decision", "No page for damaged items"]);
    expect(needsDecisionLine(types[2])).toBe("Needs a decision: No help-centre page covers damaged items");
    expect(needsDecisionLine(types[0])).toBeNull();
  });
  it("a count above read is refused, and people needs a note", () => {
    expect(failureTypesRefusal(failureTypesOf([{ name: "x", count: 5, read: 4, fix_in: "prompt" }]))).toMatch(/can't be more/);
    expect(() => cleanExtras("eval_run", { failure_types: [{ name: "x", count: 5, read: 4, fix_in: "prompt" }] })).toThrow(/can't be more/);
    expect(() => cleanExtras("eval_run", { failure_types: [{ name: "x", count: 1, read: 4, fix_in: "people" }] })).toThrow(/people|decide/);
    expect(cleanExtras("eval_run", { failure_types: failureTypes }).failure_types).toHaveLength(3);
  });
});

describe("graders", () => {
  it("show what each sees", () => {
    const list = gradersOf(graders);
    expect(graderLine(list[1])).toBe("Policy correct · LLM judge · sees the question, the answer, the expected answer and the full reference · 0.7 · covers Wrong policy decision");
    expect(validatedLine(list[2].validated!)).toBe("Tested on 3 good and 3 bad cases before use");
    expect(validatedLine({ good: 3, bad: 3, correct: false })).toBe("Tested, and it judged some wrongly");
  });
  it("criteria are refused on a built_in grader", () => {
    expect(() => cleanExtras("eval_run", { graders: [{ name: "Faithfulness", kind: "built_in", criteria: "x", sees: [], covers: [] }] })).toThrow(/criteria are for an LLM judge only/);
  });
  it("turn into the setup prompt's instruction", () => {
    expect(graderInstruction(gradersOf(graders)[1], "claude-sonnet-5-5")).toBe(
      'Grade with "Policy correct", an LLM judge (claude-sonnet-5-5): Does the answer apply the policy the reference states? Give it the question, the answer, the expected answer and the full reference. Pass at 0.7.',
    );
  });
  it("a grader covers listed failure types only", () => {
    const patch = { graders };
    expect(() => cleanExtras("eval_run", patch)).not.toThrow();
  });
});

describe("runs per case and stability", () => {
  const cases = Array.from({ length: 20 }, (_, i) => ({ input: `q${i}`, expected: "a", actual: "", passed: i < 14, ...(i < 11 ? { stability: "always_pass" } : i < 15 ? { stability: "always_fail" } : i < 19 ? { stability: "flaky", flaky_cause: i < 18 ? "app" : "judge" } : { stability: "error" }) }));
  it("reads 41 of 60 runs (20 cases × 3), never 41 of 60 alone", () => {
    const [step] = buildSteps([node("c", 0, "eval_run", { tested: "x", passing: "y", cases, runs_per_case: 3, passed: 41, total: 60 })] as never[]);
    expect(step.check?.total).toBe(60);
    expect(checkStatus(step.check!)?.line).toBe("Passed 41 of 60 runs (20 cases × 3)");
  });
  it("counts stability", () => {
    const counts = stabilityCounts(checkCasesOf(cases));
    expect(counts).toMatchObject({ always_pass: 11, always_fail: 4, flaky: 4, error: 1, flakyApp: 3, flakyJudge: 1 });
    expect(stabilityLine(counts)).toBe("11 always pass · 4 always fail · 4 flaky (3 from the app, 1 from the judge) · 1 error");
    const total = Object.values({ a: counts!.always_pass, b: counts!.always_fail, c: counts!.flaky, d: counts!.error }).reduce((sum, n) => sum + n, 0);
    expect(total).toBeLessThanOrEqual(cases.length);
  });
  it("a cause is for a flaky case only; one case is the example", () => {
    expect(casesRefusal([{ input: "a", expected: "b", actual: "", passed: true, stability: "always_pass", flaky_cause: "app" }])).toMatch(/flaky/);
    expect(casesRefusal([{ input: "a", expected: "b", actual: "", passed: true, example: true }, { input: "c", expected: "d", actual: "", passed: true, example: true }])).toMatch(/Only one/);
    expect(exampleCaseOf(checkCasesOf([{ input: "a", expected: "b", passed: true, example: true }]))?.input).toBe("a");
  });
  it("a case's failure type names a listed one", () => {
    expect(casesRefusal([{ input: "a", expected: "b", actual: "", passed: true, failure_type: "Nope" }], ["Wrong policy decision"])).toMatch(/not a failure type listed/);
    expect(casesRefusal([{ input: "a", expected: "b", actual: "", passed: true, failure_type: "Wrong policy decision", rule: "Returns within 30 days" }], ["Wrong policy decision"])).toBeNull();
  });
});

describe("run history", () => {
  const runs = [
    { at: "2026-10-28", passed: 54, total: 60, id: "main-embedding-search", changed: "Search by meaning", vs: "main-prompt-v3", compare: { fixed: 4, regressions: 0, now_flaky: 1, still_failing: 4 }, cost: { cost: 1.4, currency: "USD", source: "maker" } },
    { at: "2026-10-24", passed: 41, total: 60, id: "main-prompt-v3", changed: "Answer only from the docs; a week is 7 days", vs: "main-prompt-v2", compare: { fixed: 7, regressions: 0, now_flaky: 3, still_failing: 4 } },
    { at: "2026-10-20", passed: 33, total: 60, id: "main-prompt-v2" },
  ];
  const cases = { cases: 20, runsPerCase: 3 };
  it("shows newest first as one line each", () => {
    const kept = checkRunsOf(runs);
    expect(kept.map((run) => run.id)).toEqual(["main-embedding-search", "main-prompt-v3", "main-prompt-v2"]);
    expect(runHistoryLine(kept[0], (day) => day)).toBe("main-embedding-search · Search by meaning · 54 of 60 · fixed 4 · regressions 0 · now flaky 1 · still failing 4");
  });
  it("compare without vs is refused", () => {
    const bad = [{ at: "2026-10-28", passed: 1, total: 3, id: "b", compare: { fixed: 1, regressions: 0, now_flaky: 0, still_failing: 0 } }];
    expect(checkRunsRefusal(bad as never)).toMatch(/needs the run/);
  });
  it("vs must name an earlier run", () => {
    expect(checkRunsRefusal(checkRunsOf(runs) as never, cases)).toBeNull();
    const wrong = checkRunsOf([{ ...runs[2], vs: "main-prompt-v3", compare: { fixed: 0, regressions: 0, now_flaky: 0, still_failing: 0 } }, runs[1]]);
    expect(checkRunsRefusal(wrong as never)).toMatch(/not an earlier run/);
  });
  it("a total that is not cases × runs per case is refused, with that reason", () => {
    expect(checkRunsRefusal(checkRunsOf([{ at: "2026-10-28", passed: 5, total: 50 }]) as never, cases)).toMatch(/20 cases × 3 runs per case = 60/);
  });
});

describe("the CI gate", () => {
  it("shows its line and its dropped rules", () => {
    const parsed = gateOf(gate)!;
    expect(gateLine(parsed, () => "GitHub Actions")).toBe("CI gate: on every pull request in GitHub Actions · fails when a case goes from always pass to always fail, over 3 runs · a missing result fails · about 8 minutes");
    expect(gateDroppedLines(parsed)).toEqual(["Tried and dropped: Fail on any regression, one run. A correct answer failed on judge noise."]);
  });
  it("holds 1 to 10 runs and up to 4 dropped rules", () => {
    expect(() => cleanExtras("eval_run", { gate: { ...gate, runs: 11 } })).toThrow();
    expect(() => cleanExtras("eval_run", { gate: { ...gate, rejected: Array.from({ length: 5 }, () => ({ rule: "x", why: "y" })) } })).toThrow();
    expect(() => cleanExtras("eval_run", { gate: { ...gate, rule: { kind: "pass_rate_below" } } })).toThrow();
  });
});

describe("the harness together", () => {
  it("saves each field, reads it back, and an old Check reads as before", () => {
    const keys = cleanExtras("eval_run", { failure_types: failureTypes, graders, judge_model: "claude-sonnet-5-5", framework: "deepeval", runs_per_case: 3, gate });
    const [step] = buildSteps([node("c", 0, "eval_run", { tested: "x", passing: "y", ...keys })] as never[]);
    expect(step.check?.harness?.graders).toHaveLength(3);
    expect(step.check?.harness?.gate?.runs).toBe(3);
    expect(step.check?.harness?.framework).toBe("deepeval");
    const [old] = buildSteps([node("o", 0, "eval_run", { tested: "x", passing: "y", passed: 3, total: 4 })] as never[]);
    expect(old.check?.harness).toBeUndefined();
    expect(old.check?.passed).toBe(3);
  });
  it("is never the agent's harness", () => {
    const keys = cleanExtras("eval_run", { framework: "deepeval" });
    expect(Object.keys(keys)).not.toContain("harness");
    expect(evalHarnessOf({ harness: "claude-code" })).toBeNull();
  });
});

describe("a fork", () => {
  it("keeps graders and the gate's rule, and labels the results as the original's", () => {
    const payload: Record<string, unknown> = { tested: "x", passing: "y", ...(cleanExtras("eval_run", { failure_types: failureTypes, graders, runs_per_case: 3, gate }) as Record<string, unknown>), runs: [{ at: "2026-10-28", passed: 54, total: 60, id: "a", cost: { cost: 1.4, currency: "USD", source: "maker" } }] };
    const kept = methodOf(payload) as Record<string, unknown>;
    expect(kept.graders).toEqual(payload.graders);
    expect((kept.gate as { rule: unknown }).rule).toEqual({ kind: "pass_to_fail" });
    expect((kept.gate as { minutes: { source: string } }).minutes.source).toBe("original");
    expect(kept.from_original).toBe(true);
    const [step] = buildSteps([node("c", 0, "eval_run", kept)] as never[]);
    expect(step.check?.fromOriginal).toBe(true);
    expect(step.check?.runs?.[0].cost?.source).toBe("original");
    expect(step.check?.harness?.gate?.minutes?.source).toBe("original");
  });
});
