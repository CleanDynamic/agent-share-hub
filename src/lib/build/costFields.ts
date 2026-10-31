// SV-27 P9: the cleaners for an agent's or team's API estimate and a Result's or Check's measured speed, registered for the
// existing extras writer (`setExtras`). Kept apart from deploymentCost.ts so the composer's chunk carries only these.

import type { Json } from "@/integrations/supabase/types";

import { registerCleaners } from "./tileExtras";

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw => (value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {});

export interface ApiEstimate {
  amount: number;
  per: "day" | "month";
}

export const API_ESTIMATE_MAX = 1_000_000;

export function apiEstimateOf(value: unknown): ApiEstimate | null {
  const raw = record(value);
  if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount) || raw.amount <= 0 || raw.amount > API_ESTIMATE_MAX) return null;
  if (raw.per !== "day" && raw.per !== "month") return null;
  return { amount: raw.amount, per: raw.per };
}

export interface Measured {
  tokens_per_second?: number;
  time_to_first_token_ms?: number;
  /** "run" when read from a run file; the maker's figure otherwise. */
  source?: "run" | "maker";
}

export function measuredOf(value: unknown): Measured | null {
  const raw = record(value);
  const out: Measured = {};
  if (typeof raw.tokens_per_second === "number" && raw.tokens_per_second > 0 && raw.tokens_per_second < 1_000_000) out.tokens_per_second = raw.tokens_per_second;
  if (typeof raw.time_to_first_token_ms === "number" && raw.time_to_first_token_ms >= 0 && raw.time_to_first_token_ms < 3_600_000) out.time_to_first_token_ms = raw.time_to_first_token_ms;
  if (raw.source === "run" || raw.source === "maker") out.source = raw.source;
  return out.tokens_per_second !== undefined || out.time_to_first_token_ms !== undefined ? out : null;
}


const estimateCleaner = (value: unknown): Json | null => {
  if (value === null || value === undefined || value === "") return null;
  const estimate = apiEstimateOf(value);
  if (!estimate) throw new Error("API estimate: an amount a day or a month");
  return estimate as unknown as Json;
};
const measuredCleaner = (value: unknown): Json | null => (measuredOf(value) as unknown as Json) ?? null;

registerCleaners("agent_config", { api_estimate: estimateCleaner });
registerCleaners("team", { api_estimate: estimateCleaner });
registerCleaners("result", { measured: measuredCleaner });
registerCleaners("eval_run", { measured: measuredCleaner });
