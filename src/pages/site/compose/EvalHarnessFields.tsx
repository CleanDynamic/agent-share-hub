/* SV-29 P3, P4: the Check window's fields for a comparison of approaches and for the eval harness.

   Its own chunk: Add › Check loads it with the window, not with the composer. Every field is Optional and on demand (CA-28's
   pattern). The component holds no state of its own but each list's typed text: what it edits is `extras`, the Check's payload keys in
   the shape they are stored in, cleaned by the extras writer when the window saves. A key set to null takes it off.

   Part 3 (here): the test set, the metric (defaulting from the question type of the tile under test), the approaches table and the
   design of a controlled experiment. Part 4 adds, under a section headed Eval harness: where the cases came from, failure types,
   graders, runs per case and the CI gate. It never runs anything. */

import { useState, type ReactNode } from "react";

import {
  CUSTOM_METRIC_MAX,
  DRAWN_FROM,
  DRAWN_FROM_LABEL,
  LABELLED_BY,
  LABELLED_BY_LABEL,
  METRIC_LABEL,
  OUTCOMES_FOR,
  OUTCOME_LABEL,
  ROWS_MAX,
  ROW_KINDS,
  ROW_KIND_LABEL,
  ROW_LABEL_MAX,
  ROW_REASON_MAX,
  RUNS_PER_ARM_MAX,
  RUNS_PER_ARM_MIN,
  TEST_FILE_MAX,
  TRACE_TAG_MAX,
  VARIED_MAX,
  blankRows,
  defaultMetric,
  designOf,
  metricChoices,
  metricOf,
  rowsOf,
  rowsPayload,
  testSetOf,
  type ComparisonRow,
  type DrawnFrom,
  type LabelledBy,
  type MetricId,
  type Outcome,
  type RowKind,
  type TestedKind,
} from "@/lib/build/comparison";
import type { FigureSource } from "@/lib/build/pipelineFields";

import {
  CRITERIA_MAX,
  FAILURE_NAME_MAX,
  FAILURE_NOTE_MAX,
  FAILURE_TYPES_MAX,
  FIX_IN,
  FIX_IN_LABEL,
  FRAMEWORK_MAX,
  GATE_CUSTOM_MAX,
  GATE_ON,
  GATE_ON_LABEL,
  GATE_PATHS_MAX,
  GATE_REJECTED_MAX,
  GATE_REJECTED_RULE_MAX,
  GATE_REJECTED_WHY_MAX,
  GATE_RULES,
  GATE_RULE_LABEL,
  GATE_RUNS_IN_MAX,
  GRADERS_MAX,
  GRADER_KINDS,
  GRADER_KIND_LABEL,
  GRADER_NAME_MAX,
  RUNS_PER_CASE_MAX,
  SEES,
  SEES_LABEL,
  failureCountLine,
  failureTypesOf,
  gateOf,
  gateRuleClause,
  gradersOf,
  type FixIn,
  type GateOn,
  type GateRuleKind,
  type GraderKind,
  type Sees,
} from "@/lib/build/evalHarness";

import { FieldArea, FieldInput, Hint, Inline, OptionGrid, PANEL_LIST, Panel, RecipeButton, SegmentedField, TextLink, NARROW } from "./modalRecipes";
import { ModelPicker } from "./ModelPicker";
import { OptionalField, summaryOf } from "./OptionalSection";
import { PickMenu } from "./PickMenu";

export const EVAL_COPY = {
  testSet: "Test set",
  testSetLine: "How many items, and who labelled them",
  size: "Number of items",
  labelledBy: "Labelled by",
  labelledAt: "Labelled in",
  labelledAtHint: "2026-10",
  metric: "Metric",
  metricLine: "What the comparison measures",
  customName: "Metric name",
  customUnit: "Unit",
  rows: "Approaches",
  rowsLine: "Two or more, measured on the same test set",
  addRow: "Add a row",
  design: "Controlled experiment",
  designLine: "A control, one thing varied, runs per arm",
  control: "Control",
  varied: "What was varied",
  variedHint: "AGENTS.md present",
  runsPerArm: "Runs per arm",
  freshContext: "Each run in a fresh context",
  drawnFrom: "Where the test cases came from",
  traceTag: "Trace tag",
  file: "Test cases file",
} as const;

export type Extras = Record<string, unknown>;

/** The tile under test and the tiles a row can name: each by its node id. */
export interface EvalChoices {
  testedKind: TestedKind;
  tiles: readonly { id: string; label: string }[];
}

export interface EvalFieldsProps {
  extras: Extras;
  onChange: (next: Extras) => void;
  phone: boolean;
  /** The Check's scoring method: rows belong to a comparison of approaches. */
  comparing: boolean;
  choices: EvalChoices;
}

const digits = (raw: string): string => raw.replace(/[^0-9]/g, "");
const decimal = (raw: string): string => raw.replace(/[^0-9.]/g, "");
const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** A row as typed. */
interface RowDraft {
  kind: RowKind;
  label: string;
  tiles: string[];
  value: string;
  valueSource: FigureSource;
  cost: string;
  costSource: FigureSource;
  outcome: Outcome | "";
  reason: string;
}

const draftOfRow = (row: ComparisonRow): RowDraft => ({
  kind: row.kind,
  label: row.label,
  tiles: row.tiles,
  value: row.value ? String(row.value.value) : "",
  valueSource: row.value?.source ?? "maker",
  cost: row.costPerItem ? String(row.costPerItem.cost) : "",
  costSource: row.costPerItem?.source ?? "maker",
  outcome: row.outcome ?? "",
  reason: row.reason ?? "",
});

const rowOfDraft = (draft: RowDraft): ComparisonRow => {
  const value = draft.value.trim() === "" ? null : Number(draft.value);
  const cost = draft.cost.trim() === "" ? null : Number(draft.cost);
  return {
    kind: draft.kind,
    label: draft.label.trim(),
    tiles: draft.tiles,
    ...(value !== null && Number.isFinite(value) ? { value: { value, source: draft.valueSource } } : null),
    ...(cost !== null && Number.isFinite(cost) ? { costPerItem: { cost, currency: "USD" as const, source: draft.costSource } } : null),
    ...(draft.outcome ? { outcome: draft.outcome } : null),
    ...(draft.reason.trim() ? { reason: draft.reason.trim() } : null),
  };
};

const SOURCES = [{ value: "run" as const, label: "From the run" }, { value: "maker" as const, label: "Maker's figure" }];

/** The rows editor: starts from the stored rows, or two empty ones for a comparison that has none. */
function RowsEditor({ rows, onChange, phone, tiles }: { rows: ComparisonRow[]; onChange: (rows: ComparisonRow[]) => void; phone: boolean; tiles: EvalChoices["tiles"] }) {
  const [drafts, setDrafts] = useState<RowDraft[]>(() => (rows.length > 0 ? rows : blankRows()).map(draftOfRow));
  const push = (next: RowDraft[]) => {
    setDrafts(next);
    // Rows without a label are not saved; the writer says why a half-made row cannot be.
    onChange(next.filter((draft) => draft.label.trim() || draft.value || draft.cost || draft.outcome).map(rowOfDraft));
  };
  const edit = (at: number, patch: Partial<RowDraft>) => push(drafts.map((draft, i) => (i === at ? { ...draft, ...patch, ...(patch.kind && patch.kind !== draft.kind ? { outcome: "" as const } : null) } : draft)));
  return (
    <>
      {drafts.map((draft, at) => (
        <Panel key={at} label={`Row ${at + 1}`} padding="10px 14px 14px">
          <div style={PANEL_LIST} data-testid="comparison-row-editor">
            <SegmentedField<RowKind> label={`Kind of row ${at + 1}`} phone={phone} items={ROW_KINDS.map((value) => ({ value, label: ROW_KIND_LABEL[value] }))} value={draft.kind} onChange={(kind) => edit(at, { kind })} />
            <FieldInput phone={phone} aria-label={`Label of row ${at + 1}`} maxLength={ROW_LABEL_MAX} value={draft.label} placeholder="Retrieval, then the decision model picks" onChange={(event) => edit(at, { label: event.target.value })} />
            {tiles.length > 0 ? (
              <OptionGrid<string> label={`Tiles that make up row ${at + 1}`} phone={phone} multiple columns={2} items={tiles.map((tile) => ({ value: tile.id, label: tile.label }))} chosen={draft.tiles} onPick={(id) => edit(at, { tiles: draft.tiles.includes(id) ? draft.tiles.filter((other) => other !== id) : [...draft.tiles, id] })} />
            ) : null}
            <Inline>
              <FieldInput phone={phone} mono width={NARROW.date} aria-label={`Result of row ${at + 1}`} inputMode="decimal" value={draft.value} placeholder="0.972" onChange={(event) => edit(at, { value: decimal(event.target.value) })} />
              <SegmentedField<"run" | "maker"> label={`Where the result of row ${at + 1} came from`} phone={phone} items={SOURCES} value={draft.valueSource === "run" ? "run" : "maker"} onChange={(valueSource) => edit(at, { valueSource })} />
            </Inline>
            <Inline>
              <FieldInput phone={phone} mono width={NARROW.date} aria-label={`Cost per item of row ${at + 1}, dollars`} inputMode="decimal" value={draft.cost} placeholder="0.0005" onChange={(event) => edit(at, { cost: decimal(event.target.value) })} />
              <SegmentedField<"run" | "maker"> label={`Where the cost of row ${at + 1} came from`} phone={phone} items={SOURCES} value={draft.costSource === "run" ? "run" : "maker"} onChange={(costSource) => edit(at, { costSource })} />
            </Inline>
            <SegmentedField<Outcome | "none"> label={`Outcome of row ${at + 1}`} phone={phone} items={[{ value: "none", label: "Not decided" }, ...OUTCOMES_FOR[draft.kind].map((value) => ({ value, label: OUTCOME_LABEL[value] }))]} value={draft.outcome || "none"} onChange={(next) => edit(at, { outcome: next === "none" ? "" : next })} />
            {draft.outcome === "rejected" || draft.outcome === "ruled out" ? (
              <FieldInput phone={phone} aria-label={`Why row ${at + 1} was ${draft.outcome}`} maxLength={ROW_REASON_MAX} value={draft.reason} placeholder="Over 2,000 times the cost" onChange={(event) => edit(at, { reason: event.target.value })} />
            ) : null}
            {drafts.length > 2 ? (
              <Inline>
                <TextLink phone={phone} aria-label={`Remove row ${at + 1}`} onClick={() => push(drafts.filter((_, i) => i !== at))}>
                  Remove
                </TextLink>
              </Inline>
            ) : null}
          </div>
        </Panel>
      ))}
      <Inline>
        <RecipeButton small phone={phone} disabled={drafts.length >= ROWS_MAX} onClick={() => push([...drafts, draftOfRow({ kind: "approach", label: "", tiles: [] })])}>
          {EVAL_COPY.addRow}
        </RecipeButton>
      </Inline>
    </>
  );
}

/** The comparison's fields, as Optional fields of the Check window: the test set, the metric, the rows and the design. */
export function comparisonFields({ extras, onChange, phone, comparing, choices }: EvalFieldsProps): ReactNode[] {
  const set = (key: string, value: unknown) => onChange({ ...extras, [key]: value });
  const testSet = testSetOf(extras.test_set);
  const raw = asRecord(extras.test_set);
  const setTestSet = (patch: Record<string, unknown>) => {
    const next = { ...raw, ...patch };
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== "" && value !== undefined));
    set("test_set", Object.keys(cleaned).length > 0 ? cleaned : null);
  };
  const metric = metricOf(extras.metric) ?? null;
  const shownMetric = metric ?? defaultMetric(choices.testedKind);
  const rows = rowsOf(extras.rows);
  const design = designOf(extras.design);
  const designRaw = asRecord(extras.design);
  const setDesign = (patch: Record<string, unknown>) => set("design", { ...designRaw, ...patch });
  const out: ReactNode[] = [
    <OptionalField key="test_set" name={EVAL_COPY.testSet} description={EVAL_COPY.testSetLine} summary={summaryOf(testSet ? `${testSet.size.toLocaleString("en-GB")} items` : null, testSet ? LABELLED_BY_LABEL[testSet.labelledBy] : null)} phone={phone}>
      <FieldInput phone={phone} mono width={NARROW.date} aria-label={EVAL_COPY.size} inputMode="numeric" maxLength={9} value={raw.size === undefined ? "" : String(raw.size)} placeholder="1000" onChange={(event) => setTestSet({ size: event.target.value === "" ? "" : Number(digits(event.target.value)) })} />
      <SegmentedField<LabelledBy> label={EVAL_COPY.labelledBy} phone={phone} items={LABELLED_BY.map((value) => ({ value, label: LABELLED_BY_LABEL[value] }))} value={LABELLED_BY.includes(raw.labelled_by as LabelledBy) ? (raw.labelled_by as LabelledBy) : null} onChange={(next) => setTestSet({ labelled_by: next })} />
      <FieldInput phone={phone} mono width={NARROW.date} aria-label={EVAL_COPY.labelledAt} maxLength={7} value={typeof raw.labelled_at === "string" ? raw.labelled_at : ""} placeholder={EVAL_COPY.labelledAtHint} onChange={(event) => setTestSet({ labelled_at: event.target.value.replace(/[^0-9-]/g, "") })} />
      <SegmentedField<DrawnFrom> label={EVAL_COPY.drawnFrom} phone={phone} items={DRAWN_FROM.map((value) => ({ value, label: DRAWN_FROM_LABEL[value] }))} value={DRAWN_FROM.includes(raw.drawn_from as DrawnFrom) ? (raw.drawn_from as DrawnFrom) : null} onChange={(next) => setTestSet({ drawn_from: raw.drawn_from === next ? "" : next, ...(next !== "real_traffic" ? { trace_tag: "" } : null) })} />
      {raw.drawn_from === "real_traffic" ? <FieldInput phone={phone} mono width={NARROW.value} aria-label={EVAL_COPY.traceTag} maxLength={TRACE_TAG_MAX} value={typeof raw.trace_tag === "string" ? raw.trace_tag : ""} placeholder="customer" onChange={(event) => setTestSet({ trace_tag: event.target.value })} /> : null}
      <FieldInput phone={phone} mono aria-label={EVAL_COPY.file} maxLength={TEST_FILE_MAX} value={typeof raw.file === "string" ? raw.file : ""} placeholder="harness/goldens.json" onChange={(event) => setTestSet({ file: event.target.value })} />
    </OptionalField>,
    <OptionalField key="metric" name={EVAL_COPY.metric} description={EVAL_COPY.metricLine} summary={summaryOf(metric ? (metric.id === "custom" ? `${metric.name} (${metric.unit})` : METRIC_LABEL[metric.id]) : null)} phone={phone}>
      <SegmentedField<MetricId> label={EVAL_COPY.metric} phone={phone} items={metricChoices(choices.testedKind).map((value) => ({ value, label: METRIC_LABEL[value] }))} value={shownMetric.id} onChange={(id) => set("metric", id === "custom" ? { id, name: asRecord(extras.metric).name ?? "", unit: asRecord(extras.metric).unit ?? "" } : { id })} />
      {shownMetric.id === "custom" || asRecord(extras.metric).id === "custom" ? (
        <Inline>
          <FieldInput phone={phone} aria-label={EVAL_COPY.customName} maxLength={CUSTOM_METRIC_MAX} value={String(asRecord(extras.metric).name ?? "")} placeholder="Tone match" onChange={(event) => set("metric", { ...asRecord(extras.metric), id: "custom", name: event.target.value })} />
          <FieldInput phone={phone} width={NARROW.date} aria-label={EVAL_COPY.customUnit} maxLength={CUSTOM_METRIC_MAX} value={String(asRecord(extras.metric).unit ?? "")} placeholder="points" onChange={(event) => set("metric", { ...asRecord(extras.metric), id: "custom", unit: event.target.value })} />
        </Inline>
      ) : null}
      {!metric ? <Hint>{`Reads as ${METRIC_LABEL[shownMetric.id]} for this question type until you pick one`}</Hint> : null}
    </OptionalField>,
  ];
  if (comparing) {
    out.push(
      <OptionalField key="rows" name={EVAL_COPY.rows} description={EVAL_COPY.rowsLine} summary={summaryOf(rows.map((row) => row.label))} phone={phone}>
        <RowsEditor rows={rows} tiles={choices.tiles} phone={phone} onChange={(next) => set("rows", next.length > 0 ? JSON.parse(JSON.stringify(rowsPayload(next))) : null)} />
      </OptionalField>,
      <OptionalField key="design" name={EVAL_COPY.design} description={EVAL_COPY.designLine} summary={summaryOf(design ? `${design.runsPerArm} runs per arm` : null)} phone={phone}>
        <PickMenu field label={EVAL_COPY.control} phone={phone} placeholder="The control row" value={typeof designRaw.control === "string" ? designRaw.control : null} options={rows.map((row) => ({ value: row.label, label: row.label }))} onChange={(next) => setDesign({ control: next })} />
        <FieldInput phone={phone} aria-label={EVAL_COPY.varied} maxLength={VARIED_MAX} value={typeof designRaw.varied === "string" ? designRaw.varied : ""} placeholder={EVAL_COPY.variedHint} onChange={(event) => setDesign({ varied: event.target.value })} />
        <Inline>
          <FieldInput phone={phone} mono width={NARROW.date} aria-label={EVAL_COPY.runsPerArm} inputMode="numeric" maxLength={3} value={designRaw.runs_per_arm === undefined ? "" : String(designRaw.runs_per_arm)} placeholder="10" onChange={(event) => setDesign({ runs_per_arm: event.target.value === "" ? undefined : Number(digits(event.target.value)) })} />
          <SegmentedField<"fresh" | "shared"> label={EVAL_COPY.freshContext} phone={phone} items={[{ value: "fresh", label: EVAL_COPY.freshContext }, { value: "shared", label: "Shared history" }]} value={designRaw.fresh_context === true ? "fresh" : "shared"} onChange={(next) => setDesign({ fresh_context: next === "fresh" })} />
        </Inline>
        <Hint>{`${RUNS_PER_ARM_MIN} to ${RUNS_PER_ARM_MAX} runs per arm`}</Hint>
      </OptionalField>,
    );
  }
  return out;
}

/* ── Part 4: the eval harness ── */

const TAG = "Eval harness";

/** One failure type as typed. */
interface FailureDraft {
  name: string;
  count: string;
  read: string;
  fix_in: FixIn | "";
  note: string;
}

function FailureTypesEditor({ value, onChange, phone }: { value: unknown; onChange: (next: unknown[] | null) => void; phone: boolean }) {
  const [rows, setRows] = useState<FailureDraft[]>(() => (Array.isArray(value) ? value : []).map((entry) => {
    const e = asRecord(entry);
    return { name: String(e.name ?? ""), count: e.count === undefined ? "" : String(e.count), read: e.read === undefined ? "" : String(e.read), fix_in: FIX_IN.includes(e.fix_in as FixIn) ? (e.fix_in as FixIn) : "", note: String(e.note ?? "") };
  }));
  const push = (next: FailureDraft[]) => {
    setRows(next);
    const kept = next.filter((row) => row.name.trim() || row.count || row.read);
    onChange(kept.length === 0 ? null : kept.map((row) => ({ name: row.name.trim(), count: row.count === "" ? Number.NaN : Number(row.count), read: row.read === "" ? Number.NaN : Number(row.read), fix_in: row.fix_in, ...(row.note.trim() ? { note: row.note.trim() } : null) })));
  };
  const edit = (at: number, patch: Partial<FailureDraft>) => push(rows.map((row, i) => (i === at ? { ...row, ...patch } : row)));
  return (
    <>
      {rows.map((row, at) => (
        <Panel key={at} label={`Failure type ${at + 1}`} padding="10px 14px 14px">
          <div style={PANEL_LIST} data-testid="failure-type-editor">
            <FieldInput phone={phone} aria-label={`Name of failure type ${at + 1}`} maxLength={FAILURE_NAME_MAX} value={row.name} placeholder="Wrong policy decision" onChange={(event) => edit(at, { name: event.target.value })} />
            <Inline>
              <FieldInput phone={phone} mono width={NARROW.count} aria-label={`Cases that showed failure type ${at + 1}`} inputMode="numeric" maxLength={5} value={row.count} placeholder="5" onChange={(event) => edit(at, { count: digits(event.target.value) })} />
              <span>of</span>
              <FieldInput phone={phone} mono width={NARROW.count} aria-label={`Cases read for failure type ${at + 1}`} inputMode="numeric" maxLength={5} value={row.read} placeholder="20" onChange={(event) => edit(at, { read: digits(event.target.value) })} />
            </Inline>
            <PickMenu field label={`Where failure type ${at + 1} is fixed`} phone={phone} placeholder="Where it is fixed" value={row.fix_in || null} options={FIX_IN.map((value) => ({ value, label: FIX_IN_LABEL[value] }))} onChange={(fix_in) => edit(at, { fix_in })} />
            {row.fix_in === "people" ? <FieldInput phone={phone} aria-label={`Note on failure type ${at + 1}`} maxLength={FAILURE_NOTE_MAX} value={row.note} placeholder="No help-centre page covers damaged items" onChange={(event) => edit(at, { note: event.target.value })} /> : null}
            <Inline>
              <TextLink phone={phone} aria-label={`Remove failure type ${at + 1}`} onClick={() => push(rows.filter((_, i) => i !== at))}>
                Remove
              </TextLink>
            </Inline>
          </div>
        </Panel>
      ))}
      <Inline>
        <RecipeButton small phone={phone} disabled={rows.length >= FAILURE_TYPES_MAX} onClick={() => push([...rows, { name: "", count: "", read: "", fix_in: "", note: "" }])}>
          Add a failure type
        </RecipeButton>
      </Inline>
    </>
  );
}

interface GraderDraft {
  name: string;
  kind: GraderKind;
  criteria: string;
  sees: Sees[];
  threshold: string;
  covers: string[];
  good: string;
  bad: string;
  correct: boolean;
  tested: boolean;
}

function GradersEditor({ value, onChange, phone, failureNames }: { value: unknown; onChange: (next: unknown[] | null) => void; phone: boolean; failureNames: readonly string[] }) {
  const [rows, setRows] = useState<GraderDraft[]>(() => gradersOf(value).map((grader) => ({ name: grader.name, kind: grader.kind, criteria: grader.criteria ?? "", sees: grader.sees, threshold: grader.threshold === undefined ? "" : String(grader.threshold), covers: grader.covers, good: grader.validated ? String(grader.validated.good) : "", bad: grader.validated ? String(grader.validated.bad) : "", correct: grader.validated?.correct ?? true, tested: Boolean(grader.validated) })));
  const push = (next: GraderDraft[]) => {
    setRows(next);
    onChange(next.length === 0 ? null : next.map((row) => ({
      name: row.name.trim(),
      kind: row.kind,
      ...(row.kind === "llm_judge" || row.criteria.trim() ? { criteria: row.criteria.trim() } : null),
      sees: row.sees,
      ...(row.threshold.trim() ? { threshold: Number(row.threshold) } : null),
      covers: row.covers,
      ...(row.tested ? { validated: { good: Number(row.good || 0), bad: Number(row.bad || 0), correct: row.correct } } : null),
    })));
  };
  const edit = (at: number, patch: Partial<GraderDraft>) => push(rows.map((row, i) => (i === at ? { ...row, ...patch, ...(patch.kind && patch.kind !== "llm_judge" ? { criteria: "" } : null) } : row)));
  return (
    <>
      {rows.map((row, at) => (
        <Panel key={at} label={`Grader ${at + 1}`} padding="10px 14px 14px">
          <div style={PANEL_LIST} data-testid="grader-editor">
            <FieldInput phone={phone} aria-label={`Name of grader ${at + 1}`} maxLength={GRADER_NAME_MAX} value={row.name} placeholder="Policy correct" onChange={(event) => edit(at, { name: event.target.value })} />
            <SegmentedField<GraderKind> label={`Kind of grader ${at + 1}`} phone={phone} items={GRADER_KINDS.map((value) => ({ value, label: GRADER_KIND_LABEL[value] }))} value={row.kind} onChange={(kind) => edit(at, { kind })} />
            {row.kind === "llm_judge" ? <FieldArea phone={phone} rows={3} aria-label={`Criteria of grader ${at + 1}`} maxLength={CRITERIA_MAX} value={row.criteria} placeholder="Does the answer apply the policy the reference states?" onChange={(event) => edit(at, { criteria: event.target.value })} /> : null}
            <OptionGrid<Sees> label={`What grader ${at + 1} sees`} phone={phone} multiple columns={2} items={SEES.map((value) => ({ value, label: SEES_LABEL[value][0].toUpperCase() + SEES_LABEL[value].slice(1) }))} chosen={row.sees} onPick={(value) => edit(at, { sees: row.sees.includes(value) ? row.sees.filter((other) => other !== value) : SEES.filter((item) => item === value || row.sees.includes(item)) })} />
            <FieldInput phone={phone} mono width={NARROW.date} aria-label={`Threshold of grader ${at + 1}`} inputMode="decimal" maxLength={5} value={row.threshold} placeholder="0.7" onChange={(event) => edit(at, { threshold: decimal(event.target.value) })} />
            {failureNames.length > 0 ? <OptionGrid<string> label={`Failure types grader ${at + 1} covers`} phone={phone} multiple columns={2} items={failureNames.map((name) => ({ value: name, label: name }))} chosen={row.covers} onPick={(name) => edit(at, { covers: row.covers.includes(name) ? row.covers.filter((other) => other !== name) : [...row.covers, name] })} /> : null}
            <SegmentedField<"yes" | "no"> label={`Was grader ${at + 1} tested on good and bad cases`} phone={phone} items={[{ value: "yes", label: "Tested on good and bad cases" }, { value: "no", label: "Not tested" }]} value={row.tested ? "yes" : "no"} onChange={(next) => edit(at, { tested: next === "yes" })} />
            {row.tested ? (
              <Inline>
                <FieldInput phone={phone} mono width={NARROW.count} aria-label={`Good cases for grader ${at + 1}`} inputMode="numeric" maxLength={4} value={row.good} placeholder="3" onChange={(event) => edit(at, { good: digits(event.target.value) })} />
                <span>good</span>
                <FieldInput phone={phone} mono width={NARROW.count} aria-label={`Bad cases for grader ${at + 1}`} inputMode="numeric" maxLength={4} value={row.bad} placeholder="3" onChange={(event) => edit(at, { bad: digits(event.target.value) })} />
                <span>bad</span>
                <SegmentedField<"right" | "wrong"> label={`Did grader ${at + 1} judge them rightly`} phone={phone} items={[{ value: "right", label: "Judged rightly" }, { value: "wrong", label: "Judged some wrongly" }]} value={row.correct ? "right" : "wrong"} onChange={(next) => edit(at, { correct: next === "right" })} />
              </Inline>
            ) : null}
            <Inline>
              <TextLink phone={phone} aria-label={`Remove grader ${at + 1}`} onClick={() => push(rows.filter((_, i) => i !== at))}>
                Remove
              </TextLink>
            </Inline>
          </div>
        </Panel>
      ))}
      <Inline>
        <RecipeButton small phone={phone} disabled={rows.length >= GRADERS_MAX} onClick={() => push([...rows, { name: "", kind: "llm_judge", criteria: "", sees: ["question", "answer"], threshold: "", covers: [], good: "", bad: "", correct: true, tested: false }])}>
          Add a grader
        </RecipeButton>
      </Inline>
    </>
  );
}

function GateEditor({ value, onChange, phone }: { value: unknown; onChange: (next: Record<string, unknown> | null) => void; phone: boolean }) {
  const raw = asRecord(value);
  const rule = asRecord(raw.rule);
  const rejected = (Array.isArray(raw.rejected) ? raw.rejected : []).map((entry) => ({ rule: String(asRecord(entry).rule ?? ""), why: String(asRecord(entry).why ?? "") }));
  const minutes = asRecord(raw.minutes);
  const cost = asRecord(raw.cost_per_run);
  const emit = (patch: Record<string, unknown>) => {
    const next = { ...raw, ...patch };
    for (const key of Object.keys(next)) if (next[key] === undefined || next[key] === "") delete next[key];
    onChange(Object.keys(next).length > 0 ? next : null);
  };
  const setRule = (patch: Record<string, unknown>) => emit({ rule: { ...rule, ...patch } });
  const setRejected = (next: { rule: string; why: string }[]) => emit({ rejected: next.length > 0 ? next : undefined });
  return (
    <div style={PANEL_LIST} data-testid="gate-editor">
      <FieldInput phone={phone} aria-label="Where the gate runs" maxLength={GATE_RUNS_IN_MAX} value={String(raw.runs_in ?? "")} placeholder="GitHub Actions" onChange={(event) => emit({ runs_in: event.target.value })} />
      <PickMenu field label="When the gate runs" phone={phone} placeholder="When it runs" value={GATE_ON.includes(raw.on as GateOn) ? (raw.on as GateOn) : null} options={GATE_ON.map((value) => ({ value, label: GATE_ON_LABEL[value][0].toUpperCase() + GATE_ON_LABEL[value].slice(1) }))} onChange={(on) => emit({ on })} />
      <FieldInput phone={phone} mono aria-label="Paths that start the gate" maxLength={GATE_PATHS_MAX} value={String(raw.paths ?? "")} placeholder="src/prompts/**" onChange={(event) => emit({ paths: event.target.value })} />
      <PickMenu field label="The gate's rule" phone={phone} placeholder="Its rule" value={GATE_RULES.includes(rule.kind as GateRuleKind) ? (rule.kind as GateRuleKind) : null} options={GATE_RULES.map((value) => ({ value, label: GATE_RULE_LABEL[value] }))} onChange={(kind) => emit({ rule: { kind } })} />
      {rule.kind === "pass_rate_below" ? <FieldInput phone={phone} mono width={NARROW.date} aria-label="Pass rate below" inputMode="decimal" maxLength={5} value={rule.value === undefined ? "" : String(rule.value)} placeholder="0.9" onChange={(event) => setRule({ value: event.target.value === "" ? undefined : Number(decimal(event.target.value)) })} /> : null}
      {rule.kind === "custom" ? <FieldInput phone={phone} aria-label="Your rule" maxLength={GATE_CUSTOM_MAX} value={String(rule.text ?? "")} placeholder="Fails when the pass rate drops 5 points" onChange={(event) => setRule({ text: event.target.value })} /> : null}
      <Inline>
        <FieldInput phone={phone} mono width={NARROW.count} aria-label="Runs per check" inputMode="numeric" maxLength={2} value={raw.runs === undefined ? "" : String(raw.runs)} placeholder="3" onChange={(event) => emit({ runs: event.target.value === "" ? undefined : Number(digits(event.target.value)) })} />
        <span>runs</span>
        <SegmentedField<"fails" | "ignored"> label="A missing result" phone={phone} items={[{ value: "fails", label: "A missing result fails" }, { value: "ignored", label: "A missing result is ignored" }]} value={raw.missing_result_fails === true ? "fails" : "ignored"} onChange={(next) => emit({ missing_result_fails: next === "fails" })} />
      </Inline>
      <Inline>
        <FieldInput phone={phone} mono width={NARROW.date} aria-label="Minutes the gate takes" inputMode="decimal" maxLength={5} value={minutes.value === undefined ? "" : String(minutes.value)} placeholder="8" onChange={(event) => emit({ minutes: event.target.value === "" ? undefined : { value: Number(decimal(event.target.value)), source: minutes.source ?? "maker" } })} />
        <span>minutes</span>
        <SegmentedField<"run" | "maker"> label="Where the minutes came from" phone={phone} items={SOURCES} value={minutes.source === "run" ? "run" : "maker"} onChange={(source) => emit({ minutes: { value: minutes.value ?? 0, source } })} />
      </Inline>
      <Inline>
        <FieldInput phone={phone} mono width={NARROW.date} aria-label="Cost per gate run, dollars" inputMode="decimal" maxLength={7} value={cost.cost === undefined ? "" : String(cost.cost)} placeholder="1.40" onChange={(event) => emit({ cost_per_run: event.target.value === "" ? undefined : { cost: Number(decimal(event.target.value)), currency: "USD", source: cost.source ?? "maker" } })} />
        <SegmentedField<"run" | "maker"> label="Where the cost came from" phone={phone} items={SOURCES} value={cost.source === "run" ? "run" : "maker"} onChange={(source) => emit({ cost_per_run: { cost: cost.cost ?? 0, currency: "USD", source } })} />
      </Inline>
      {rejected.map((entry, at) => (
        <div key={at} role="group" aria-label={`Dropped rule ${at + 1}`} style={PANEL_LIST}>
          <FieldInput phone={phone} aria-label={`Rule ${at + 1} that was dropped`} maxLength={GATE_REJECTED_RULE_MAX} value={entry.rule} placeholder="Fail on any regression, one run" onChange={(event) => setRejected(rejected.map((other, i) => (i === at ? { ...other, rule: event.target.value } : other)))} />
          <FieldInput phone={phone} aria-label={`Why rule ${at + 1} was dropped`} maxLength={GATE_REJECTED_WHY_MAX} value={entry.why} placeholder="A correct answer failed on judge noise." onChange={(event) => setRejected(rejected.map((other, i) => (i === at ? { ...other, why: event.target.value } : other)))} />
          <Inline>
            <TextLink phone={phone} aria-label={`Remove dropped rule ${at + 1}`} onClick={() => setRejected(rejected.filter((_, i) => i !== at))}>
              Remove
            </TextLink>
          </Inline>
        </div>
      ))}
      <Inline>
        <RecipeButton small phone={phone} disabled={rejected.length >= GATE_REJECTED_MAX} onClick={() => setRejected([...rejected, { rule: "", why: "" }])}>
          Add a rule you tried and dropped
        </RecipeButton>
      </Inline>
    </div>
  );
}

/** The eval harness's fields, as Optional fields of the Check window: failure types, graders, runs per case and the CI gate. */
export function harnessFields({ extras, onChange, phone }: EvalFieldsProps): ReactNode[] {
  const set = (key: string, value: unknown) => onChange({ ...extras, [key]: value });
  const types = failureTypesOf(extras.failure_types);
  const graders = gradersOf(extras.graders);
  const hasJudge = graders.some((grader) => grader.kind === "llm_judge") || (Array.isArray(extras.graders) && extras.graders.some((entry) => asRecord(entry).kind === "llm_judge"));
  const gate = gateOf(extras.gate);
  return [
    <OptionalField key="failure_types" name="Failure types" titleCount={TAG} description="Kinds of failure found by reading real outputs one by one, and how many cases showed each" summary={summaryOf(types.map((type) => `${type.name} ${failureCountLine(type)}`))} phone={phone}>
      <FailureTypesEditor value={extras.failure_types} phone={phone} onChange={(next) => set("failure_types", next)} />
    </OptionalField>,
    <OptionalField key="graders" name="Graders" titleCount={TAG} description="What scores one answer, and what each is shown" summary={summaryOf(graders.map((grader) => grader.name))} phone={phone}>
      <GradersEditor value={extras.graders} phone={phone} failureNames={types.map((type) => type.name)} onChange={(next) => set("graders", next)} />
      {hasJudge ? (
        <>
          <span>Judge model</span>
          <ModelPicker tool={null} anyWithoutTool value={typeof extras.judge_model === "string" ? extras.judge_model : null} onChange={(model) => set("judge_model", model)} phone={phone} field />
        </>
      ) : null}
      <FieldInput phone={phone} aria-label="Framework" maxLength={FRAMEWORK_MAX} value={typeof extras.framework === "string" ? extras.framework : ""} placeholder="DeepEval" onChange={(event) => set("framework", event.target.value || null)} />
    </OptionalField>,
    <OptionalField key="runs_per_case" name="Runs per case" titleCount={TAG} description={`1 to ${RUNS_PER_CASE_MAX}. Answers vary between runs`} summary={summaryOf(extras.runs_per_case === undefined ? null : String(extras.runs_per_case))} phone={phone}>
      <FieldInput phone={phone} mono width={NARROW.count} aria-label="Runs per case" inputMode="numeric" maxLength={2} value={extras.runs_per_case === undefined || extras.runs_per_case === null ? "" : String(extras.runs_per_case)} placeholder="3" onChange={(event) => set("runs_per_case", event.target.value === "" ? null : Number(digits(event.target.value)))} />
    </OptionalField>,
    <OptionalField key="gate" name="CI gate" titleCount={TAG} description="An automated check that fails a change by a stated rule" summary={summaryOf(gate ? gateRuleClause(gate) : null)} phone={phone}>
      <GateEditor value={extras.gate} phone={phone} onChange={(next) => set("gate", next)} />
    </OptionalField>,
  ];
}
