/* CA-15 P11: the Optional section of the Details panel, in the modals' words.

   A selected tile shows the same rows its modal had under Optional: closed, each saying what it holds, each opening to its
   field. The rows are described as data (`ExtraRow`), built from the tile's own stored payload with the same readers the modal
   and the tile use, so a saved value reads the same everywhere. A field saves when it loses focus (a choice, when it is
   pressed) through `onExtras`, which writes only the keys that field owns. Nothing here writes a key the modal does not. */

import { useState, type ReactNode } from "react";

import {
  AGENT_PATTERNS,
  AGENT_PATTERN_LABEL,
  CHECK_METHODS,
  CHECK_METHOD_LABEL,
  CHECK_REVIEWERS,
  CHECK_REVIEWER_LABEL,
  EFFORTS,
  EFFORT_LABEL,
  SCORING_HOWS,
  SCORING_LABEL,
  TOOL_PERMISSIONS,
  TOOL_PERMISSION_LABEL,
  agentExtrasOf,
  checkExtrasOf,
  linesOf,
  patternOf,
  settingsOf,
  toolExtrasOf,
  variableNamesIn,
  variablesOf,
} from "@/lib/build/tileExtras";
import { EVIDENCE_KINDS, EVIDENCE_KIND_LABEL, EVIDENCE_TEXT_MAX, MEASURE_METRIC_MAX, MEASURE_UNIT_MAX, measurementLine } from "@/lib/build/evidenceKinds";
import { PART_OF, PART_OF_LABEL, RUNS_WHERE_MAX, partOfOf, runsWhereOf, type PartOf } from "@/lib/build/codePart";
import { ASKS_FOR, ASKS_FOR_LABEL, EVENT_MAX, INTERVAL_MAX, SENT_BY_CHOICES, asksForOf, originLine, originOf } from "@/lib/build/promptOrigin";
import { toolName } from "@/lib/tools/registry";

import {
  DATASET_CHUNK_STRATEGY_MAX,
  DATASET_COLUMNS_MAX,
  DATASET_COLUMN_MAX,
  DATASET_EMBEDDING_MAX,
  DATASET_FORMAT_MAX,
  DATASET_LICENCE_MAX,
  DATASET_SAMPLE_LINE_MAX,
  DATASET_SAMPLE_MAX,
  DATASET_SOURCE_MAX,
  REPO_KEY_FILES_MAX,
  REPO_KEY_FILE_MAX,
  REPO_MODIFICATIONS_MAX,
  REPO_PATH_MAX,
  REPO_PIN_KINDS,
  REPO_PIN_LABEL,
  REPO_PIN_VALUE_MAX,
  REPO_RUN_LINE_MAX,
  REPO_RUN_MAX,
  RUN_HINT,
  SYSTEM_PROMPT_VERSION_MAX,
  datasetOf,
  repoOf,
  systemPromptOf,
} from "@/lib/build/sourceTiles";
import { AGENT_DIALOG_COPY } from "./AddAgentDialog";
import { DATASET_DIALOG_COPY } from "./AddDatasetDialog";
import { REPO_DIALOG_COPY } from "./AddRepoDialog";
import { SYSTEM_PROMPT_DIALOG_COPY } from "./AddSystemPromptDialog";
import { CHECK_DIALOG_COPY } from "./AddCheckDialog";
import { CODE_DIALOG_COPY } from "./AddCodeDialog";
import { TOOL_DIALOG_COPY } from "./AddToolDialog";
import { ChoiceGrid } from "./ChoiceGrid";
import { ModelPicker } from "./ModelPicker";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { text, typedArea, typedField } from "./refinedStyles";
import { t } from "@/lib/theme/tokens";
import { ToolPicker } from "./ToolPicker";
import { FIELD_LABEL } from "./composeControls";

/** The words the prompt window uses for the same two rows. */
import { FULL_PROMPT_COPY } from "@/components/build/FullPromptWindow";

export type ExtraKind = "line" | "text" | "lines" | "count" | "choice" | "model" | "tool";

export interface ExtraField {
  key: string;
  label: string;
  kind: ExtraKind;
  max?: number;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
  items?: readonly { value: string; label: string }[];
  /** A field shown only while this holds for the row's values (a metric's target). */
  when?: (values: Record<string, string>) => boolean;
}

export interface ExtraRow {
  name: string;
  description: string;
  /** What the row holds as one line, or null while it holds nothing. */
  summary: string | null;
  fields: readonly ExtraField[];
  /** What each field holds now, as text. */
  values: Record<string, string>;
  /** The keys this row writes, from what its fields say. */
  toPatch: (values: Record<string, string>) => Record<string, unknown>;
  /** Shown instead of editors, for a row whose value cannot be edited here (an uploaded evidence file). */
  note?: string;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/* ── one row's editors ── */

function Editor({ field, value, phone, inBuild, set, commit }: { field: ExtraField; value: string; phone: boolean; inBuild: readonly string[]; set: (value: string, now?: boolean) => void; commit: () => void }) {
  if (field.kind === "choice") {
    return <ChoiceGrid label={field.label} items={field.items ?? []} value={value || null} onChange={(next) => set(next ?? "", true)} phone={phone} allowClear columns={field.items && field.items.length > 4 ? 2 : 3} />;
  }
  if (field.kind === "model") {
    return (
      <div>
        <ModelPicker tool={null} anyWithoutTool value={value || null} onChange={(next) => set(next ?? "", true)} phone={phone} name={field.label} />
      </div>
    );
  }
  if (field.kind === "tool") {
    return (
      <div>
        <ToolPicker label={field.label} value={value || null} onChange={(next) => set(next ?? "", true)} inBuild={inBuild} allowNone phone={phone} step="code" placeholder={field.placeholder} />
      </div>
    );
  }
  const common = {
    "aria-label": field.label,
    value,
    placeholder: field.placeholder,
    onChange: (event: { target: { value: string } }) => set(field.kind === "count" ? event.target.value.replace(/[^0-9]/g, "") : event.target.value),
    onBlur: commit,
  };
  if (field.kind === "text" || field.kind === "lines") {
    return <textarea {...common} rows={field.rows ?? 3} maxLength={field.max} style={typedArea(phone, field.mono ? { fontFamily: "var(--font-data)" } : undefined)} />;
  }
  return <input {...common} type="text" inputMode={field.kind === "count" ? "numeric" : undefined} maxLength={field.max} style={typedField(phone, field.mono ? { fontFamily: "var(--font-data)" } : undefined)} />;
}

function RowBody({ id, row, phone, inBuild, onExtras }: { id: string; row: ExtraRow; phone: boolean; inBuild: readonly string[]; onExtras: (id: string, patch: Record<string, unknown>) => void }) {
  const [values, setValues] = useState(row.values);
  const saved = row.toPatch(row.values);
  const commit = (next: Record<string, string>) => {
    const patch = row.toPatch(next);
    if (!same(patch, saved)) onExtras(id, patch);
  };
  const shown = row.fields.filter((field) => !field.when || field.when(values));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {row.note ? <span style={text(12.5, 400, t.text2)}>{row.note}</span> : null}
      {shown.map((field) => (
        <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {row.fields.length > 1 ? <span style={FIELD_LABEL}>{field.label}</span> : null}
          <Editor
            field={field}
            value={values[field.key] ?? ""}
            phone={phone}
            inBuild={inBuild}
            set={(value, now = false) => {
              const next = { ...values, [field.key]: value };
              setValues(next);
              if (now) commit(next);
            }}
            commit={() => commit(values)}
          />
        </div>
      ))}
    </div>
  );
}

/** The Optional section of a tile: closed rows, each saying what it holds. Nothing when the tile has no such field. */
export function ExtraRows({ id, rows, phone, inBuild = [], onExtras }: { id: string; rows: readonly ExtraRow[]; phone: boolean; inBuild?: readonly string[]; onExtras?: (id: string, patch: Record<string, unknown>) => void }): ReactNode {
  if (!onExtras || rows.length === 0) return null;
  return (
    <OptionalSection>
      {rows.map((row) => (
        <OptionalField key={row.name} name={row.name} description={row.description} summary={row.summary} phone={phone}>
          <RowBody key={JSON.stringify(row.values)} id={id} row={row} phone={phone} inBuild={inBuild} onExtras={onExtras} />
        </OptionalField>
      ))}
    </OptionalSection>
  );
}

/* ── the rows each kind of tile has ── */

type Raw = Record<string, unknown>;
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const items = <V extends string>(values: readonly V[], labels: Record<V, string>) => values.map((value) => ({ value, label: labels[value] }));

/** A prompt: the settings it ran with, and the variables its text names. */
export function promptRows(payload: Raw, promptText: string): ExtraRow[] {
  const settings = settingsOf(payload.settings) ?? { model: "", effort: "default" as const, instructions: "" };
  const saved = variablesOf(payload.variables);
  const names = variableNamesIn(promptText);
  const described = Object.fromEntries(names.map((name) => [name, saved.find((entry) => entry.name === name)?.description ?? ""]));
  const effortHeld = settings.effort !== "default";
  const origin = originOf(payload);
  const asks = asksForOf(payload);
  return [
    {
      name: FULL_PROMPT_COPY.modelSettings,
      description: "",
      summary: summaryOf(settings.model, effortHeld ? `${EFFORT_LABEL[settings.effort]} effort` : null, settings.instructions),
      fields: [
        { key: "model", label: FULL_PROMPT_COPY.model, kind: "model" },
        { key: "effort", label: FULL_PROMPT_COPY.effort, kind: "choice", items: items(EFFORTS, EFFORT_LABEL) },
        { key: "instructions", label: FULL_PROMPT_COPY.instructions, kind: "text", rows: 3, max: 2000 },
      ],
      values: { model: settings.model, effort: settings.effort === "default" ? "" : settings.effort, instructions: settings.instructions },
      toPatch: (v) => ({ settings: { model: v.model, effort: v.effort || "default", instructions: v.instructions } }),
    },
    /* SV-30 P3: how it was sent, and what it asks for. Both are the maker's to say; neither is read from the text. */
    {
      name: "How it was sent",
      description: "",
      summary: origin ? originLine(origin) : null,
      fields: [
        { key: "sent_by", label: "Sent by", kind: "choice", items: SENT_BY_CHOICES.map((choice) => ({ ...choice })) },
        { key: "interval", label: "How often", kind: "line", max: INTERVAL_MAX, placeholder: "daily 09:00", when: (v) => v.sent_by === "heartbeat" },
        { key: "event", label: "The event", kind: "line", max: EVENT_MAX, placeholder: "a deploy finished", when: (v) => v.sent_by === "event" },
      ],
      values: { sent_by: origin?.sentBy ?? "maker", interval: origin?.interval ?? "", event: origin?.event ?? "" },
      toPatch: (v) => ({ sent_by: v.sent_by && v.sent_by !== "maker" ? v.sent_by : null, interval: v.sent_by === "heartbeat" ? (v.interval ?? "") : null, event: v.sent_by === "event" ? (v.event ?? "") : null }),
    },
    {
      name: "Asks for",
      description: "",
      summary: asks ? ASKS_FOR_LABEL[asks] : null,
      fields: [{ key: "asks_for", label: "Asks for", kind: "choice", items: ASKS_FOR.map((value) => ({ value, label: ASKS_FOR_LABEL[value] })) }],
      values: { asks_for: asks ?? "" },
      toPatch: (v) => ({ asks_for: v.asks_for || null }),
    },
    {
      name: FULL_PROMPT_COPY.variables,
      description: FULL_PROMPT_COPY.variablesLine,
      summary: summaryOf(names.map((name) => `{${name}}`)),
      fields: names.map((name) => ({ key: name, label: `{${name}}`, kind: "line" as const, max: 140, placeholder: "The customer's first name" })),
      values: described,
      toPatch: (v) => ({ variables: names.map((name) => ({ name, description: v[name] ?? "" })) }),
    },
  ];
}

/** An agent: its limits, where its output goes and a sample run. A team: how its agents work together. */
export function agentRows(payload: Raw, isTeam: boolean): ExtraRow[] {
  if (isTeam) {
    const pattern = patternOf(payload.pattern);
    return [
      {
        name: AGENT_DIALOG_COPY.pattern,
        description: AGENT_DIALOG_COPY.patternLine,
        summary: pattern ? AGENT_PATTERN_LABEL[pattern] : null,
        fields: [{ key: "pattern", label: AGENT_DIALOG_COPY.pattern, kind: "choice", items: items(AGENT_PATTERNS, AGENT_PATTERN_LABEL) }],
        values: { pattern: pattern ?? "" },
        toPatch: (v) => ({ pattern: v.pattern || null }),
      },
    ];
  }
  const extras = agentExtrasOf(payload);
  return [
    {
      name: AGENT_DIALOG_COPY.limits,
      description: AGENT_DIALOG_COPY.limitsLine,
      summary: summaryOf(extras.limits ?? []),
      fields: [{ key: "limits", label: AGENT_DIALOG_COPY.limits, kind: "lines", rows: 3, placeholder: AGENT_DIALOG_COPY.limitsPlaceholder }],
      values: { limits: (extras.limits ?? []).join("\n") },
      toPatch: (v) => ({ limits: linesOf(v.limits ?? "") }),
    },
    {
      name: AGENT_DIALOG_COPY.output,
      description: AGENT_DIALOG_COPY.outputLine,
      summary: summaryOf(extras.output),
      fields: [{ key: "output", label: AGENT_DIALOG_COPY.output, kind: "line", max: 280, placeholder: AGENT_DIALOG_COPY.outputPlaceholder }],
      values: { output: extras.output ?? "" },
      toPatch: (v) => ({ output: v.output ?? "" }),
    },
    {
      name: AGENT_DIALOG_COPY.sample,
      description: AGENT_DIALOG_COPY.sampleLine,
      summary: summaryOf(extras.sample ? extras.sample.split(/\r?\n/)[0].slice(0, 80) : null),
      fields: [{ key: "sample", label: AGENT_DIALOG_COPY.transcript, kind: "text", rows: 5, max: 8000, placeholder: AGENT_DIALOG_COPY.transcriptPlaceholder, mono: true }],
      values: { sample: extras.sample ?? "" },
      toPatch: (v) => ({ sample: v.sample ?? "" }),
    },
  ];
}

/** A check: how it was tested, who judged it, how it was scored, the model it ran against and its evidence. */
export function checkRows(payload: Raw): ExtraRow[] {
  const extras = checkExtrasOf(payload);
  const evidence = extras.evidence;
  const evidenceFile = evidence?.mediaId ? (evidence.name ?? "A file") : null;
  return [
    {
      name: CHECK_DIALOG_COPY.method,
      description: CHECK_DIALOG_COPY.methodLine,
      summary: extras.method ? CHECK_METHOD_LABEL[extras.method] : null,
      fields: [{ key: "method", label: CHECK_DIALOG_COPY.method, kind: "choice", items: items(CHECK_METHODS, CHECK_METHOD_LABEL) }],
      values: { method: extras.method ?? "" },
      toPatch: (v) => ({ method: v.method || null }),
    },
    {
      name: CHECK_DIALOG_COPY.reviewer,
      description: CHECK_DIALOG_COPY.reviewerLine,
      summary: extras.reviewer ? CHECK_REVIEWER_LABEL[extras.reviewer] : null,
      fields: [{ key: "reviewer", label: CHECK_DIALOG_COPY.reviewer, kind: "choice", items: items(CHECK_REVIEWERS, CHECK_REVIEWER_LABEL) }],
      values: { reviewer: extras.reviewer ?? "" },
      toPatch: (v) => ({ reviewer: v.reviewer || null }),
    },
    {
      name: CHECK_DIALOG_COPY.scoring,
      description: CHECK_DIALOG_COPY.scoringLine,
      summary: summaryOf(extras.scoring ? SCORING_LABEL[extras.scoring.how] : null, extras.scoring?.how === "metric" ? extras.scoring.target : null),
      fields: [
        { key: "how", label: CHECK_DIALOG_COPY.scoring, kind: "choice", items: items(SCORING_HOWS, SCORING_LABEL) },
        { key: "target", label: CHECK_DIALOG_COPY.target, kind: "line", max: 80, placeholder: CHECK_DIALOG_COPY.targetPlaceholder, when: (v) => v.how === "metric" },
      ],
      values: { how: extras.scoring?.how ?? "", target: extras.scoring?.target ?? "" },
      toPatch: (v) => ({ scoring: v.how ? { how: v.how, target: v.how === "metric" ? (v.target ?? "") : "" } : null }),
    },
    {
      name: CHECK_DIALOG_COPY.modelTested,
      description: "",
      summary: summaryOf(extras.modelTested?.model, extras.modelTested?.version),
      fields: [
        { key: "model", label: CHECK_DIALOG_COPY.modelTested, kind: "model" },
        { key: "version", label: CHECK_DIALOG_COPY.version, kind: "line", max: 40, placeholder: CHECK_DIALOG_COPY.versionPlaceholder },
      ],
      values: { model: extras.modelTested?.model ?? "", version: extras.modelTested?.version ?? "" },
      toPatch: (v) => ({ model_tested: { model: v.model ?? "", version: v.version ?? "" } }),
    },
    {
      name: CHECK_DIALOG_COPY.evidence,
      description: CHECK_DIALOG_COPY.evidenceLine,
      summary: summaryOf(evidence?.kind ? EVIDENCE_KIND_LABEL[evidence.kind] : null, evidence?.measurement ? measurementLine(evidence.measurement) : evidenceFile, evidenceFile || evidence?.measurement ? null : evidence?.url, evidence?.text ? "Pasted output" : null),
      /* SV-30 P8: the kind says what it is; a measurement is five numbers, a test output is pasted. */
      fields: evidenceFile
        ? []
        : [
            { key: "kind", label: "Kind of evidence", kind: "choice", items: EVIDENCE_KINDS.map((value) => ({ value, label: EVIDENCE_KIND_LABEL[value] })) },
            { key: "url", label: CHECK_DIALOG_COPY.evidenceUrl, kind: "line", when: (v) => v.kind !== "measurement" && v.kind !== "test_output" },
            { key: "metric", label: "What was measured", kind: "line", max: MEASURE_METRIC_MAX, placeholder: "Latency", when: (v) => v.kind === "measurement" },
            { key: "unit", label: "Unit", kind: "line", max: MEASURE_UNIT_MAX, placeholder: "ms", when: (v) => v.kind === "measurement" },
            { key: "before", label: "Before", kind: "line", max: 14, when: (v) => v.kind === "measurement" },
            { key: "after", label: "After", kind: "line", max: 14, when: (v) => v.kind === "measurement" },
            { key: "runs", label: "Runs", kind: "line", max: 7, when: (v) => v.kind === "measurement" },
            { key: "text", label: "Pasted output", kind: "text", rows: 5, max: EVIDENCE_TEXT_MAX, mono: true, when: (v) => v.kind === "test_output" },
          ],
      values: { kind: evidence?.kind ?? "", url: evidence?.url ?? "", metric: evidence?.measurement?.metric ?? "", unit: evidence?.measurement?.unit ?? "", before: evidence?.measurement ? String(evidence.measurement.before) : "", after: evidence?.measurement ? String(evidence.measurement.after) : "", runs: evidence?.measurement ? String(evidence.measurement.runs) : "", text: evidence?.text ?? "" },
      toPatch: (v) => {
        if (v.kind === "measurement") return v.metric || v.before || v.after || v.runs ? { evidence: { kind: "measurement", measurement: { metric: v.metric ?? "", unit: v.unit ?? "", before: Number(v.before), after: Number(v.after), runs: Number(v.runs) } } } : { evidence: null };
        if (v.kind === "test_output") return v.text ? { evidence: { kind: "test_output", text: v.text } } : { evidence: null };
        return v.url ? { evidence: { ...(v.kind ? { kind: v.kind } : null), url: v.url } } : { evidence: null };
      },
      ...(evidenceFile ? { note: `${evidenceFile} attached` } : null),
    },
  ];
}

/** A tool: what its connection allowed, the plan it needed, how it was set up and what else could do the job. */
export function toolRows(payload: Raw): ExtraRow[] {
  const extras = toolExtrasOf(payload);
  const keyed = payload.connection === "api_key";
  return [
    {
      name: TOOL_DIALOG_COPY.permissions,
      description: TOOL_DIALOG_COPY.permissionsLine,
      summary: extras.permissions ? TOOL_PERMISSION_LABEL[extras.permissions] : null,
      fields: [{ key: "permissions", label: TOOL_DIALOG_COPY.permissions, kind: "choice", items: items(TOOL_PERMISSIONS, TOOL_PERMISSION_LABEL) }],
      values: { permissions: extras.permissions ?? "" },
      toPatch: (v) => ({ permissions: v.permissions || null }),
    },
    {
      name: TOOL_DIALOG_COPY.plan,
      description: TOOL_DIALOG_COPY.planLine,
      summary: summaryOf(extras.plan),
      fields: [{ key: "plan", label: TOOL_DIALOG_COPY.plan, kind: "line", max: 80, placeholder: TOOL_DIALOG_COPY.planPlaceholder }],
      values: { plan: extras.plan ?? "" },
      toPatch: (v) => ({ plan: v.plan ?? "" }),
    },
    {
      name: TOOL_DIALOG_COPY.setup,
      description: keyed ? TOOL_DIALOG_COPY.setupKeyHint : "",
      summary: summaryOf(extras.setup ?? []),
      fields: [{ key: "setup", label: TOOL_DIALOG_COPY.setup, kind: "lines", rows: 4, placeholder: TOOL_DIALOG_COPY.setupPlaceholder }],
      values: { setup: (extras.setup ?? []).join("\n") },
      toPatch: (v) => ({ setup: linesOf(v.setup ?? "") }),
    },
    {
      name: TOOL_DIALOG_COPY.alternatives,
      description: TOOL_DIALOG_COPY.alternativesLine,
      summary: summaryOf(extras.alternatives ?? []),
      fields: [{ key: "alternatives", label: TOOL_DIALOG_COPY.alternatives, kind: "lines", rows: 3, placeholder: "Linear\nJira" }],
      values: { alternatives: (extras.alternatives ?? []).join("\n") },
      toPatch: (v) => ({ alternatives: linesOf(v.alternatives ?? "") }),
    },
  ];
}

/** Code: where it lives in the project, and what generated it. */
export function codeRows(payload: Raw): ExtraRow[] {
  const filename = str(payload.filename).trim();
  const tool = str(payload.tool).trim();
  const model = str(payload.model).trim();
  return [
    {
      name: CODE_DIALOG_COPY.filename,
      description: "",
      summary: summaryOf(filename),
      fields: [{ key: "filename", label: CODE_DIALOG_COPY.filename, kind: "line", max: 200, placeholder: CODE_DIALOG_COPY.filenamePlaceholder, mono: true }],
      values: { filename },
      toPatch: (v) => ({ filename: v.filename ?? "" }),
    },
    /* SV-30 P9: what it belongs to, and where it runs. */
    {
      name: "What it belongs to",
      description: "",
      summary: summaryOf(partOfOf(payload) ? PART_OF_LABEL[partOfOf(payload) as PartOf] : null, runsWhereOf(payload)),
      fields: [
        { key: "part_of", label: "Part of", kind: "choice", items: PART_OF.map((value) => ({ value, label: PART_OF_LABEL[value] })) },
        { key: "runs_where", label: "Where it runs", kind: "line", max: RUNS_WHERE_MAX, placeholder: "Terminal 2, in the harness folder" },
      ],
      values: { part_of: partOfOf(payload) ?? "", runs_where: runsWhereOf(payload) ?? "" },
      toPatch: (v) => ({ part_of: v.part_of || null, runs_where: v.runs_where ?? "" }),
    },
    {
      name: CODE_DIALOG_COPY.writtenWith,
      description: CODE_DIALOG_COPY.writtenWithLine,
      summary: summaryOf(tool ? (toolName(tool) ?? tool) : null, model),
      fields: [
        { key: "tool", label: CODE_DIALOG_COPY.writtenWithTool, kind: "tool", placeholder: "Select a tool" },
        { key: "model", label: "Model", kind: "model" },
      ],
      values: { tool, model },
      toPatch: (v) => ({ tool: v.tool ?? "", model: v.model ?? "" }),
    },
  ];
}

/** A result: the one line under it. */
export function resultRows(payload: Raw): ExtraRow[] {
  const caption = str(payload.caption).trim();
  return [
    {
      name: "Caption",
      description: "One line under the result",
      summary: summaryOf(caption),
      fields: [{ key: "caption", label: "Caption", kind: "line", max: 140, placeholder: "The final poster, as printed" }],
      values: { caption },
      toPatch: (v) => ({ caption: v.caption ?? "" }),
    },
  ];
}

/** A system prompt: the model it was written for, its version and its variables. */
export function systemPromptRows(payload: Raw): ExtraRow[] {
  const facts = systemPromptOf(payload);
  const model = str(payload.model).trim();
  const names = variableNamesIn(facts.text);
  const saved = variablesOf(payload.variables);
  return [
    {
      name: SYSTEM_PROMPT_DIALOG_COPY.model,
      description: "",
      summary: summaryOf(model),
      fields: [{ key: "model", label: SYSTEM_PROMPT_DIALOG_COPY.model, kind: "model" }],
      values: { model },
      toPatch: (v) => ({ model: v.model ?? "" }),
    },
    {
      name: SYSTEM_PROMPT_DIALOG_COPY.version,
      description: SYSTEM_PROMPT_DIALOG_COPY.versionLine,
      summary: summaryOf(facts.version),
      fields: [{ key: "version", label: SYSTEM_PROMPT_DIALOG_COPY.version, kind: "line", max: SYSTEM_PROMPT_VERSION_MAX, placeholder: SYSTEM_PROMPT_DIALOG_COPY.versionPlaceholder }],
      values: { version: facts.version ?? "" },
      toPatch: (v) => ({ version: v.version ?? "" }),
    },
    {
      name: SYSTEM_PROMPT_DIALOG_COPY.variables,
      description: SYSTEM_PROMPT_DIALOG_COPY.variablesLine,
      summary: summaryOf(names.map((name) => `{${name}}`)),
      fields: names.map((name) => ({ key: name, label: `{${name}}`, kind: "line" as const, max: 140, placeholder: "The customer's first name" })),
      values: Object.fromEntries(names.map((name) => [name, saved.find((entry) => entry.name === name)?.description ?? ""])),
      toPatch: (v) => ({ variables: names.map((name) => ({ name, description: v[name] ?? "" })) }),
      ...(names.length === 0 ? { note: SYSTEM_PROMPT_DIALOG_COPY.noVariables } : null),
    },
  ];
}

/** A dataset: format, record count, columns, source, sample records, licence and, for retrieval, how it was chunked. */
export function datasetRows(payload: Raw): ExtraRow[] {
  const facts = datasetOf(payload);
  const rows: ExtraRow[] = [
    {
      name: DATASET_DIALOG_COPY.format,
      description: "",
      summary: summaryOf(facts.format),
      fields: [{ key: "format", label: DATASET_DIALOG_COPY.format, kind: "line", max: DATASET_FORMAT_MAX, placeholder: DATASET_DIALOG_COPY.formatPlaceholder }],
      values: { format: facts.format ?? "" },
      toPatch: (v) => ({ format: v.format ?? "" }),
    },
    {
      name: DATASET_DIALOG_COPY.records,
      description: "",
      summary: summaryOf(facts.recordCount === null ? null : facts.recordCount.toLocaleString("en-GB")),
      fields: [{ key: "records", label: DATASET_DIALOG_COPY.records, kind: "count", max: 12, placeholder: DATASET_DIALOG_COPY.recordsPlaceholder }],
      values: { records: facts.recordCount === null ? "" : String(facts.recordCount) },
      toPatch: (v) => ({ record_count: v.records ? Number(v.records) : null }),
    },
    {
      name: DATASET_DIALOG_COPY.columns,
      description: DATASET_DIALOG_COPY.columnsLine,
      summary: summaryOf(facts.columns),
      fields: [{ key: "columns", label: DATASET_DIALOG_COPY.columns, kind: "lines", rows: 4, placeholder: DATASET_DIALOG_COPY.columnsPlaceholder }],
      values: { columns: facts.columns.join("\n") },
      toPatch: (v) => ({ columns: linesOf(v.columns ?? "").slice(0, DATASET_COLUMNS_MAX + 1).map((line) => line.slice(0, DATASET_COLUMN_MAX + 1)) }),
    },
    {
      name: DATASET_DIALOG_COPY.source,
      description: "",
      summary: summaryOf(facts.source),
      fields: [{ key: "source", label: DATASET_DIALOG_COPY.source, kind: "line", max: DATASET_SOURCE_MAX, placeholder: DATASET_DIALOG_COPY.sourcePlaceholder }],
      values: { source: facts.source ?? "" },
      toPatch: (v) => ({ source: v.source ?? "" }),
    },
    {
      name: DATASET_DIALOG_COPY.sample,
      description: DATASET_DIALOG_COPY.sampleLine,
      summary: summaryOf(facts.sample),
      fields: [{ key: "sample", label: DATASET_DIALOG_COPY.sample, kind: "lines", rows: 5, placeholder: DATASET_DIALOG_COPY.samplePlaceholder }],
      values: { sample: facts.sample.join("\n") },
      toPatch: (v) => ({ sample: linesOf(v.sample ?? "").slice(0, DATASET_SAMPLE_MAX + 1).map((line) => line.slice(0, DATASET_SAMPLE_LINE_MAX + 1)) }),
    },
    {
      name: DATASET_DIALOG_COPY.licence,
      description: "",
      summary: summaryOf(facts.licence),
      fields: [{ key: "licence", label: DATASET_DIALOG_COPY.licence, kind: "line", max: DATASET_LICENCE_MAX, placeholder: DATASET_DIALOG_COPY.licencePlaceholder }],
      values: { licence: facts.licence ?? "" },
      toPatch: (v) => ({ licence: v.licence ?? "" }),
    },
  ];
  if (facts.use === "retrieval") {
    rows.push({
      name: DATASET_DIALOG_COPY.chunking,
      description: DATASET_DIALOG_COPY.chunkingLine,
      summary: summaryOf(facts.chunkStrategy, facts.chunkSize === null ? null : `size ${facts.chunkSize}`, facts.chunkOverlap === null ? null : `overlap ${facts.chunkOverlap}`, facts.embeddingModel),
      fields: [
        { key: "strategy", label: DATASET_DIALOG_COPY.strategy, kind: "line", max: DATASET_CHUNK_STRATEGY_MAX, placeholder: DATASET_DIALOG_COPY.strategyPlaceholder },
        { key: "size", label: DATASET_DIALOG_COPY.size, kind: "count", max: 7, placeholder: "512" },
        { key: "overlap", label: DATASET_DIALOG_COPY.overlap, kind: "count", max: 7, placeholder: "64" },
        { key: "embedding", label: DATASET_DIALOG_COPY.embedding, kind: "line", max: DATASET_EMBEDDING_MAX, placeholder: DATASET_DIALOG_COPY.embeddingPlaceholder },
      ],
      values: { strategy: facts.chunkStrategy ?? "", size: facts.chunkSize === null ? "" : String(facts.chunkSize), overlap: facts.chunkOverlap === null ? "" : String(facts.chunkOverlap), embedding: facts.embeddingModel ?? "" },
      toPatch: (v) => ({ chunk_strategy: v.strategy ?? "", chunk_size: v.size ? Number(v.size) : null, chunk_overlap: v.overlap ? Number(v.overlap) : null, embedding_model: v.embedding ?? "" }),
    });
  }
  return rows;
}

/** A GitHub repository: the pinned version, the path used, what was changed, the key files and how to run it. */
export function repoRows(payload: Raw): ExtraRow[] {
  const facts = repoOf(payload);
  if (!facts) return [];
  const rows: ExtraRow[] = [
    {
      name: REPO_DIALOG_COPY.pinned,
      description: REPO_DIALOG_COPY.pinnedLine,
      summary: facts.pin ? `${REPO_PIN_LABEL[facts.pin.kind]} ${facts.pin.value}` : null,
      fields: [
        { key: "kind", label: REPO_DIALOG_COPY.pinned, kind: "choice", items: items(REPO_PIN_KINDS, REPO_PIN_LABEL) },
        { key: "value", label: REPO_DIALOG_COPY.pinValue, kind: "line", max: REPO_PIN_VALUE_MAX, placeholder: REPO_DIALOG_COPY.pinPlaceholder, mono: true, when: (v) => Boolean(v.kind) },
      ],
      values: { kind: facts.pin?.kind ?? "", value: facts.pin?.value ?? "" },
      toPatch: (v) => ({ pin: v.kind && v.value ? { kind: v.kind, value: v.value } : null }),
    },
    {
      name: REPO_DIALOG_COPY.path,
      description: REPO_DIALOG_COPY.pathLine,
      summary: summaryOf(facts.path),
      fields: [{ key: "path", label: REPO_DIALOG_COPY.path, kind: "line", max: REPO_PATH_MAX, placeholder: REPO_DIALOG_COPY.pathPlaceholder, mono: true }],
      values: { path: facts.path ?? "" },
      toPatch: (v) => ({ path: v.path ?? "" }),
    },
  ];
  if (facts.ownership === "third_party") {
    rows.push({
      name: REPO_DIALOG_COPY.modifications,
      description: REPO_DIALOG_COPY.modificationsLine,
      summary: summaryOf(facts.modifications),
      fields: [{ key: "modifications", label: REPO_DIALOG_COPY.modifications, kind: "text", rows: 3, max: REPO_MODIFICATIONS_MAX, placeholder: REPO_DIALOG_COPY.modificationsPlaceholder }],
      values: { modifications: facts.modifications ?? "" },
      toPatch: (v) => ({ modifications: v.modifications ?? "" }),
    });
  }
  rows.push(
    {
      name: REPO_DIALOG_COPY.keyFiles,
      description: REPO_DIALOG_COPY.keyFilesLine,
      summary: summaryOf(facts.keyFiles),
      fields: [{ key: "keyFiles", label: REPO_DIALOG_COPY.keyFiles, kind: "lines", rows: 3, placeholder: REPO_DIALOG_COPY.keyFilesPlaceholder, mono: true }],
      values: { keyFiles: facts.keyFiles.join("\n") },
      toPatch: (v) => ({ key_files: linesOf(v.keyFiles ?? "").slice(0, REPO_KEY_FILES_MAX + 1).map((line) => line.slice(0, REPO_KEY_FILE_MAX + 1)) }),
    },
    {
      name: REPO_DIALOG_COPY.run,
      description: REPO_DIALOG_COPY.runLine,
      summary: summaryOf(facts.run),
      fields: [{ key: "run", label: REPO_DIALOG_COPY.run, kind: "lines", rows: 4, placeholder: REPO_DIALOG_COPY.runPlaceholder, mono: true }],
      values: { run: facts.run.join("\n") },
      toPatch: (v) => ({ run: linesOf(v.run ?? "").slice(0, REPO_RUN_MAX + 1).map((line) => line.slice(0, REPO_RUN_LINE_MAX + 1)) }),
      note: RUN_HINT,
    },
  );
  return rows;
}
