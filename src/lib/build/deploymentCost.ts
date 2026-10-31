// SV-27 P9: costs that keep setup, running and an API estimate apart. CA-13's rule 3 holds and is extended: what it costs to
// build, to set up, to run, and the maker's estimate of a hosted API never share a line or a total. Every figure says whose it
// is ("Maker's figure", "From the run"), and money shows to readers only when the maker ticks Show readers (`showCost`).
// PURE, but for registering the cleaners the existing extras writer uses.

import type { Json } from "@/integrations/supabase/types";

import { money, runCostOf, runLine, type RunCost } from "./cost";
import { deploymentName, deploymentTilesOf } from "./deployment";
import { registerCleaners } from "./tileExtras";

type Currency = "GBP" | "USD";
type Raw = Record<string, unknown>;
const record = (value: unknown): Raw => (value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {});

export const COST_COPY = {
  setUp: "To set up",
  estimate: "API estimate",
  makers: "maker's figure",
  fromRun: "From the run",
  makersFigure: "Maker's figure",
} as const;

/* ── To set up ── */

/** The one-off figures the deployment names: a host's hardware, an inference server's or billing's setup. Each is the maker's. */
export function setupCostsOf(tree: readonly { id: string; type: string; title?: string | null; payload?: unknown; parent_id: string | null; position?: number | null }[]): { id: string; name: string; amount: number }[] {
  return deploymentTilesOf(tree).flatMap((tile) => {
    const amount = "setup_cost" in tile.payload ? tile.payload.setup_cost : undefined;
    return typeof amount === "number" && amount > 0 ? [{ id: tile.id, name: deploymentName(tile), amount }] : [];
  });
}

/** "To set up: £4,200.00 · Workstation (maker's figure)"; null when nothing is said or money is hidden. Never added to anything else. */
export function setupLine(costs: readonly { name: string; amount: number }[], currency: Currency, showMoney: boolean): string | null {
  if (!showMoney || costs.length === 0) return null;
  const total = costs.reduce((sum, cost) => sum + cost.amount, 0);
  return `${COST_COPY.setUp}: ${money(total, currency)} · ${costs.map((cost) => cost.name).join(", ")} (${COST_COPY.makers})`;
}

/* ── To run: a deployment tile's running cost, per its own unit ── */

/** Each deployment tile's running cost (`run_cost`, per call, run, hour or day), each on its own line: nothing is summed across units. */
export function deploymentRunLines(tree: readonly { id: string; type: string; title?: string | null; payload?: unknown; parent_id: string | null; position?: number | null }[], showMoney: boolean): string[] {
  return deploymentTilesOf(tree).flatMap((tile) => {
    const node = tree.find((entry) => entry.id === tile.id);
    const cost: RunCost | null = runCostOf(record(node?.payload).run_cost);
    const line = runLine(cost, showMoney);
    return line ? [`${deploymentName(tile)} · ${line} (${cost?.source === "run" ? COST_COPY.fromRun.toLowerCase() : COST_COPY.makers})`] : [];
  });
}

/* ── API estimate ── */

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

/** "Through a hosted API instead: about £20.00 a month (maker's estimate)"; null without one or with money hidden. */
export function apiEstimateLine(estimate: ApiEstimate | null, currency: Currency, showMoney: boolean): string | null {
  if (!estimate || !showMoney) return null;
  return `Through a hosted API instead: about ${money(estimate.amount, currency)} a ${estimate.per} (maker's estimate)`;
}

/* ── Measured speed: evidence ── */

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

/** "92 tokens a second · 240 ms to the first token · Maker's figure". */
export function measuredLine(measured: Measured | null): string | null {
  if (!measured) return null;
  const parts = [measured.tokens_per_second !== undefined ? `${measured.tokens_per_second} tokens a second` : null, measured.time_to_first_token_ms !== undefined ? `${measured.time_to_first_token_ms} ms to the first token` : null].filter(Boolean);
  return parts.length > 0 ? `${parts.join(" · ")} · ${measured.source === "run" ? COST_COPY.fromRun : COST_COPY.makersFigure}` : null;
}

/* ── Compare: plain differences ── */

/** "about £4,000.00 more to set up", or null when either side said nothing, or money is hidden on either. */
export function setupDifference(a: number | null, b: number | null, currency: Currency): string | null {
  if (a === null || b === null || a === b) return null;
  return `about ${money(Math.abs(a - b), currency)} ${a > b ? "more" : "less"} to set up`;
}

/* ── cleaners ── */

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
