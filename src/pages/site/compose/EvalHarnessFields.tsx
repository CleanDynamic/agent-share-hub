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

import { FieldInput, Hint, Inline, OptionGrid, PANEL_LIST, Panel, RecipeButton, SegmentedField, TextLink, NARROW } from "./modalRecipes";
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
