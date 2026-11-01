// SV-29 P4: the eval harness on the Check (`eval_run`): the code that runs test cases against the app, grades each answer and reports
// what got fixed and what broke. Not the agent's harness (`payload.harness`), which runs an agent: nothing here is read from or
// written to that field. Every key is optional, lives in the Check's own `payload`, and shows only when given. PURE.

import type { Json } from "@/integrations/supabase/types";

import type { MeasuredCost } from "./comparison";
import { SOURCE_WORD, type FigureSource } from "./pipelineFields";
import { clean, registerCleaners } from "./tileExtras";

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const whole = (value: unknown, min: number, max: number): number | null => (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null);
const share = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null);
const sourceOf = (raw: unknown): FigureSource => (raw === "run" ? "run" : raw === "original" ? "original" : "maker");
const COUNT_MAX = 1_000_000;

/** "a", "a and b", "a, b and c". */
export const listWords = (items: readonly string[]): string => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/* ── failure types ── */

export const FIX_IN = ["prompt", "retrieval", "content", "tool", "model", "eval_harness", "people"] as const;
export type FixIn = (typeof FIX_IN)[number];
export const FIX_IN_LABEL: Record<FixIn, string> = {
  prompt: "The prompt",
  retrieval: "Retrieval",
  content: "The source content",
  tool: "A tool",
  model: "The model",
  eval_harness: "The eval harness itself",
  people: "A decision for people",
};
export const FAILURE_TYPES_MAX = 12;
export const FAILURE_NAME_MAX = 40;
export const FAILURE_NOTE_MAX = 120;

export interface FailureType {
  name: string;
  /** How many of the cases read showed it. */
  count: number;
  /** How many cases were read. */
  read: number;
  fixIn: FixIn;
  /** Required with `people`. */
  note?: string;
}

/** The failure types, read defensively and sorted by count (most first). */
export function failureTypesOf(raw: unknown, sorted = true): FailureType[] {
  if (!Array.isArray(raw)) return [];
  const read = raw
    .flatMap((entry): FailureType[] => {
      if (!isRecord(entry)) return [];
      const name = clean(entry.name, FAILURE_NAME_MAX);
      const count = whole(entry.count, 0, COUNT_MAX);
      const read = whole(entry.read, 0, COUNT_MAX);
      if (!name || count === null || read === null || !FIX_IN.includes(entry.fix_in as FixIn)) return [];
      const note = clean(entry.note, FAILURE_NOTE_MAX);
      return [{ name, count, read, fixIn: entry.fix_in as FixIn, ...(note ? { note } : null) }];
    })
    .slice(0, FAILURE_TYPES_MAX);
  return sorted ? read.sort((a, b) => b.count - a.count) : read;
}

/** Why these failure types cannot be saved, or null. */
export function failureTypesRefusal(types: readonly FailureType[]): string | null {
  if (types.length > FAILURE_TYPES_MAX) return `Failure types: ${FAILURE_TYPES_MAX} max`;
  const names = new Set<string>();
  for (const type of types) {
    if (!type.name.trim()) return "Each failure type needs a name.";
    if (type.name.trim().length > FAILURE_NAME_MAX) return `Failure type: ${FAILURE_NAME_MAX} characters max`;
    if (names.has(type.name.trim())) return `Two failure types are called '${type.name.trim()}'.`;
    names.add(type.name.trim());
    if (type.count > type.read) return `'${type.name}': the count can't be more than the cases read.`;
    if (type.fixIn === "people" && !(type.note ?? "").trim()) return `'${type.name}' is for people to decide: say what is missing.`;
    if ((type.note ?? "").trim().length > FAILURE_NOTE_MAX) return `Note: ${FAILURE_NOTE_MAX} characters max`;
  }
  return null;
}

/** "5 of 20". */
export const failureCountLine = (type: FailureType): string => `${type.count} of ${type.read}`;

/** "Needs a decision: No help-centre page covers damaged items"; null for any other. */
export const needsDecisionLine = (type: FailureType): string | null => (type.fixIn === "people" && type.note ? `Needs a decision: ${type.note}` : null);

/* ── graders ── */

export const GRADER_KINDS = ["llm_judge", "built_in", "code"] as const;
export type GraderKind = (typeof GRADER_KINDS)[number];
export const GRADER_KIND_LABEL: Record<GraderKind, string> = { llm_judge: "LLM judge", built_in: "Built-in metric", code: "Code" };

export const SEES = ["question", "answer", "expected", "reference", "retrieved", "tool_results"] as const;
export type Sees = (typeof SEES)[number];
export const SEES_LABEL: Record<Sees, string> = {
  question: "the question",
  answer: "the answer",
  expected: "the expected answer",
  reference: "the full reference",
  retrieved: "what the app retrieved",
  tool_results: "the tool results",
};
export const GRADERS_MAX = 8;
export const GRADER_NAME_MAX = 40;
export const CRITERIA_MAX = 400;
export const JUDGE_MODEL_MAX = 80;
export const FRAMEWORK_MAX = 40;

export interface Grader {
  name: string;
  kind: GraderKind;
  /** An LLM judge only. */
  criteria?: string;
  sees: Sees[];
  threshold?: number;
  /** Failure type names. */
  covers: string[];
  /** Metric validation: run on cases already labelled good and bad. */
  validated?: { good: number; bad: number; correct: boolean };
}

export function gradersOf(raw: unknown): Grader[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((entry): Grader[] => {
      if (!isRecord(entry)) return [];
      const name = clean(entry.name, GRADER_NAME_MAX);
      if (!name || !GRADER_KINDS.includes(entry.kind as GraderKind)) return [];
      const kind = entry.kind as GraderKind;
      const criteria = kind === "llm_judge" ? clean(entry.criteria, CRITERIA_MAX) : "";
      const sees = SEES.filter((item) => Array.isArray(entry.sees) && entry.sees.includes(item));
      const threshold = share(entry.threshold);
      const covers = Array.isArray(entry.covers) ? entry.covers.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
      const good = isRecord(entry.validated) ? whole(entry.validated.good, 0, COUNT_MAX) : null;
      const bad = isRecord(entry.validated) ? whole(entry.validated.bad, 0, COUNT_MAX) : null;
      const validated = isRecord(entry.validated) && good !== null && bad !== null && good + bad > 0 && typeof entry.validated.correct === "boolean" ? { good, bad, correct: entry.validated.correct } : null;
      return [{ name, kind, ...(criteria ? { criteria } : null), sees, ...(threshold !== null ? { threshold } : null), covers, ...(validated ? { validated } : null) }];
    })
    .slice(0, GRADERS_MAX);
}

/** Why these graders cannot be saved, or null. `failureNames` are the listed failure types. */
export function gradersRefusal(graders: readonly Grader[], failureNames: readonly string[]): string | null {
  if (graders.length > GRADERS_MAX) return `Graders: ${GRADERS_MAX} max`;
  for (const grader of graders) {
    if (!grader.name.trim()) return "Each grader needs a name.";
    if (grader.name.trim().length > GRADER_NAME_MAX) return `Grader name: ${GRADER_NAME_MAX} characters max`;
    if (grader.kind !== "llm_judge" && (grader.criteria ?? "").trim()) return `'${grader.name}' is not an LLM judge: criteria are for an LLM judge only.`;
    if (grader.kind === "llm_judge" && !(grader.criteria ?? "").trim()) return `'${grader.name}' is an LLM judge: say what it looks for.`;
    if ((grader.criteria ?? "").trim().length > CRITERIA_MAX) return `Criteria: ${CRITERIA_MAX} characters max`;
    if (grader.threshold !== undefined && share(grader.threshold) === null) return "Threshold: 0 to 1";
    for (const name of grader.covers) if (!failureNames.includes(name)) return `'${grader.name}' covers '${name}', which is not a failure type listed here.`;
    if (grader.validated && (grader.validated.good + grader.validated.bad === 0 || grader.validated.good < 0 || grader.validated.bad < 0)) return "Validation: how many good and how many bad cases it was tested on.";
  }
  return null;
}

/** "Tested on 3 good and 3 bad cases before use", or "Tested, and it judged some wrongly". */
export const validatedLine = (validated: NonNullable<Grader["validated"]>): string =>
  validated.correct ? `Tested on ${validated.good} good and ${validated.bad} bad cases before use` : "Tested, and it judged some wrongly";

/** "Policy correct · LLM judge · sees the question, the answer, the expected answer and the full reference · 0.7 · covers Wrong policy decision". */
export function graderLine(grader: Grader): string {
  return [
    grader.name,
    GRADER_KIND_LABEL[grader.kind],
    grader.sees.length > 0 ? `sees ${listWords(grader.sees.map((item) => SEES_LABEL[item]))}` : null,
    grader.threshold !== undefined ? String(grader.threshold) : null,
    grader.covers.length > 0 ? `covers ${grader.covers.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "Grade with "Policy correct", an LLM judge (claude-sonnet-5-5): <criteria>. Give it the question, ... Pass at 0.7." */
export function graderInstruction(grader: Grader, judgeModel?: string, framework?: string): string {
  const how = grader.kind === "llm_judge" ? `an LLM judge${judgeModel ? ` (${judgeModel})` : ""}` : grader.kind === "built_in" ? `a built-in metric${framework ? ` from ${framework}` : ""}` : "a check in code";
  const said = (grader.criteria ?? "").trim();
  const criteria = said ? `: ${said}${/[.?!]$/.test(said) ? "" : "."}` : ".";
  const gives = grader.sees.length > 0 ? ` Give it ${listWords(grader.sees.map((item) => SEES_LABEL[item]))}.` : "";
  const pass = grader.threshold !== undefined ? ` Pass at ${grader.threshold}.` : "";
  return `Grade with "${grader.name}", ${how}${criteria}${gives}${pass}`;
}

/* ── runs per case and stability ── */

export const RUNS_PER_CASE_MAX = 10;
export const STABILITIES = ["always_pass", "always_fail", "flaky", "error"] as const;
export type Stability = (typeof STABILITIES)[number];
export const STABILITY_LABEL: Record<Stability, string> = { always_pass: "Always passes", always_fail: "Always fails", flaky: "Flaky", error: "Error" };
export const FLAKY_CAUSES = ["app", "judge"] as const;
export type FlakyCause = (typeof FLAKY_CAUSES)[number];
export const FLAKY_CAUSE_LABEL: Record<FlakyCause, string> = { app: "The app gave different answers", judge: "The judge scored the same answer differently" };

/** The counts a Check shows: how many cases fall in each, and of the flaky ones how many each cause. */
export interface StabilityCounts {
  always_pass: number;
  always_fail: number;
  flaky: number;
  error: number;
  flakyApp: number;
  flakyJudge: number;
}

export function stabilityCounts(cases: readonly { stability?: Stability; flaky_cause?: FlakyCause }[]): StabilityCounts | null {
  const given = cases.filter((entry) => entry.stability);
  if (given.length === 0) return null;
  const count = (stability: Stability) => given.filter((entry) => entry.stability === stability).length;
  return {
    always_pass: count("always_pass"),
    always_fail: count("always_fail"),
    flaky: count("flaky"),
    error: count("error"),
    flakyApp: given.filter((entry) => entry.stability === "flaky" && entry.flaky_cause === "app").length,
    flakyJudge: given.filter((entry) => entry.stability === "flaky" && entry.flaky_cause === "judge").length,
  };
}

/** "11 always pass · 4 always fail · 4 flaky (3 from the app, 1 from the judge) · 1 error". Null when no case has a stability. */
export function stabilityLine(counts: StabilityCounts | null): string | null {
  if (!counts) return null;
  const causes = [counts.flakyApp ? `${counts.flakyApp} from the app` : null, counts.flakyJudge ? `${counts.flakyJudge} from the judge` : null].filter(Boolean).join(", ");
  return [
    counts.always_pass ? `${counts.always_pass} always pass` : null,
    counts.always_fail ? `${counts.always_fail} always fail` : null,
    counts.flaky ? `${counts.flaky} flaky${causes ? ` (${causes})` : ""}` : null,
    counts.error ? `${counts.error} ${counts.error === 1 ? "error" : "errors"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "41 of 60 runs (20 cases × 3)": passed of total, never "41 of 60" alone, when the check has cases and runs per case. */
export const runsOfCasesLine = (passed: number, cases: number, runsPerCase: number): string => `${passed} of ${cases * runsPerCase} runs (${cases} cases × ${runsPerCase})`;

/* ── run history ── */

export const RUN_ID_MAX = 60;
export const RUN_CHANGED_MAX = 100;
export const RUN_HISTORY_HELP = "Change one thing per run, so you know which change did it.";

export interface RunCompare {
  fixed: number;
  regressions: number;
  now_flaky: number;
  still_failing: number;
}

/** The extra keys a run can hold. `at`, `passed` and `total` are `CheckRun`'s own. */
export interface RunExtras {
  id?: string;
  changed?: string;
  vs?: string;
  compare?: RunCompare;
  cost?: MeasuredCost;
  minutes?: number;
}

export function runExtrasOf(entry: Raw): RunExtras {
  const id = clean(entry.id, RUN_ID_MAX);
  const changed = clean(entry.changed, RUN_CHANGED_MAX);
  const vs = clean(entry.vs, RUN_ID_MAX);
  const raw = isRecord(entry.compare) ? entry.compare : null;
  const counts = raw ? [whole(raw.fixed, 0, COUNT_MAX), whole(raw.regressions, 0, COUNT_MAX), whole(raw.now_flaky, 0, COUNT_MAX), whole(raw.still_failing, 0, COUNT_MAX)] : null;
  const compare = vs && counts && counts.every((n) => n !== null) ? { fixed: counts[0] as number, regressions: counts[1] as number, now_flaky: counts[2] as number, still_failing: counts[3] as number } : null;
  const cost = isRecord(entry.cost) && typeof entry.cost.cost === "number" && Number.isFinite(entry.cost.cost) && entry.cost.cost >= 0 ? { cost: entry.cost.cost, currency: entry.cost.currency === "GBP" ? ("GBP" as const) : ("USD" as const), source: sourceOf(entry.cost.source) } : null;
  const minutes = typeof entry.minutes === "number" && Number.isFinite(entry.minutes) && entry.minutes >= 0 && entry.minutes <= 100_000 ? entry.minutes : null;
  return { ...(id ? { id } : null), ...(changed ? { changed } : null), ...(vs ? { vs } : null), ...(compare ? { compare } : null), ...(cost ? { cost } : null), ...(minutes !== null ? { minutes } : null) };
}

/** Why runs with these extras cannot be kept, or null. `runs` newest first; `context` holds the check's cases and runs per case when it has both. */
export function runExtrasRefusal(runs: readonly (RunExtras & { total: number })[], context?: { cases: number; runsPerCase: number | null }): string | null {
  const seen = new Set<string>();
  for (const [at, run] of runs.entries()) {
    if (run.id) {
      if (seen.has(run.id)) return `Two runs are called '${run.id}'.`;
      seen.add(run.id);
    }
    if (run.id && run.id.length > RUN_ID_MAX) return `Run ID: ${RUN_ID_MAX} characters max`;
    if ((run.changed ?? "").length > RUN_CHANGED_MAX) return `What changed: ${RUN_CHANGED_MAX} characters max`;
    if (run.compare && !run.vs) return "A comparison needs the run it is compared with.";
    if (run.vs && !runs.slice(at + 1).some((older) => older.id === run.vs)) return `'${run.id ?? "This run"}' is compared with '${run.vs}', which is not an earlier run.`;
    if (context && context.runsPerCase && context.cases > 0 && run.total !== context.cases * context.runsPerCase) return `A run's total must be ${context.cases} cases × ${context.runsPerCase} runs per case = ${context.cases * context.runsPerCase}.`;
  }
  return null;
}

/** "main-embedding-search · Search by meaning · 54 of 60 · fixed 4 · regressions 0 · now flaky 1 · still failing 4". */
export function runHistoryLine(run: { id?: string; changed?: string; at: string; passed: number; total: number; compare?: RunCompare }, dayWords: (day: string) => string): string {
  return [
    run.id ?? dayWords(run.at),
    run.changed,
    `${run.passed} of ${run.total}`,
    run.compare ? `fixed ${run.compare.fixed}` : null,
    run.compare ? `regressions ${run.compare.regressions}` : null,
    run.compare ? `now flaky ${run.compare.now_flaky}` : null,
    run.compare ? `still failing ${run.compare.still_failing}` : null,
  ]
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join(" · ");
}

/* ── the CI gate ── */

export const GATE_ON = ["pull_request", "merge", "schedule", "manual"] as const;
export type GateOn = (typeof GATE_ON)[number];
export const GATE_ON_LABEL: Record<GateOn, string> = { pull_request: "on every pull request", merge: "on every merge", schedule: "on a schedule", manual: "when run by hand" };

export const GATE_RULES = ["any_regression", "pass_to_fail", "pass_rate_below", "custom"] as const;
export type GateRuleKind = (typeof GATE_RULES)[number];
export const GATE_RULE_LABEL: Record<GateRuleKind, string> = {
  any_regression: "Fails on any regression",
  pass_to_fail: "Fails when a case goes from always pass to always fail",
  pass_rate_below: "Fails when the pass rate is below a value",
  custom: "A rule of your own",
};
export const GATE_RUNS_IN_MAX = 40;
export const GATE_PATHS_MAX = 120;
export const GATE_CUSTOM_MAX = 120;
export const GATE_REJECTED_MAX = 4;
export const GATE_REJECTED_RULE_MAX = 120;
export const GATE_REJECTED_WHY_MAX = 160;

export interface GateRule {
  kind: GateRuleKind;
  /** `pass_rate_below`. */
  value?: number;
  /** `custom`. */
  text?: string;
}

export interface Gate {
  runsIn: string;
  on: GateOn;
  paths?: string;
  rule: GateRule;
  runs: number;
  missingResultFails: boolean;
  minutes?: { value: number; source: FigureSource };
  costPerRun?: MeasuredCost;
  rejected: { rule: string; why: string }[];
}

export function gateOf(raw: unknown): Gate | null {
  if (!isRecord(raw)) return null;
  const runsIn = clean(raw.runs_in, GATE_RUNS_IN_MAX);
  if (!runsIn || !GATE_ON.includes(raw.on as GateOn) || !isRecord(raw.rule) || !GATE_RULES.includes(raw.rule.kind as GateRuleKind)) return null;
  const kind = raw.rule.kind as GateRuleKind;
  const value = share(raw.rule.value);
  const text = clean(raw.rule.text, GATE_CUSTOM_MAX);
  if ((kind === "pass_rate_below" && value === null) || (kind === "custom" && !text)) return null;
  const runs = whole(raw.runs, 1, RUNS_PER_CASE_MAX);
  if (runs === null) return null;
  const paths = clean(raw.paths, GATE_PATHS_MAX);
  const minutes = isRecord(raw.minutes) && typeof raw.minutes.value === "number" && raw.minutes.value >= 0 && Number.isFinite(raw.minutes.value) ? { value: raw.minutes.value, source: sourceOf(raw.minutes.source) } : null;
  const cost = isRecord(raw.cost_per_run) && typeof raw.cost_per_run.cost === "number" && raw.cost_per_run.cost >= 0 && Number.isFinite(raw.cost_per_run.cost) ? { cost: raw.cost_per_run.cost, currency: raw.cost_per_run.currency === "GBP" ? ("GBP" as const) : ("USD" as const), source: sourceOf(raw.cost_per_run.source) } : null;
  const rejected = (Array.isArray(raw.rejected) ? raw.rejected : []).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const rule = clean(entry.rule, GATE_REJECTED_RULE_MAX);
    const why = clean(entry.why, GATE_REJECTED_WHY_MAX);
    return rule ? [{ rule, why }] : [];
  }).slice(0, GATE_REJECTED_MAX);
  return {
    runsIn,
    on: raw.on as GateOn,
    ...(paths ? { paths } : null),
    rule: { kind, ...(kind === "pass_rate_below" && value !== null ? { value } : null), ...(kind === "custom" ? { text } : null) },
    runs,
    missingResultFails: raw.missing_result_fails === true,
    ...(minutes ? { minutes } : null),
    ...(cost ? { costPerRun: cost } : null),
    rejected,
  };
}

export function gateRefusal(raw: unknown): string | null {
  if (!isRecord(raw)) return "CI gate: where it runs, when, and its rule.";
  if (!clean(raw.runs_in)) return "CI gate: where it runs.";
  if (clean(raw.runs_in).length > GATE_RUNS_IN_MAX) return `Runs in: ${GATE_RUNS_IN_MAX} characters max`;
  if (!GATE_ON.includes(raw.on as GateOn)) return "CI gate: when it runs.";
  if (clean(raw.paths).length > GATE_PATHS_MAX) return `Paths: ${GATE_PATHS_MAX} characters max`;
  const rule = isRecord(raw.rule) ? raw.rule : null;
  if (!rule || !GATE_RULES.includes(rule.kind as GateRuleKind)) return "CI gate: its rule.";
  if (rule.kind === "pass_rate_below" && share(rule.value) === null) return "Pass rate below: a value from 0 to 1.";
  if (rule.kind === "custom" && !clean(rule.text)) return "A custom rule needs its words.";
  if (clean(rule.text).length > GATE_CUSTOM_MAX) return `Custom rule: ${GATE_CUSTOM_MAX} characters max`;
  if (whole(raw.runs, 1, RUNS_PER_CASE_MAX) === null) return `Runs: 1 to ${RUNS_PER_CASE_MAX}`;
  const rejected = Array.isArray(raw.rejected) ? raw.rejected : [];
  if (rejected.length > GATE_REJECTED_MAX) return `Rules tried and dropped: ${GATE_REJECTED_MAX} max`;
  for (const entry of rejected) {
    if (!isRecord(entry) || !clean(entry.rule)) return "Each dropped rule needs its words.";
    if (clean(entry.rule).length > GATE_REJECTED_RULE_MAX) return `Dropped rule: ${GATE_REJECTED_RULE_MAX} characters max`;
    if (clean(entry.why).length > GATE_REJECTED_WHY_MAX) return `Why dropped: ${GATE_REJECTED_WHY_MAX} characters max`;
  }
  return null;
}

/** "fails when a case goes from always pass to always fail, over 3 runs". */
export function gateRuleClause(gate: Gate): string {
  const base =
    gate.rule.kind === "any_regression"
      ? "fails on any regression"
      : gate.rule.kind === "pass_to_fail"
        ? "fails when a case goes from always pass to always fail"
        : gate.rule.kind === "pass_rate_below"
          ? `fails when the pass rate is below ${gate.rule.value}`
          : (gate.rule.text ?? "");
  return `${base}, over ${gate.runs} ${gate.runs === 1 ? "run" : "runs"}`;
}

/** "CI gate: on every pull request in GitHub Actions · fails when ... over 3 runs · a missing result fails · about 8 minutes". */
export function gateLine(gate: Gate, runsInName: (id: string) => string = (id) => id): string {
  return [
    `CI gate: ${GATE_ON_LABEL[gate.on]} in ${runsInName(gate.runsIn)}${gate.paths ? ` (paths: ${gate.paths})` : ""}`,
    gateRuleClause(gate),
    gate.missingResultFails ? "a missing result fails" : "a missing result does not fail",
    gate.minutes ? `about ${gate.minutes.value} ${gate.minutes.value === 1 ? "minute" : "minutes"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "Tried and dropped: Fail on any regression, one run. A correct answer failed on judge noise." One line for each. */
export const gateDroppedLines = (gate: Gate): string[] => gate.rejected.map((entry) => `Tried and dropped: ${entry.rule.replace(/[.\s]+$/, "")}.${entry.why ? ` ${entry.why.replace(/\s+$/, "").replace(/([^.!?])$/, "$1.")}` : ""}`);

/** The figure's source in the words the page uses. */
export const harnessSourceWord = (source: FigureSource): string => SOURCE_WORD[source];

/* ── a Check's eval harness, together ── */

export interface EvalHarness {
  failureTypes: FailureType[];
  /** The same, in the order the maker wrote them (the setup prompt keeps that order). */
  failureTypesWritten: FailureType[];
  graders: Grader[];
  judgeModel?: string;
  framework?: string;
  runsPerCase?: number;
  gate?: Gate;
}

export function evalHarnessOf(payload: Raw): EvalHarness | null {
  const failureTypes = failureTypesOf(payload.failure_types);
  const graders = gradersOf(payload.graders);
  const judgeModel = clean(payload.judge_model, JUDGE_MODEL_MAX);
  const framework = clean(payload.framework, FRAMEWORK_MAX);
  const runsPerCase = whole(payload.runs_per_case, 1, RUNS_PER_CASE_MAX);
  const gate = gateOf(payload.gate);
  if (failureTypes.length === 0 && graders.length === 0 && !judgeModel && !framework && runsPerCase === null && !gate) return null;
  return { failureTypes, failureTypesWritten: failureTypesOf(payload.failure_types, false), graders, ...(judgeModel ? { judgeModel } : null), ...(framework ? { framework } : null), ...(runsPerCase !== null ? { runsPerCase } : null), ...(gate ? { gate } : null) };
}

/** For `setExtras`: what needs the Check's other keys. A case names a listed failure type; a grader covers listed ones; a judge model needs an LLM judge. */
export function evalHarnessPatchRefusal(payload: Raw, patch: Raw): string | null {
  const touched = ["failure_types", "graders", "judge_model", "runs_per_case", "gate"].some((key) => key in patch);
  if (!touched) return null;
  const merged = { ...payload, ...patch };
  const types = failureTypesOf(merged.failure_types);
  const graders = gradersOf(merged.graders);
  const names = types.map((type) => type.name);
  const why = gradersRefusal(graders, names);
  if (why) return why;
  if (clean(merged.judge_model) && !graders.some((grader) => grader.kind === "llm_judge")) return "A judge model is for an LLM judge: add a grader of that kind.";
  if ("failure_types" in patch && Array.isArray(merged.cases)) {
    const used = merged.cases.flatMap((entry) => (isRecord(entry) && typeof entry.failure_type === "string" && entry.failure_type ? [entry.failure_type] : []));
    const lost = used.find((name) => !names.includes(name));
    if (lost) return `A test case is marked '${lost}', which is not a failure type listed here.`;
  }
  return null;
}

/** The example case, if any case is marked: shown in full under the test set. */
export const exampleCaseOf = <T extends { example?: boolean }>(cases: readonly T[] | undefined): T | undefined => cases?.find((entry) => entry.example === true);

registerCleaners("eval_run", {
  failure_types: (value) => {
    if (value === null || value === undefined) return null;
    const raw = Array.isArray(value) ? value : [];
    if (raw.length === 0) return null;
    const types = failureTypesOf(raw);
    if (types.length !== raw.length) {
      // A half-made type says why instead of vanishing.
      const bad = raw.find((entry) => !failureTypesOf([entry]).length);
      if (isRecord(bad) && typeof bad.count === "number" && typeof bad.read === "number" && bad.count > bad.read) throw new Error(`'${clean(bad.name)}': the count can't be more than the cases read.`);
      if (isRecord(bad) && bad.fix_in === "people" && !clean(bad.note)) throw new Error(`'${clean(bad.name)}' is for people to decide: say what is missing.`);
      throw new Error("Each failure type needs a name, how many of how many cases showed it, and where it is fixed.");
    }
    const why = failureTypesRefusal(types);
    if (why) throw new Error(why);
    return types.map((type) => ({ name: type.name, count: type.count, read: type.read, fix_in: type.fixIn, ...(type.note ? { note: type.note } : null) })) as Json;
  },
  graders: (value) => {
    if (value === null || value === undefined) return null;
    const raw = Array.isArray(value) ? value : [];
    if (raw.length === 0) return null;
    for (const entry of raw) {
      if (isRecord(entry) && entry.kind !== "llm_judge" && clean(entry.criteria)) throw new Error(`'${clean(entry.name)}' is not an LLM judge: criteria are for an LLM judge only.`);
    }
    const graders = gradersOf(raw);
    if (graders.length !== raw.length) throw new Error("Each grader needs a name and a kind.");
    // Names a listed failure type are checked by `evalHarnessPatchRefusal`, which sees the other keys.
    const why = gradersRefusal(graders, graders.flatMap((grader) => grader.covers));
    if (why) throw new Error(why);
    return graders.map((grader) => ({
      name: grader.name,
      kind: grader.kind,
      ...(grader.criteria ? { criteria: grader.criteria } : null),
      sees: grader.sees,
      ...(grader.threshold !== undefined ? { threshold: grader.threshold } : null),
      covers: grader.covers,
      ...(grader.validated ? { validated: grader.validated } : null),
    })) as Json;
  },
  judge_model: (value) => {
    const said = clean(value);
    if (said.length > JUDGE_MODEL_MAX) throw new Error(`Judge model: ${JUDGE_MODEL_MAX} characters max`);
    return said || null;
  },
  framework: (value) => {
    const said = clean(value);
    if (said.length > FRAMEWORK_MAX) throw new Error(`Framework: ${FRAMEWORK_MAX} characters max`);
    return said || null;
  },
  runs_per_case: (value) => {
    if (value === null || value === undefined || value === "") return null;
    const n = whole(value, 1, RUNS_PER_CASE_MAX);
    if (n === null) throw new Error(`Runs per case: 1 to ${RUNS_PER_CASE_MAX}`);
    return n;
  },
  gate: (value) => {
    if (value === null || value === undefined) return null;
    const why = gateRefusal(value);
    if (why) throw new Error(why);
    const gate = gateOf(value) as Gate;
    return {
      runs_in: gate.runsIn,
      on: gate.on,
      ...(gate.paths ? { paths: gate.paths } : null),
      rule: gate.rule,
      runs: gate.runs,
      missing_result_fails: gate.missingResultFails,
      ...(gate.minutes ? { minutes: gate.minutes } : null),
      ...(gate.costPerRun ? { cost_per_run: gate.costPerRun } : null),
      ...(gate.rejected.length > 0 ? { rejected: gate.rejected } : null),
    } as unknown as Json;
  },
});
