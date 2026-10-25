// CA-05 P8 — how a model was run: its size and where. Kept beside the model as `payload.modelRun = { precision, where }`.
//
// PURE. It matters for a model that runs on the maker's own computer (Ollama, LM Studio) and for one whose weights are
// open (Muse Spark Open, GPT-OSS-120b): the same model gives different answers at a smaller size. Both keys are
// optional, and a model with neither reads exactly as it did.

import { normaliseModel } from "@/lib/models/registry";
import { toolFor } from "@/lib/tools/registry";

export type RunPlace = "computer" | "server";

export interface ModelRun {
  /** "full", "8-bit", "4-bit", or a name typed by hand (up to 20 characters). */
  precision?: string;
  where?: RunPlace;
}

export const PRECISION_OTHER_MAX = 20;
export const PRECISIONS = ["full", "8-bit", "4-bit"] as const;
export const PLACES: readonly RunPlace[] = ["computer", "server"];

/** The menu's words. */
export const RUN_COPY = {
  how: "How it was run",
  where: "Where",
  optional: "Optional",
  full: "Full size",
  eight: "8-bit",
  four: "4-bit",
  other: "Other",
  otherHint: "Q5_K_M",
  computer: "On my computer",
  server: "On a server",
  none: "Not said",
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** A stored `modelRun`, read defensively; null when it says nothing. */
export function modelRunOf(value: unknown): ModelRun | null {
  if (!isRecord(value)) return null;
  const run: ModelRun = {};
  if (typeof value.precision === "string" && value.precision.trim()) run.precision = value.precision.trim().slice(0, PRECISION_OTHER_MAX);
  if (PLACES.includes(value.where as RunPlace)) run.where = value.where as RunPlace;
  return run.precision || run.where ? run : null;
}

/** Why a run cannot be kept, or null. */
export function modelRunRefusal(run: ModelRun): string | null {
  if (run.precision !== undefined && (!run.precision.trim() || run.precision.trim().length > PRECISION_OTHER_MAX)) return `Size: ${PRECISION_OTHER_MAX} characters max`;
  if (run.where !== undefined && !PLACES.includes(run.where)) return "That is not a place a model runs.";
  return null;
}

/** "full size", "8-bit", "4-bit", or the name as typed. */
export const precisionWord = (precision: string): string => (precision === "full" ? "full size" : precision);

/** "on my own computer", "on a server". */
export const placeWord = (where: RunPlace): string => (where === "computer" ? "on my own computer" : "on a server");

/** "Muse Spark Open · 4-bit · on my own computer": the model, then the parts that were said. */
export function modelRunLine(model: string, run: ModelRun | null | undefined): string {
  if (!run) return model;
  return [model, run.precision ? precisionWord(run.precision) : null, run.where ? placeWord(run.where) : null].filter(Boolean).join(" · ");
}

/** Whether the model menu gains How it was run: the tool runs models on the maker's computer, or the model's weights are open. */
export function asksHowRun(toolRaw: string | null | undefined, modelRaw: string | null | undefined): boolean {
  if (toolFor(toolRaw)?.local) return true;
  return normaliseModel(modelRaw ?? "")?.openWeights === true;
}
