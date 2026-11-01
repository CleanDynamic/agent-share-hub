// CA-05 P8 — how a model was run: its size and where. Kept beside the model as `payload.modelRun = { precision, where }`.
//
// PURE. It matters for a model that runs on the maker's own computer (Ollama, LM Studio) and for one whose weights are
// open (Muse Spark Open, GPT-OSS-120b): the same model gives different answers at a smaller size. Both keys are
// optional, and a model with neither reads exactly as it did.

import { normaliseModel } from "@/lib/models/registry";
import { toolFor } from "@/lib/tools/registry";

export type RunPlace = "computer" | "server";

/** SV-27 P4: the file format the weights are stored in. */
export const WEIGHTS_FORMATS = ["GGUF", "safetensors", "MLX", "other"] as const;
export type WeightsFormat = (typeof WEIGHTS_FORMATS)[number];

/** SV-27 P4: how one model is spread over several GPUs. */
export const SPLITS = ["one GPU", "by layers", "by rows", "tensor parallel", "CPU and GPU"] as const;
export type GpuSplit = (typeof SPLITS)[number];

export interface ModelRun {
  /** "full", "8-bit", "4-bit", or a quant type typed by hand (up to 20 characters, for example Q4_K_M). */
  precision?: string;
  where?: RunPlace;
  /* SV-27 P4: how the model was served. Every key is optional, so a run saved before reads as it did. */
  weights_format?: WeightsFormat;
  /** The model's size in parameters, "32B". */
  parameters?: string;
  /** The most tokens the model reads at once, as configured. */
  context_length?: number;
  /** The inference engine: a registry tool id (llama.cpp, vLLM, MLX) or a typed name. */
  engine?: string;
  /** The small model used for speculative decoding: a model id or a typed name. */
  draft_model?: string;
  split?: GpuSplit;
  /** An `inference_server` tile's node id. */
  server?: string;
  /** A `host` tile's node id. */
  host?: string;
  /** SV-29 P5: requests are submitted as an asynchronous batch, usually at batch pricing. */
  batch?: true;
}

export const PARAMETERS_MAX = 12;
export const ENGINE_MAX = 40;
export const DRAFT_MODEL_MAX = 60;
export const CONTEXT_LENGTH_MAX = 100_000_000;

export const PRECISION_OTHER_MAX = 20;
export const PRECISIONS = ["full", "8-bit", "4-bit"] as const;
export const PLACES: readonly RunPlace[] = ["computer", "server"];

/** The menu's words. */
export const RUN_COPY = {
  how: "How it was run",
  /** SV-27 P4: the first field's label; `precision` keeps its key and values. */
  precision: "Precision",
  where: "Where",
  optional: "Optional",
  full: "Full precision",
  eight: "8-bit",
  four: "4-bit",
  other: "Other",
  otherHint: "Quant type, for example Q4_K_M",
  weightsFormat: "Weights format",
  parameters: "Parameter count",
  parametersHint: "32B",
  contextLength: "Context length",
  contextLengthHint: "32768",
  engine: "Inference engine",
  engineHint: "llama.cpp",
  draftModel: "Draft model (speculative decoding)",
  draftModelHint: "A small model that drafts tokens",
  split: "Split across GPUs",
  computer: "On my computer",
  server: "On a server",
  none: "Not said",
  /* SV-29 P5. */
  batch: "Batch inference",
  batchHint: "Requests are submitted as an asynchronous batch",
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** A stored `modelRun`, read defensively; null when it says nothing. */
export function modelRunOf(value: unknown): ModelRun | null {
  if (!isRecord(value)) return null;
  const run: ModelRun = {};
  if (typeof value.precision === "string" && value.precision.trim()) run.precision = value.precision.trim().slice(0, PRECISION_OTHER_MAX);
  if (PLACES.includes(value.where as RunPlace)) run.where = value.where as RunPlace;
  if (WEIGHTS_FORMATS.includes(value.weights_format as WeightsFormat)) run.weights_format = value.weights_format as WeightsFormat;
  const text = (raw: unknown, max: number): string | undefined => (typeof raw === "string" && raw.trim() ? raw.trim().slice(0, max) : undefined);
  const parameters = text(value.parameters, PARAMETERS_MAX);
  if (parameters) run.parameters = parameters;
  if (typeof value.context_length === "number" && Number.isInteger(value.context_length) && value.context_length > 0 && value.context_length <= CONTEXT_LENGTH_MAX) run.context_length = value.context_length;
  const engine = text(value.engine, ENGINE_MAX);
  if (engine) run.engine = engine;
  const draft = text(value.draft_model, DRAFT_MODEL_MAX);
  if (draft) run.draft_model = draft;
  if (SPLITS.includes(value.split as GpuSplit)) run.split = value.split as GpuSplit;
  const server = text(value.server, 64);
  if (server) run.server = server;
  const host = text(value.host, 64);
  if (host) run.host = host;
  if (value.batch === true) run.batch = true;
  return Object.keys(run).length > 0 ? run : null;
}

/** Why a run cannot be kept, or null. */
export function modelRunRefusal(run: ModelRun): string | null {
  if (run.precision !== undefined && (!run.precision.trim() || run.precision.trim().length > PRECISION_OTHER_MAX)) return `Size: ${PRECISION_OTHER_MAX} characters max`;
  if (run.where !== undefined && !PLACES.includes(run.where)) return "That is not a place a model runs.";
  if (run.parameters !== undefined && run.parameters.trim().length > PARAMETERS_MAX) return `Parameter count: ${PARAMETERS_MAX} characters max`;
  if (run.context_length !== undefined && (!Number.isInteger(run.context_length) || run.context_length <= 0 || run.context_length > CONTEXT_LENGTH_MAX)) return "Context length: a whole number of tokens";
  if (run.weights_format !== undefined && !WEIGHTS_FORMATS.includes(run.weights_format)) return "That is not a weights format.";
  if (run.split !== undefined && !SPLITS.includes(run.split)) return "That is not a way to split a model.";
  if (run.engine !== undefined && run.engine.trim().length > ENGINE_MAX) return `Inference engine: ${ENGINE_MAX} characters max`;
  if (run.draft_model !== undefined && run.draft_model.trim().length > DRAFT_MODEL_MAX) return `Draft model: ${DRAFT_MODEL_MAX} characters max`;
  return null;
}

/** "full precision", "8-bit", "4-bit", or the quant type as typed. */
export const precisionWord = (precision: string): string => (precision === "full" ? "full precision" : precision);

/** "on my own computer", "on a server". */
export const placeWord = (where: RunPlace): string => (where === "computer" ? "on my own computer" : "on a server");

/** What the line and the Split field read of the host a run names (a Host tile, SV-27). */
export interface RunHost {
  name: string;
  gpus?: readonly { model: string; count: number; vram_gb: number }[];
}

/** SV-27 P4: Split across GPUs is asked only when the chosen host has two or more GPUs. */
export const showsSplit = (host: RunHost | null | undefined): boolean => (host?.gpus ?? []).reduce((sum, gpu) => sum + gpu.count, 0) >= 2;

/** "2 × RTX 5090", the host's GPUs; null when it names none. */
export const gpusWord = (host: RunHost | null | undefined): string | null => (host?.gpus && host.gpus.length > 0 ? host.gpus.map((gpu) => `${gpu.count} × ${gpu.model}`).join(", ") : null);

/**
 * "Muse Spark Open · 4-bit · on my own computer"; SV-27: "Qwen 32B · Q4_K_M · GGUF · llama.cpp with draft model · 2 × RTX 5090".
 * The model (with its parameter count), then only the parts that were said. With a host, its GPUs stand in for Where; a host with
 * none reads "on <name>".
 */
export function modelRunLine(model: string, run: ModelRun | null | undefined, context: { host?: RunHost | null; engineName?: string } = {}): string {
  if (!run) return model;
  const head = run.parameters ? `${model} ${run.parameters}`.trim() : model;
  const engineName = run.engine ? (context.engineName ?? toolFor(run.engine)?.name ?? run.engine) : null;
  const engine = engineName ? (run.draft_model ? `${engineName} with draft model` : engineName) : run.draft_model ? "with draft model" : null;
  const host = run.host ? (context.host ?? null) : null;
  const place = host ? (gpusWord(host) ?? (host.name ? `on ${host.name}` : null)) : run.where ? placeWord(run.where) : null;
  return [head, run.precision ? precisionWord(run.precision) : null, run.weights_format ?? null, engine, place, run.batch ? "batch inference" : null].filter(Boolean).join(" · ");
}

/** Whether the model menu gains How it was run: the tool runs models on the maker's computer, or the model's weights are open. */
export function asksHowRun(toolRaw: string | null | undefined, modelRaw: string | null | undefined): boolean {
  if (toolFor(toolRaw)?.local) return true;
  return normaliseModel(modelRaw ?? "")?.openWeights === true;
}
