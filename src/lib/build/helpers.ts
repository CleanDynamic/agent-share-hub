// CA-13 Part 6: helper models around a long-running agent, pure.
//
// ScaleDown's constrained decoding models (Summarize, Compress, Extract, Classify) are attached to a LangChain Deep Agents
// agent as middleware: one summarizes history at a trigger, one compresses tool results, one extracts fields from user
// messages, one classifies the run to stop it when it loops. A helper belongs to how the finished thing RUNS: its "did" is
// what it did on the maker's run, never a vendor's benchmark. Nothing here runs or evaluates anything.

import { toolName } from "@/lib/tools/registry";

export type HelperJob = "summarize" | "compress" | "extract" | "classify" | "decide";

export const HELPER_JOBS: readonly HelperJob[] = ["summarize", "compress", "extract", "classify", "decide"];
export const HELPER_JOB_LABEL: Record<HelperJob, string> = { summarize: "Summarize", compress: "Compress", extract: "Extract", classify: "Classify", decide: "Decide" };

export const HELPERS_MAX = 12;
export const HELPER_FIELDS_MAX = 20;

export type DidUnit = "characters" | "tokens";

export interface HelperDid {
  times?: number;
  before?: number;
  after?: number;
  unit?: DidUnit;
  values?: Record<string, string>;
  stopped?: { label: string; score: number };
  /** Where the figures came from: one read from the run, or the maker's own. */
  source: "run" | "maker";
}

export interface Helper {
  /** "scaledown", "typesafe", or typed. */
  provider: string;
  job: HelperJob;
  /** Summarize: the model it runs on, as the maker gives it ("openai:gpt-6-sol"). */
  model?: string;
  /** Summarize: when the history reaches `at` (a share of the context) and which newest share to `keep`. */
  trigger?: { at?: number; keep?: number };
  /** Compress: which tools' results. */
  tools?: string[];
  /** Extract: the fields to pull out. */
  fields?: string[];
  /** Classify: its labels. */
  labels?: string[];
  /** Classify as a circuit breaker: stop when a non-progress label scores at or above this. */
  stopAt?: number;
  /** Decide: a Decision node id. */
  questions?: string;
  did?: HelperDid;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const unit = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined);
const count = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined);
const strings = (value: unknown, max = HELPER_FIELDS_MAX): string[] =>
  (Array.isArray(value) ? value : []).flatMap((entry) => (str(entry) ? [(entry as string).trim().slice(0, 60)] : [])).slice(0, max);

function didOf(raw: unknown): HelperDid | undefined {
  if (!isRecord(raw)) return undefined;
  const times = count(raw.times);
  const before = count(raw.before);
  const after = count(raw.after);
  const unitOf = raw.unit === "characters" || raw.unit === "tokens" ? raw.unit : undefined;
  const values = isRecord(raw.values) ? Object.fromEntries(Object.entries(raw.values).flatMap(([k, v]) => (str(v) ? [[k.slice(0, 60), (v as string).trim().slice(0, 200)]] : []))) : undefined;
  const stopped = isRecord(raw.stopped) && str(raw.stopped.label) && typeof raw.stopped.score === "number" && Number.isFinite(raw.stopped.score) ? { label: (raw.stopped.label as string).trim(), score: raw.stopped.score } : undefined;
  const source = raw.source === "run" ? "run" : "maker";
  const out: HelperDid = { source, ...(times !== undefined ? { times } : null), ...(before !== undefined ? { before } : null), ...(after !== undefined ? { after } : null), ...(unitOf ? { unit: unitOf } : null), ...(values && Object.keys(values).length ? { values } : null), ...(stopped ? { stopped } : null) };
  return Object.keys(out).length > 1 ? out : undefined;
}

/** An agent's helpers, read defensively: at most twelve; an entry with no known job or no provider is skipped. */
export function helpersOf(raw: unknown): Helper[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): Helper[] => {
    if (!isRecord(entry) || !HELPER_JOBS.includes(entry.job as HelperJob)) return [];
    const provider = str(entry.provider);
    if (!provider) return [];
    const job = entry.job as HelperJob;
    const trigger = isRecord(entry.trigger) ? { ...(unit(entry.trigger.at) !== undefined ? { at: unit(entry.trigger.at) as number } : null), ...(unit(entry.trigger.keep) !== undefined ? { keep: unit(entry.trigger.keep) as number } : null) } : undefined;
    const tools = strings(entry.tools);
    const fields = strings(entry.fields);
    const labels = strings(entry.labels);
    const stopAt = unit(entry.stopAt);
    const did = didOf(entry.did);
    return [
      {
        provider,
        job,
        ...(str(entry.model) ? { model: (entry.model as string).trim().slice(0, 80) } : null),
        ...(trigger && Object.keys(trigger).length ? { trigger } : null),
        ...(tools.length ? { tools } : null),
        ...(fields.length ? { fields } : null),
        ...(labels.length ? { labels } : null),
        ...(stopAt !== undefined ? { stopAt } : null),
        ...(str(entry.questions) ? { questions: (entry.questions as string).trim() } : null),
        ...(did ? { did } : null),
      },
    ];
  }).slice(0, HELPERS_MAX);
}

// --- checking -----------------------------------------------------------------

/** Why these helpers cannot be saved, or null. Fixed words only. */
export function helpersRefusal(helpers: readonly Helper[]): string | null {
  if (helpers.length > HELPERS_MAX) return `An agent has ${HELPERS_MAX} helpers at most`;
  for (const helper of helpers) {
    if (!HELPER_JOBS.includes(helper.job)) return "A helper needs its job";
    if (!helper.provider.trim()) return `The ${HELPER_JOB_LABEL[helper.job].toLowerCase()} helper needs its provider`;
    if (helper.job === "extract" && (helper.fields ?? []).length === 0) return "The extract helper needs the fields to pull out";
    if (helper.job === "classify" && (helper.labels ?? []).length === 0) return "The classify helper needs its labels";
    if (helper.job === "decide" && !helper.questions) return "The decide helper needs a decision";
  }
  return null;
}

// --- wording ------------------------------------------------------------------

const percent = (share: number): string => `${Math.round(share * 100)}%`;
const comma = (n: number): string => n.toLocaleString("en-GB");

/** "Summarize at 80%", "Compress fetch_docs", "Extract order_id, issue_type", "Stop if looping", "Decide: team". */
export function helperChip(helper: Helper, decisionName?: (id: string) => string | undefined): string {
  switch (helper.job) {
    case "summarize":
      return helper.trigger?.at !== undefined ? `Summarize at ${percent(helper.trigger.at)}` : "Summarize";
    case "compress":
      return helper.tools?.length ? `Compress ${helper.tools.join(", ")}` : "Compress tool results";
    case "extract":
      return `Extract ${(helper.fields ?? []).join(", ")}`.trim();
    case "classify":
      return helper.stopAt !== undefined ? "Stop if looping" : `Classify ${(helper.labels ?? []).join(", ")}`.trim();
    case "decide":
      return `Decide: ${(helper.questions ? decisionName?.(helper.questions) : undefined) ?? "a decision"}`;
  }
}

/** The share a helper made smaller, worked out from its before and after, never typed: 18,402 to 3,110 is 83%. */
export function smallerBy(before: number | undefined, after: number | undefined): number | null {
  if (before === undefined || after === undefined || before <= 0 || after > before) return null;
  return Math.round((1 - after / before) * 100);
}

/** "18,402 → 3,110 characters (83% smaller)", or null when there is no before and after. */
export function beforeAfterLine(did: HelperDid | undefined): string | null {
  if (!did || did.before === undefined || did.after === undefined) return null;
  const smaller = smallerBy(did.before, did.after);
  return `${comma(did.before)} → ${comma(did.after)} ${did.unit ?? "characters"}${smaller !== null ? ` (${smaller}% smaller)` : ""}`;
}

/** The quiet second line of a chip: "6 times", "83% smaller", "order_id = 4821", "stopped once, looping 0.86". */
export function helperDidLine(helper: Helper): string | null {
  const did = helper.did;
  if (!did) return null;
  if (helper.job === "summarize" && did.times !== undefined) return `${did.times} ${did.times === 1 ? "time" : "times"}`;
  if (helper.job === "compress") {
    const smaller = smallerBy(did.before, did.after);
    if (smaller !== null) return `${smaller}% smaller`;
  }
  if (helper.job === "extract" && did.values && Object.keys(did.values).length) return Object.entries(did.values).map(([k, v]) => `${k} = ${v}`).join(", ");
  if (helper.job === "classify" && did.stopped) return `stopped ${did.times && did.times !== 1 ? `${did.times} times` : "once"}, ${did.stopped.label} ${Math.round(did.stopped.score * 100) / 100}`;
  if (did.times !== undefined) return `${did.times} ${did.times === 1 ? "time" : "times"}`;
  return null;
}

/** "Helpers cut about 310k tokens a run", only when a helper gave its before and after in tokens. Never characters, never a guess. */
export function helperSavingsLine(helpers: readonly Helper[]): string | null {
  const saved = helpers.reduce((sum, helper) => (helper.did?.unit === "tokens" && helper.did.before !== undefined && helper.did.after !== undefined && helper.did.before >= helper.did.after ? sum + (helper.did.before - helper.did.after) : sum), 0);
  if (saved <= 0) return null;
  const rounded = saved >= 1_000_000 ? `${Math.round(saved / 100_000) / 10}M` : saved >= 1000 ? `${Math.round(saved / 1000)}k` : String(saved);
  return `Helpers cut about ${rounded} tokens a run`;
}

/** The label for a helper's provider: ScaleDown, TypeSafe, or as typed. */
export const providerLabel = (provider: string): string => (/^scaledown$/i.test(provider) ? "ScaleDown" : /^typesafe$/i.test(provider) ? "TypeSafe" : (toolName(provider) ?? provider));

/** The mark's tool id for a provider: a runtime entry of that provider when there is one. */
export function markTool(provider: string, job: HelperJob): string {
  if (/scaledown/i.test(provider)) return job === "summarize" ? "scaledown-summarize" : job === "compress" ? "scaledown-compress" : job === "extract" ? "scaledown-extract" : "scaledown-classify";
  if (/typesafe|jev/i.test(provider)) return "typesafe-jev";
  return provider;
}
