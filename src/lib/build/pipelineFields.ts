// SV-29 P1: what a Decision records about how it is used at volume: the label set it chooses from, the candidate set an earlier
// step hands it, how it covers the label set, how it was adapted, and where it is known to fail. Every key is optional and
// lives in the Decision node's own `payload`; a payload without them reads exactly as before. PURE.

import { clean, registerCleaners } from "./tileExtras";

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const whole = (value: unknown, min: number, max: number): number | null => (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null);

/* ── the label set ── */

export const LABEL_STRUCTURES = ["flat", "hierarchical"] as const;
export type LabelStructure = (typeof LABEL_STRUCTURES)[number];
export const LABEL_NAME_MAX = 80;
export const LABEL_VERSION_MAX = 40;
export const LABEL_SIZE_MAX = 100_000_000;

export interface LabelSet {
  size: number;
  structure: LabelStructure;
  name?: string;
  version?: string;
}

export function labelSetOf(raw: unknown): LabelSet | null {
  if (!isRecord(raw)) return null;
  const size = whole(raw.size, 1, LABEL_SIZE_MAX);
  if (size === null || !LABEL_STRUCTURES.includes(raw.structure as LabelStructure)) return null;
  const name = clean(raw.name, LABEL_NAME_MAX);
  const version = clean(raw.version, LABEL_VERSION_MAX);
  return { size, structure: raw.structure as LabelStructure, ...(name ? { name } : null), ...(version ? { version } : null) };
}

/** "Label set: Shopify product taxonomy, Sept 2026 · 6,000 labels · hierarchical". */
export function labelSetLine(set: LabelSet): string {
  const named = [set.name, set.version].filter(Boolean).join(", ");
  return `Label set: ${[named || null, `${set.size.toLocaleString("en-GB")} ${set.size === 1 ? "label" : "labels"}`, set.structure].filter(Boolean).join(" · ")}`;
}

/* ── the candidate set ── */

export const CANDIDATES_K_MIN = 2;
export const CANDIDATES_K_MAX = 1000;

export interface CandidatesFrom {
  /** The node id of the step that produces the candidates. */
  step: string;
  k: number;
}

export function candidatesFromOf(raw: unknown): CandidatesFrom | null {
  if (!isRecord(raw) || typeof raw.step !== "string" || !raw.step.trim()) return null;
  const k = whole(raw.k, CANDIDATES_K_MIN, CANDIDATES_K_MAX);
  return k === null ? null : { step: raw.step.trim(), k };
}

/** "Candidates: top 30 from Step 4"; the step's number is the caller's, or "an earlier step" when it is not known. */
export const candidatesLine = (candidates: CandidatesFrom, number: string | null | undefined): string => `Candidates: top ${candidates.k.toLocaleString("en-GB")} from ${number ? `Step ${number}` : "an earlier step"}`;

/* ── how the label set is covered ── */

export const SELECTION_METHODS = ["single_call", "exhaustive", "beam_search", "per_node"] as const;
export type SelectionMethod = (typeof SELECTION_METHODS)[number];
export const BEAM_WIDTH_MIN = 1;
export const BEAM_WIDTH_MAX = 50;

export interface Selection {
  method: SelectionMethod;
  /** Beam search only. */
  beamWidth?: number;
}

export function selectionOf(raw: unknown): Selection | null {
  const method = typeof raw === "string" ? raw : isRecord(raw) ? raw.method : null;
  if (!SELECTION_METHODS.includes(method as SelectionMethod)) return null;
  if (method !== "beam_search") return { method: method as SelectionMethod };
  const width = isRecord(raw) ? whole(raw.beam_width, BEAM_WIDTH_MIN, BEAM_WIDTH_MAX) : null;
  return width === null ? null : { method: "beam_search", beamWidth: width };
}

export const SELECTION_LABEL: Record<SelectionMethod, string> = {
  single_call: "One call over the candidates",
  exhaustive: "Scores every label",
  beam_search: "Walks the tree (beam search, width k)",
  per_node: "One call per node",
};

/** The label as the tile says it: "Walks the tree (beam search, width 5)". */
export const selectionLabel = (selection: Selection): string => (selection.method === "beam_search" ? SELECTION_LABEL.beam_search.replace("width k", `width ${selection.beamWidth ?? "k"}`) : SELECTION_LABEL[selection.method]);

/* ── how it was adapted ── */

export const ADAPTATIONS = ["zero_shot", "few_shot", "fine_tuned"] as const;
export type AdaptationKind = (typeof ADAPTATIONS)[number];
export const BASE_MODEL_MAX = 80;

export interface Adaptation {
  kind: AdaptationKind;
  /** Fine-tuned only: the model whose weights were trained further. */
  baseModel?: string;
  /** Few-shot only: the examples are sent in the prompt. */
  examplesInPrompt?: true;
}

export function adaptationOf(raw: unknown): Adaptation | null {
  const kind = typeof raw === "string" ? raw : isRecord(raw) ? raw.kind : null;
  if (!ADAPTATIONS.includes(kind as AdaptationKind)) return null;
  if (kind === "few_shot") return { kind: "few_shot", examplesInPrompt: true };
  if (kind === "zero_shot") return { kind: "zero_shot" };
  const base = isRecord(raw) ? clean(raw.base_model, BASE_MODEL_MAX) : "";
  return base ? { kind: "fine_tuned", baseModel: base } : null;
}

export const ADAPTATION_LABEL: Record<AdaptationKind, string> = { zero_shot: "Zero-shot", few_shot: "Few-shot", fine_tuned: "Fine-tuned" };

/** "Zero-shot: no examples", "Few-shot: examples in the prompt", "Fine-tuned from gemma-3-4b". */
export function adaptationLine(adaptation: Adaptation): string {
  if (adaptation.kind === "zero_shot") return "Zero-shot: no examples";
  if (adaptation.kind === "few_shot") return "Few-shot: examples in the prompt";
  return `Fine-tuned from ${adaptation.baseModel}`;
}

/* ── known limits ── */

export const KNOWN_LIMITS_MAX = 5;
export const KNOWN_LIMIT_LINE_MAX = 120;

export const knownLimitsOf = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.flatMap((line) => (typeof line === "string" && line.trim() ? [line.trim().slice(0, KNOWN_LIMIT_LINE_MAX)] : [])).slice(0, KNOWN_LIMITS_MAX) : [];

/* ── the accuracy ceiling (derived, never stored) ── */

/** Where a measured figure came from. `original` is a copy's label for what the original measured (SV-29 rules). */
export type FigureSource = "run" | "maker" | "original";

/** The words the page uses for a figure's source. The site never states a figure as fact. */
export const SOURCE_WORD: Record<FigureSource, string> = { run: "From the run", maker: "Maker's figure", original: "The original measured" };

/** A measured Recall@k of a Retrieval tile. */
export interface RecallPoint {
  k: number;
  value: number;
  source: FigureSource;
}

export interface Ceiling {
  line: string;
  source: FigureSource;
}

/**
 * "Accuracy ceiling: 99% (Recall@30 of Step 4)": the candidate step's Recall@k when it is measured at the same k as the
 * candidates. A reranker cannot pass it while the decision cannot answer outside the candidates. Not given when k differs or no
 * recall is measured.
 */
export function accuracyCeiling(candidates: CandidatesFrom | undefined, retrieval: { number: string; recall: readonly RecallPoint[] } | undefined): Ceiling | null {
  if (!candidates || !retrieval) return null;
  const point = retrieval.recall.find((entry) => entry.k === candidates.k);
  if (!point) return null;
  return { line: `Accuracy ceiling: ${Math.round(point.value * 100)}% (Recall@${point.k} of Step ${retrieval.number})`, source: point.source };
}

/** What a Decision shows that comes from another tile (`withPipeline` in graph.ts fills it; never stored). */
export interface PipelineDerived {
  /** The candidate step's number. */
  candidatesNumber?: string;
  ceiling?: Ceiling;
}

/* ── what the Decision window may save ── */

export interface PipelineFields {
  labelSet?: LabelSet;
  candidatesFrom?: CandidatesFrom;
  selection?: Selection;
  adaptation?: Adaptation;
  knownLimits?: string[];
}

/** The six keys as the payload holds them. */
export function pipelineFieldsOf(payload: Raw): PipelineFields {
  const labelSet = labelSetOf(payload.label_set);
  const candidatesFrom = candidatesFromOf(payload.candidates_from);
  const selection = selectionOf(payload.selection);
  const adaptation = adaptationOf(payload.adaptation);
  const limits = knownLimitsOf(payload.known_limits);
  return {
    ...(labelSet ? { labelSet } : null),
    ...(candidatesFrom ? { candidatesFrom } : null),
    ...(selection ? { selection } : null),
    ...(adaptation ? { adaptation } : null),
    ...(limits.length > 0 ? { knownLimits: limits } : null),
  };
}

/** Why these cannot be saved, or null. `examples` is how many input and output pairs the decision holds. Fixed words only. */
export function pipelineRefusal(fields: PipelineFields, context: { examples: number; takesOptions: boolean }): string | null {
  if (fields.candidatesFrom && !context.takesOptions) return "Candidates are for a single choice, multiple choice or ranking question.";
  if (fields.adaptation?.kind === "few_shot" && context.examples === 0) return "Few-shot needs examples: add them under Examples.";
  if (fields.adaptation?.kind === "fine_tuned" && !fields.adaptation.baseModel) return "Fine-tuned needs the base model.";
  if (fields.selection?.method === "beam_search" && !fields.selection.beamWidth) return `Beam width: ${BEAM_WIDTH_MIN} to ${BEAM_WIDTH_MAX}`;
  return null;
}

/** The payload keys for the fields, each only when given. */
export function pipelinePayload(fields: PipelineFields): Raw {
  return {
    ...(fields.labelSet ? { label_set: fields.labelSet } : null),
    ...(fields.candidatesFrom ? { candidates_from: fields.candidatesFrom } : null),
    ...(fields.selection ? { selection: { method: fields.selection.method, ...(fields.selection.beamWidth ? { beam_width: fields.selection.beamWidth } : null) } } : null),
    ...(fields.adaptation
      ? { adaptation: { kind: fields.adaptation.kind, ...(fields.adaptation.baseModel ? { base_model: fields.adaptation.baseModel } : null), ...(fields.adaptation.examplesInPrompt ? { examples_in_prompt: true } : null) } }
      : null),
    ...(fields.knownLimits && fields.knownLimits.length > 0 ? { known_limits: fields.knownLimits } : null),
  };
}

export const PIPELINE_KEYS = ["label_set", "candidates_from", "selection", "adaptation", "known_limits"] as const;

/** Lines for a Decision's tile and the build page, in the order the prompt gives them. The ceiling is the caller's (it needs the other tile). */
export function pipelineLines(fields: PipelineFields, numberOf: (id: string) => string | null | undefined): string[] {
  return [
    fields.labelSet ? labelSetLine(fields.labelSet) : null,
    fields.candidatesFrom ? candidatesLine(fields.candidatesFrom, numberOf(fields.candidatesFrom.step)) : null,
    fields.selection ? selectionLabel(fields.selection) : null,
    fields.adaptation ? adaptationLine(fields.adaptation) : null,
  ].filter((line): line is string => line !== null);
}

/* ── the extras writer (`setExtras`) ── */

registerCleaners("decision", {
  label_set: (value) => {
    if (value === null || value === undefined) return null;
    const set = labelSetOf(value);
    if (!set) throw new Error("Label set: a size and whether it is flat or hierarchical");
    return pipelinePayload({ labelSet: set }).label_set as never;
  },
  candidates_from: (value) => {
    if (value === null || value === undefined) return null;
    const from = candidatesFromOf(value);
    if (!from) throw new Error(`Candidates: ${CANDIDATES_K_MIN} to ${CANDIDATES_K_MAX.toLocaleString("en-GB")} from an earlier step`);
    return from as never;
  },
  selection: (value) => {
    if (value === null || value === undefined) return null;
    const selection = selectionOf(value);
    if (!selection) throw new Error(`Beam width: ${BEAM_WIDTH_MIN} to ${BEAM_WIDTH_MAX}`);
    return pipelinePayload({ selection }).selection as never;
  },
  adaptation: (value) => {
    if (value === null || value === undefined) return null;
    const adaptation = adaptationOf(value);
    if (!adaptation) throw new Error("Fine-tuned needs the base model.");
    return pipelinePayload({ adaptation }).adaptation as never;
  },
  known_limits: (value) => {
    if (value === null || value === undefined) return null;
    const lines = Array.isArray(value) ? value.filter((line): line is string => typeof line === "string" && line.trim().length > 0).map((line) => line.trim()) : [];
    if (lines.length > KNOWN_LIMITS_MAX) throw new Error(`Known limits: ${KNOWN_LIMITS_MAX} max, one per line`);
    if (lines.some((line) => line.length > KNOWN_LIMIT_LINE_MAX)) throw new Error(`Each known limit: ${KNOWN_LIMIT_LINE_MAX} characters max`);
    return lines.length > 0 ? lines : null;
  },
});

/** For `setExtras`: a patch that would break a rule that needs the node's other keys (candidates need an option question; few-shot needs examples). */
export function pipelinePatchRefusal(payload: Raw, patch: Raw): string | null {
  const touched = PIPELINE_KEYS.some((key) => key in patch);
  if (!touched) return null;
  const merged = { ...payload, ...patch };
  const questions = Array.isArray(merged.questions) ? merged.questions : [];
  const takes = questions.some((q) => isRecord(q) && (q.type === "choice" || q.type === "multi" || q.type === "rank"));
  const examples = Array.isArray(merged.examples) ? merged.examples.length : 0;
  return pipelineRefusal(pipelineFieldsOf(merged), { examples, takesOptions: takes });
}

/** A Decision's pipeline lines as the tile and the build page draw them: label set, candidates, selection, adaptation, the ceiling, then known limits. */
export function decisionPipelineLines(facts: PipelineFields & { derived?: PipelineDerived }): { kind: "line" | "limit"; text: string }[] {
  const lines: { kind: "line" | "limit"; text: string }[] = pipelineLines(facts, () => facts.derived?.candidatesNumber).map((text) => ({ kind: "line", text }));
  if (facts.derived?.ceiling) lines.push({ kind: "line", text: `${facts.derived.ceiling.line} · ${SOURCE_WORD[facts.derived.ceiling.source]}` });
  for (const limit of facts.knownLimits ?? []) lines.push({ kind: "limit", text: `Known limit: ${limit}` });
  return lines;
}
