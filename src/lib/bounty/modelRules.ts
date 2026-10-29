// SV-22 P2: model tests and the release check, worked out from rows. PURE: no Supabase.

import { modelById } from "@/lib/models/registry";

export interface ReleasedModel {
  modelId: string;
  /** YYYY-MM-DD. */
  releasedOn: string;
}

/** One model's proof on one build, as `getReproductionsByModel` returns it. */
export interface ProofRow {
  modelId: string | null;
  modelName: string;
  runs: number;
  worked: number;
}

export interface ModelTestRow {
  model: string;
  state: "untested" | "worked" | "failed";
  runs?: number;
  worked?: number;
}

/** The registry's name for a model id, or the id as written. */
export const nameOfModel = (modelId: string): string => modelById(modelId)?.name ?? modelId;

/** Most rows a request draws: the released models still untested, then the models people ran it on. */
export const MODEL_ROWS_UNTESTED = 2;
export const MODEL_ROWS_RUN = 4;

/**
 * A build's model test: every recent release nobody has run it on, newest first (the request is for the first), then the
 * models it was run on, most worked first (the order `getReproductionsByModel` gives). Null when it has been run on every
 * release, so there is nothing to ask for.
 */
export function modelTestFor(proofs: readonly ProofRow[], releases: readonly ReleasedModel[]): { target: string; rows: ModelTestRow[] } | null {
  const ran = new Set(proofs.flatMap((proof) => (proof.modelId ? [proof.modelId] : [])));
  const untested = [...releases].sort((a, b) => b.releasedOn.localeCompare(a.releasedOn)).filter((release) => !ran.has(release.modelId));
  if (untested.length === 0) return null;
  const rows: ModelTestRow[] = [
    ...untested.slice(0, MODEL_ROWS_UNTESTED).map((release) => ({ model: nameOfModel(release.modelId), state: "untested" as const })),
    ...proofs.slice(0, MODEL_ROWS_RUN).map((proof) => ({ model: proof.modelName, state: proof.worked > 0 ? ("worked" as const) : ("failed" as const), runs: proof.runs, worked: proof.worked })),
  ];
  return { target: nameOfModel(untested[0].modelId), rows };
}

export type BarState = "works" | "fails" | "untested";

/** The release check's bars: a build that works is as tall as the runs that worked it (40 to 100), one that fails or is not tested has one height. */
export function releaseBars(rows: readonly { s: BarState; n: number }[]): { state: BarState; height: number }[] {
  return rows.map((row) => ({ state: row.s, height: row.s === "works" ? Math.min(100, 40 + row.n * 12) : row.s === "fails" ? 34 : 22 }));
}

/** "released today", "released 3 days ago", "released 3 weeks ago", then "released 3 Oct". */
export function releasedWords(releasedOn: string, now: number): string {
  const at = Date.parse(`${releasedOn}T00:00:00Z`);
  if (Number.isNaN(at)) return "";
  const days = Math.max(0, Math.floor((now - at) / 86_400_000));
  if (days === 0) return "released today";
  if (days < 14) return `released ${days} ${days === 1 ? "day" : "days"} ago`;
  if (days < 60) return `released ${Math.floor(days / 7)} weeks ago`;
  return `released ${new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}
