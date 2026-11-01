// SV-29 P3: a Check that compares approaches. A Check with scoring `ab` holds two or more rows, each an approach, a variant or a
// hypothesis, measured on one test set with one metric. Every key lives in the Check's own `payload`; an `ab` Check without rows
// reads exactly as before. The stored value stays `ab`; on screen it reads "Comparison of approaches". PURE.

import type { Json } from "@/integrations/supabase/types";

import type { QuestionType } from "./decision";
import { SOURCE_WORD, type FigureSource } from "./pipelineFields";
import { EVIDENCE_KINDS, type EvidenceKind } from "./evidenceKinds";
import { clean, registerCleaners } from "./tileExtras";

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const whole = (value: unknown, min: number, max: number): number | null => (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null);
const figure = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000 ? value : null);

/* ── the test set ── */

export const LABELLED_BY = ["maker", "annotators", "existing labels", "users"] as const;
export type LabelledBy = (typeof LABELLED_BY)[number];
export const LABELLED_BY_LABEL: Record<LabelledBy, string> = { maker: "The maker", annotators: "Annotators", "existing labels": "Existing labels", users: "Users" };

/** SV-29 P4: where the test cases came from. */
export const DRAWN_FROM = ["real_traffic", "written", "generated", "existing_labels"] as const;
export type DrawnFrom = (typeof DRAWN_FROM)[number];
export const DRAWN_FROM_LABEL: Record<DrawnFrom, string> = { real_traffic: "Real users' questions", written: "Written by the maker", generated: "Generated", existing_labels: "Existing labels" };
export const TRACE_TAG_MAX = 30;
export const TEST_FILE_MAX = 80;
export const TEST_SET_SIZE_MAX = 100_000_000;

export interface TestSet {
  size: number;
  labelledBy: LabelledBy;
  /** YYYY-MM. */
  labelledAt?: string;
  drawnFrom?: DrawnFrom;
  traceTag?: string;
  file?: string;
}

const isMonth = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function testSetOf(raw: unknown): TestSet | null {
  if (!isRecord(raw)) return null;
  const size = whole(raw.size, 1, TEST_SET_SIZE_MAX);
  if (size === null || !LABELLED_BY.includes(raw.labelled_by as LabelledBy)) return null;
  const at = clean(raw.labelled_at, 7);
  const drawn = DRAWN_FROM.includes(raw.drawn_from as DrawnFrom) ? (raw.drawn_from as DrawnFrom) : null;
  const tag = drawn === "real_traffic" ? clean(raw.trace_tag, TRACE_TAG_MAX) : "";
  const file = clean(raw.file, TEST_FILE_MAX);
  return { size, labelledBy: raw.labelled_by as LabelledBy, ...(isMonth(at) ? { labelledAt: at } : null), ...(drawn ? { drawnFrom: drawn } : null), ...(tag ? { traceTag: tag } : null), ...(file ? { file } : null) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1,000 test items, labelled by annotators in Oct 2026". */
export function testSetLine(set: TestSet): string {
  const when = set.labelledAt ? ` in ${MONTHS[Number(set.labelledAt.slice(5)) - 1]} ${set.labelledAt.slice(0, 4)}` : "";
  return `${set.size.toLocaleString("en-GB")} test ${set.size === 1 ? "item" : "items"}, labelled by ${LABELLED_BY_LABEL[set.labelledBy].toLowerCase()}${when}`;
}

/** SV-29 P4: "20 test cases from real users' questions (tag customer), in harness/goldens.json". Null when it says nothing of where they came from. */
export function testSetSourceLine(set: TestSet): string | null {
  if (!set.drawnFrom && !set.file) return null;
  const from = set.drawnFrom ? ` from ${DRAWN_FROM_LABEL[set.drawnFrom].toLowerCase().replace(/^real users' questions$/, "real users' questions")}${set.traceTag ? ` (tag ${set.traceTag})` : ""}` : "";
  return `${set.size.toLocaleString("en-GB")} test ${set.size === 1 ? "case" : "cases"}${from}${set.file ? `, in ${set.file}` : ""}`;
}

/* ── the metric ── */

export type MetricId = "accuracy" | "macro_f1" | "micro_f1" | "precision" | "recall" | "per_label" | "ndcg_at_k" | "mrr" | "recall_at_k" | "weighted_kappa" | "mae" | "exact_match" | "cer" | "pass_rate" | "custom";

export const METRIC_LABEL: Record<MetricId, string> = {
  accuracy: "Accuracy",
  macro_f1: "Macro F1",
  micro_f1: "Micro F1",
  precision: "Precision",
  recall: "Recall",
  per_label: "Per label",
  ndcg_at_k: "nDCG@k",
  mrr: "MRR",
  recall_at_k: "Recall@k",
  weighted_kappa: "Weighted kappa (quadratic)",
  mae: "Mean absolute error",
  exact_match: "Exact match",
  cer: "Character error rate",
  pass_rate: "Pass rate",
  custom: "Custom",
};

/** Lower is better. */
export const LOWER_IS_BETTER: readonly MetricId[] = ["mae", "cer"];
export const CUSTOM_METRIC_MAX = 40;

/** What is under test: a question type of a Decision, a Retrieval tile, or anything else. */
export type TestedKind = QuestionType | "retrieval" | "other";

/** The metric a question type defaults to, and the others offered. */
export const METRIC_FOR: Record<TestedKind, { default: MetricId; others: readonly MetricId[] }> = {
  choice: { default: "accuracy", others: ["macro_f1"] },
  multi: { default: "micro_f1", others: ["precision", "recall", "per_label"] },
  rank: { default: "ndcg_at_k", others: ["mrr", "recall_at_k"] },
  score: { default: "weighted_kappa", others: ["mae"] },
  extract: { default: "exact_match", others: ["cer"] },
  retrieval: { default: "recall_at_k", others: ["mrr"] },
  yesno: { default: "pass_rate", others: ["custom"] },
  other: { default: "pass_rate", others: ["custom"] },
};

/** The tested tile's kind, from the tile and, for a Decision, its first question. */
export function testedKindOf(tested: { kind: string; decision?: { questions: readonly { type: QuestionType }[] } | null } | null | undefined): TestedKind {
  if (!tested) return "other";
  if (tested.kind === "retrieval") return "retrieval";
  if (tested.kind === "decision" && tested.decision?.questions[0]) return tested.decision.questions[0].type;
  return "other";
}

export interface Metric {
  id: MetricId;
  /** Custom only: its name and unit. */
  name?: string;
  unit?: string;
}

export function metricOf(raw: unknown): Metric | null {
  const id = typeof raw === "string" ? raw : isRecord(raw) ? raw.id : null;
  if (typeof id !== "string" || !(id in METRIC_LABEL)) return null;
  if (id !== "custom") return { id: id as MetricId };
  const name = isRecord(raw) ? clean(raw.name, CUSTOM_METRIC_MAX) : "";
  const unit = isRecord(raw) ? clean(raw.unit, CUSTOM_METRIC_MAX) : "";
  return name && unit ? { id: "custom", name, unit } : null;
}

export const metricName = (metric: Metric): string => (metric.id === "custom" ? `${metric.name} (${metric.unit})` : METRIC_LABEL[metric.id]);

/** The metric a Check measures when the maker picked none: the default for the tested kind. */
export const defaultMetric = (kind: TestedKind): Metric => ({ id: METRIC_FOR[kind].default });

/** The metrics the window offers for a kind: the default first. */
export const metricChoices = (kind: TestedKind): MetricId[] => [METRIC_FOR[kind].default, ...METRIC_FOR[kind].others];

/* ── the rows ── */

export const ROW_KINDS = ["approach", "variant", "hypothesis"] as const;
export type RowKind = (typeof ROW_KINDS)[number];
export const ROW_KIND_LABEL: Record<RowKind, string> = { approach: "Approach", variant: "Variant", hypothesis: "Hypothesis" };

export const OUTCOMES = ["chosen", "rejected", "confirmed", "ruled out"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const OUTCOME_LABEL: Record<Outcome, string> = { chosen: "Chosen", rejected: "Rejected", confirmed: "Confirmed", "ruled out": "Ruled out" };
/** `chosen` and `rejected` are for approaches and variants; `confirmed` and `ruled out` for hypotheses. */
export const OUTCOMES_FOR: Record<RowKind, readonly Outcome[]> = { approach: ["chosen", "rejected"], variant: ["chosen", "rejected"], hypothesis: ["confirmed", "ruled out"] };

export const ROWS_MIN = 2;
export const ROWS_MAX = 12;
export const ROW_LABEL_MAX = 80;
export const ROW_REASON_MAX = 160;

export interface MeasuredCost {
  cost: number;
  currency: "USD" | "GBP";
  source: FigureSource;
}

export interface ComparisonRow {
  kind: RowKind;
  label: string;
  /** The node ids of the tiles that make up the approach. */
  tiles: string[];
  value?: { value: number; source: FigureSource };
  costPerItem?: MeasuredCost;
  outcome?: Outcome;
  reason?: string;
  /** SV-30 P8: where the row's figure comes from, as a kind of evidence and an https link, when the maker gave one. */
  evidence?: { kind: EvidenceKind; url: string };
}

const sourceOf = (raw: unknown): FigureSource => (raw === "run" ? "run" : raw === "original" ? "original" : "maker");

/** SV-30 P8: a row's evidence, with the same kinds a Check has; the address is https only. */
export function rowEvidenceOf(raw: unknown): ComparisonRow["evidence"] | null {
  if (!isRecord(raw) || !EVIDENCE_KINDS.includes(raw.kind as EvidenceKind) || typeof raw.url !== "string") return null;
  try {
    const url = new URL(raw.url.trim());
    return url.protocol === "https:" && url.hostname.includes(".") ? { kind: raw.kind as EvidenceKind, url: url.toString() } : null;
  } catch {
    return null;
  }
}

/** The rows, read defensively; a row with no label is left out. */
export function rowsOf(raw: unknown): ComparisonRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((entry): ComparisonRow[] => {
      if (!isRecord(entry)) return [];
      const label = clean(entry.label, ROW_LABEL_MAX);
      if (!label) return [];
      const kind: RowKind = ROW_KINDS.includes(entry.kind as RowKind) ? (entry.kind as RowKind) : "approach";
      const tiles = Array.isArray(entry.tiles) ? entry.tiles.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
      const value = isRecord(entry.value) ? figure(entry.value.value) : figure(entry.value);
      const cost = isRecord(entry.cost_per_item) ? figure(entry.cost_per_item.cost) : null;
      const outcome = OUTCOMES_FOR[kind].includes(entry.outcome as Outcome) ? (entry.outcome as Outcome) : undefined;
      const reason = clean(entry.reason, ROW_REASON_MAX);
      return [
        {
          kind,
          label,
          tiles,
          ...(value !== null ? { value: { value, source: sourceOf(isRecord(entry.value) ? entry.value.source : undefined) } } : null),
          ...(cost !== null && isRecord(entry.cost_per_item) ? { costPerItem: { cost, currency: entry.cost_per_item.currency === "GBP" ? ("GBP" as const) : ("USD" as const), source: sourceOf(entry.cost_per_item.source) } } : null),
          ...(outcome ? { outcome } : null),
          ...(reason ? { reason } : null),
          ...(rowEvidenceOf(entry.evidence) ? { evidence: rowEvidenceOf(entry.evidence) as NonNullable<ComparisonRow["evidence"]> } : null),
        },
      ];
    })
    .slice(0, ROWS_MAX);
}

/** Why these rows cannot be saved, or null. Fixed words only. */
export function rowsRefusal(rows: readonly ComparisonRow[]): string | null {
  if (rows.length === 0) return null;
  if (rows.length < ROWS_MIN) return `A comparison holds ${ROWS_MIN} to ${ROWS_MAX} rows.`;
  if (rows.length > ROWS_MAX) return `A comparison holds ${ROWS_MIN} to ${ROWS_MAX} rows.`;
  const labels = new Set<string>();
  for (const row of rows) {
    if (!row.label.trim()) return "Each row needs a label.";
    if (row.label.trim().length > ROW_LABEL_MAX) return `Row label: ${ROW_LABEL_MAX} characters max`;
    if (labels.has(row.label.trim())) return `Two rows are called '${row.label.trim()}'.`;
    labels.add(row.label.trim());
    if (row.outcome && !OUTCOMES_FOR[row.kind].includes(row.outcome)) return `'${row.label}' is ${ROW_KIND_LABEL[row.kind].toLowerCase() === "hypothesis" ? "a hypothesis: confirmed or ruled out" : `an ${ROW_KIND_LABEL[row.kind].toLowerCase()}: chosen or rejected`}.`;
    if ((row.outcome === "rejected" || row.outcome === "ruled out") && !(row.reason ?? "").trim()) return `'${row.label}' is ${row.outcome}: say why.`;
    if ((row.reason ?? "").trim().length > ROW_REASON_MAX) return `Reason: ${ROW_REASON_MAX} characters max`;
    if (row.value && figure(row.value.value) === null) return "A row's figure is a number.";
    if (row.costPerItem && figure(row.costPerItem.cost) === null) return "A row's cost is a number.";
    if (row.evidence && !rowEvidenceOf(row.evidence)) return "A row's evidence is a kind and a link starting with https://.";
  }
  if (rows.filter((row) => row.outcome === "chosen").length > 1) return "Only one row can be chosen.";
  return null;
}

/** An existing `ab` Check with no rows opens with these: nothing stored is rewritten. */
export const blankRows = (): ComparisonRow[] => [
  { kind: "approach", label: "", tiles: [] },
  { kind: "approach", label: "", tiles: [] },
];

/** Rows in the order the table shows them: the chosen row first, then by the metric (best first). A row with no figure goes last. */
export function sortedRows(rows: readonly ComparisonRow[], metric: Metric | null): ComparisonRow[] {
  const lower = metric ? LOWER_IS_BETTER.includes(metric.id) : false;
  const rank = (row: ComparisonRow): number => (row.outcome === "chosen" ? 0 : 1);
  return [...rows].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (!a.value && !b.value) return 0;
    if (!a.value) return 1;
    if (!b.value) return -1;
    return lower ? a.value.value - b.value.value : b.value.value - a.value.value;
  });
}

/** 0.972 is "0.972", 0.98 is "0.98", 1 is "1". */
export const metricValue = (value: number): string => String(Math.round(value * 1000) / 1000);

/** "$0.0005 per item", with the row's own currency. */
export function costWords(cost: MeasuredCost, noun = "item"): string {
  const sign = cost.currency === "USD" ? "$" : "£";
  const text = cost.cost >= 0.01 || cost.cost === 0 ? cost.cost.toFixed(2) : cost.cost.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".00");
  return `about ${sign}${text} per ${noun}`;
}

/** A point of the accuracy-against-cost chart: only rows with both. Rows in different currencies are not charted together. */
export function chartPoints(rows: readonly ComparisonRow[]): { label: string; value: number; cost: number; outcome?: Outcome; currency: "USD" | "GBP" }[] {
  const priced = rows.flatMap((row) => (row.value && row.costPerItem ? [{ label: row.label, value: row.value.value, cost: row.costPerItem.cost, currency: row.costPerItem.currency, ...(row.outcome ? { outcome: row.outcome } : null) }] : []));
  const first = priced[0]?.currency;
  return priced.filter((point) => point.currency === first);
}

/** The words a figure's source is shown with. */
export const figureSourceWord = (source: FigureSource): string => SOURCE_WORD[source];

/** A text summary of the chart for screen readers: the bars themselves are hidden. */
export function chartSummary(rows: readonly ComparisonRow[], metric: Metric | null): string {
  const points = chartPoints(rows);
  const name = metric ? metricName(metric) : "Metric";
  return points.length === 0 ? "" : `${name} against cost per item: ${points.map((point) => `${point.label} ${metricValue(point.value)} at ${point.cost}`).join("; ")}.`;
}

/* ── the controlled experiment ── */

export const RUNS_PER_ARM_MIN = 1;
export const RUNS_PER_ARM_MAX = 100;
export const VARIED_MAX = 80;

export interface Design {
  /** The label of the control row. */
  control: string;
  varied: string;
  runsPerArm: number;
  freshContext: boolean;
}

export function designOf(raw: unknown): Design | null {
  if (!isRecord(raw)) return null;
  const control = clean(raw.control, ROW_LABEL_MAX);
  const varied = clean(raw.varied, VARIED_MAX);
  const runs = whole(raw.runs_per_arm, RUNS_PER_ARM_MIN, RUNS_PER_ARM_MAX);
  if (!control || !varied || runs === null) return null;
  return { control, varied, runsPerArm: runs, freshContext: raw.fresh_context === true };
}

/** "Control: no AGENTS.md. Varied: AGENTS.md present. 10 runs per arm, each in a fresh context." */
export const designLine = (design: Design): string =>
  `Control: ${design.control}. Varied: ${design.varied}. ${design.runsPerArm} ${design.runsPerArm === 1 ? "run" : "runs"} per arm${design.freshContext ? ", each in a fresh context" : ""}.`;

/** The tiles a row can name, and the kind of the tile under test: for the Check window. Pure; `Step` is a type here only. */
export function evalChoicesOf(steps: readonly { id: string; number: string; kind: string; title: string | null; defaultTitle: string; decision?: { questions: readonly { type: QuestionType }[] } | null }[], testedId: string | null | undefined): { testedKind: TestedKind; tiles: { id: string; label: string }[] } {
  const tested = steps.find((step) => step.id === testedId);
  return {
    testedKind: testedKindOf(tested ?? null),
    tiles: steps.filter((step) => step.kind !== "check" && step.kind !== "prompt" && step.kind !== "manual" && step.kind !== "file").map((step) => ({ id: step.id, label: `${step.number} · ${step.title ?? step.defaultTitle}` })),
  };
}

/* ── a Check's comparison, together ── */

export interface Comparison {
  testSet?: TestSet;
  metric?: Metric;
  rows: ComparisonRow[];
  design?: Design;
}

export function comparisonOf(payload: Raw): Comparison {
  const testSet = testSetOf(payload.test_set);
  const metric = metricOf(payload.metric);
  const design = designOf(payload.design);
  return { ...(testSet ? { testSet } : null), ...(metric ? { metric } : null), rows: rowsOf(payload.rows), ...(design ? { design } : null) };
}

/** Whether a Check's payload holds any of the comparison's keys. */
export const hasComparison = (payload: Raw): boolean => ["test_set", "metric", "rows", "design"].some((key) => payload[key] !== undefined && payload[key] !== null);

/** For `setExtras`: what needs the Check's other keys. Rows belong to a comparison of approaches; a design's control is one of the rows. */
export function comparisonPatchRefusal(payload: Raw, patch: Raw): string | null {
  const merged = { ...payload, ...patch };
  const rows = rowsOf(merged.rows);
  if ("rows" in patch && rows.length > 0) {
    const scoring = isRecord(merged.scoring) ? merged.scoring.how : null;
    if (scoring !== "ab") return "Rows are for a comparison of approaches.";
  }
  if (("design" in patch || "rows" in patch) && designOf(merged.design)) {
    const design = designOf(merged.design) as Design;
    if (!rows.some((row) => row.label === design.control)) return "The control is one of the rows.";
  }
  return null;
}

/** The payload for a testSet / metric / rows / design, as `setExtras` stores them. */
export function testSetPayload(set: TestSet): Json {
  return {
    size: set.size,
    labelled_by: set.labelledBy,
    ...(set.labelledAt ? { labelled_at: set.labelledAt } : null),
    ...(set.drawnFrom ? { drawn_from: set.drawnFrom } : null),
    ...(set.traceTag ? { trace_tag: set.traceTag } : null),
    ...(set.file ? { file: set.file } : null),
  };
}

export function rowsPayload(rows: readonly ComparisonRow[]): Json {
  return rows.map((row) => ({
    kind: row.kind,
    label: row.label,
    tiles: row.tiles,
    ...(row.value ? { value: row.value } : null),
    ...(row.costPerItem ? { cost_per_item: row.costPerItem } : null),
    ...(row.outcome ? { outcome: row.outcome } : null),
    ...(row.reason ? { reason: row.reason } : null),
    ...(row.evidence ? { evidence: row.evidence } : null),
  })) as unknown as Json;
}

registerCleaners("eval_run", {
  test_set: (value) => {
    if (value === null || value === undefined) return null;
    const set = testSetOf(value);
    if (!set) {
      const size = isRecord(value) ? value.size : undefined;
      throw new Error(whole(size, 1, TEST_SET_SIZE_MAX) === null ? "Test set size: a whole number of items" : "Test set: who labelled it, the maker, annotators, existing labels or users");
    }
    if (isRecord(value) && clean(value.labelled_at) && !set.labelledAt) throw new Error("Labelled: 2026-10");
    if (isRecord(value) && clean(value.trace_tag).length > TRACE_TAG_MAX) throw new Error(`Trace tag: ${TRACE_TAG_MAX} characters max`);
    if (isRecord(value) && clean(value.file).length > TEST_FILE_MAX) throw new Error(`File: ${TEST_FILE_MAX} characters max`);
    return testSetPayload(set);
  },
  metric: (value) => {
    if (value === null || value === undefined) return null;
    const metric = metricOf(value);
    if (!metric) throw new Error(`Custom metric: a name and a unit, ${CUSTOM_METRIC_MAX} characters max each`);
    return metric.id === "custom" ? ({ id: "custom", name: metric.name, unit: metric.unit } as Json) : ({ id: metric.id } as Json);
  },
  rows: (value) => {
    if (value === null || value === undefined) return null;
    const raw = Array.isArray(value) ? value : [];
    const rows = rowsOf(raw);
    if (rows.length !== raw.length && raw.length > 0) throw new Error("Each row needs a label.");
    const why = rowsRefusal(rows);
    if (why) throw new Error(why);
    return rows.length > 0 ? rowsPayload(rows) : null;
  },
  design: (value) => {
    if (value === null || value === undefined) return null;
    const design = designOf(value);
    if (!design) throw new Error(`Design: the control, what was varied, and ${RUNS_PER_ARM_MIN} to ${RUNS_PER_ARM_MAX} runs per arm`);
    return { control: design.control, varied: design.varied, runs_per_arm: design.runsPerArm, fresh_context: design.freshContext } as Json;
  },
});
