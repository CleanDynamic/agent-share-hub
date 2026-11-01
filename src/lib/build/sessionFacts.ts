// CA-05 — what a session carries beyond its steps, kept in `builds.making.sessions_meta[key]` beside CA-04's goal.
//
// PURE. No table, column or policy is added: these are keys of one json entry. Everything is optional and read
// defensively, so a build that never sets one reads exactly as it did.
//
//   P2  cost, currency, tokens, cached, showCost, background, words
//   P3  startedWith
//   P5  parallelWith, ownCopy
//
// Costs are always said as "about". A cost read from a Claude Code result file is in the file's own currency (US
// dollars) and is shown in it; it is never converted, because no rate is known here.

import { ACCESS_SYSTEMS, ENVIRONMENTS, ISOLATIONS, accessLine, accessOf, environmentLine, type AccessEntry, type Environment, type Isolation } from "./sessionAccess";
import { reviewLine, reviewOf, reviewRefusal, type SessionReview } from "./sessionReview";
import { outputsCountLine, outputsOf, outputsRefusal, type OutputLink } from "./sessionOutputs";
import { traceUrlOf } from "./trace";
import { EFFORTS, EFFORT_LABEL, type Effort } from "./tileExtras";

export type Currency = "GBP" | "USD";

export interface SessionExtras {
  /** What it cost, two decimals at most. */
  cost?: number;
  currency?: Currency;
  /** Tokens used, from a result file. */
  tokens?: number;
  /** CA-13 P8: how long the session ran, in milliseconds, as the maker gave it or a result file said. */
  ms?: number;
  /** CA-13 P5: a trace link for the session (https only). */
  traceUrl?: string;
  /** Tokens read from the cache, from a result file only. */
  cached?: number;
  /** Words in the whole session, when the intake knew them. */
  words?: number;
  /** Readers see the cost line only when the maker says so. */
  showCost?: boolean;
  /** Ran with nobody watching. */
  background?: boolean;
  /** CA-05 P3: the command that opened the session, as pasted. */
  startedWith?: string;
  /** CA-05 P5: the keys of the sessions it ran at the same time as. */
  parallelWith?: string[];
  /** CA-05 P5: the branch or folder it worked in. */
  ownCopy?: string;
  /** SV-30 P1: the provider's exact model ID, with its version or date ("claude-opus-4-5-20251101"). `model` stays the display name. */
  model_id?: string;
  /** SV-30 P1: the harness's reasoning effort for the session. */
  effort?: Effort;
  /** SV-30 P4: where the harness ran, how its changes were kept apart, whether it could install packages, and what it could reach. */
  environment?: Environment;
  isolation?: Isolation;
  can_install?: boolean;
  access?: AccessEntry[];
  /** SV-30 P6: how many turns the session had, and how many times it was compacted. */
  messages?: number;
  compactions?: number;
  /** SV-30 P6: which of these figures were read from the run when the session was added; any other is the maker's figure. */
  from_run?: RunKey[];
  /** SV-30 P7: what the session produced, as the maker gave it, and whether readers see it. */
  outputs?: OutputLink[];
  showOutputs?: boolean;
  /** SV-30 P8: how much of its changes a human reviewed. */
  review?: SessionReview;
  /** SV-30: the outputs (and the review) came with a copy of the original: they are the original's evidence, not this build's. */
  from_original?: boolean;
}

export const RUN_KEYS = ["messages", "compactions"] as const;
export type RunKey = (typeof RUN_KEYS)[number];

/** SV-30 P6: what the run itself showed, per session: the import's turn count, and the compaction summaries among its turns. Never stored. */
export interface RunFacts {
  messages?: number;
  compactions?: number;
}

/** The count to show and whether it was read from the run: the maker's own figure wins, then the run's. */
export function figureOf(maker: number | undefined, run: number | undefined): { value: number; from: "maker" | "run" } | null {
  if (maker !== undefined) return { value: maker, from: "maker" };
  return run !== undefined && run > 0 ? { value: run, from: "run" } : null;
}

/** Where a stored count came from: the run it was read from when the session was added, or the maker. */
export const sourceOfCount = (extras: SessionExtras, key: RunKey): "run" | "maker" => (extras.from_run?.includes(key) ? "run" : "maker");

export const countWords = {
  messages: (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "message" : "messages"}`,
  compactions: (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "compaction" : "compactions"}`,
};

export const COST_MAX = 100_000;
export const TOKENS_MAX = 1_000_000_000_000;
export const STARTED_WITH_MAX = 2000;
export const OWN_COPY_MAX = 80;
export const PARALLEL_MAX = 20;
/** SV-30 P1: the longest model ID. */
export const MODEL_ID_MAX = 80;
/** A session over this many words is "long". */
export const LONG_SESSION_WORDS = 100_000;

const EXTRA_KEYS = ["cost", "currency", "tokens", "ms", "traceUrl", "cached", "words", "showCost", "background", "startedWith", "parallelWith", "ownCopy", "model_id", "effort", "environment", "isolation", "can_install", "access", "messages", "compactions", "from_run", "outputs", "showOutputs", "review", "from_original"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const whole = (value: unknown, max: number): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max ? value : undefined;

/** The extras an entry holds, read defensively. A key that does not read is left out. */
export function extrasOf(entry: unknown): SessionExtras {
  if (!isRecord(entry)) return {};
  const out: SessionExtras = {};
  if (typeof entry.cost === "number" && Number.isFinite(entry.cost) && entry.cost >= 0 && entry.cost <= COST_MAX) {
    out.cost = Math.round(entry.cost * 100) / 100;
    out.currency = entry.currency === "USD" ? "USD" : "GBP";
  }
  const tokens = whole(entry.tokens, TOKENS_MAX);
  if (tokens !== undefined && tokens > 0) out.tokens = tokens;
  const trace = traceUrlOf(entry.traceUrl);
  if (trace) out.traceUrl = trace;
  const ms = whole(entry.ms, TOKENS_MAX);
  if (ms !== undefined && ms > 0) out.ms = ms;
  const cached = whole(entry.cached, TOKENS_MAX);
  if (cached !== undefined && cached > 0) out.cached = cached;
  const words = whole(entry.words, TOKENS_MAX);
  if (words !== undefined && words > 0) out.words = words;
  if (entry.showCost === true) out.showCost = true;
  if (entry.background === true) out.background = true;
  if (typeof entry.startedWith === "string" && entry.startedWith.trim()) out.startedWith = entry.startedWith.trim().slice(0, STARTED_WITH_MAX);
  if (Array.isArray(entry.parallelWith)) {
    const keys = [...new Set(entry.parallelWith.filter((key): key is string => typeof key === "string" && key.length > 0))].slice(0, PARALLEL_MAX);
    if (keys.length > 0) out.parallelWith = keys;
  }
  if (typeof entry.ownCopy === "string" && entry.ownCopy.trim()) out.ownCopy = entry.ownCopy.trim().slice(0, OWN_COPY_MAX);
  const modelId = typeof entry.model_id === "string" ? entry.model_id.trim() : "";
  if (modelId) out.model_id = modelId.slice(0, MODEL_ID_MAX);
  if (EFFORTS.includes(entry.effort as Effort)) out.effort = entry.effort as Effort;
  if (ENVIRONMENTS.includes(entry.environment as Environment)) out.environment = entry.environment as Environment;
  if (ISOLATIONS.includes(entry.isolation as Isolation)) out.isolation = entry.isolation as Isolation;
  if (typeof entry.can_install === "boolean") out.can_install = entry.can_install;
  const access = accessOf(entry.access);
  if (access.length > 0) out.access = access;
  const messages = whole(entry.messages, TOKENS_MAX);
  if (messages !== undefined && messages > 0) out.messages = messages;
  const compactions = whole(entry.compactions, 10_000);
  if (compactions !== undefined && compactions > 0) out.compactions = compactions;
  if (Array.isArray(entry.from_run)) {
    const kept = RUN_KEYS.filter((key) => (entry.from_run as unknown[]).includes(key) && out[key] !== undefined);
    if (kept.length > 0) out.from_run = kept;
  }
  const outputs = outputsOf(entry.outputs);
  if (outputs.length > 0) out.outputs = outputs;
  if (entry.showOutputs === true) out.showOutputs = true;
  const review = reviewOf(entry.review);
  if (review) out.review = review;
  if (entry.from_original === true) out.from_original = true;
  return out;
}

/** An entry with its extras replaced by `next`: keys left out of `next` are taken off; every other key stays. */
export function withExtras<T extends object>(entry: T, next: SessionExtras): T {
  const out: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
  for (const key of EXTRA_KEYS) delete out[key];
  return { ...out, ...extrasOf(next) } as T;
}

/** SV-30: the facts of a session that are METHOD, and travel with a copy of it. */
export const METHOD_FACT_KEYS = ["model_id", "effort", "environment", "isolation", "can_install", "access"] as const;

/**
 * SV-30: the facts a copy of a session starts with. How it was run (model, effort, environment, isolation, access) is method and is
 * kept. What it cost, how long it ran, what it produced and who reviewed it belong to the run that earned them, so they stay with the
 * original (later parts add the evidence the copy keeps, labelled as the original's).
 */
export function copiedFacts(extras: unknown): SessionExtras {
  const read = extrasOf(extras);
  const out: Record<string, unknown> = {};
  for (const key of METHOD_FACT_KEYS) if (read[key] !== undefined) out[key] = read[key];
  // What it produced is the original's evidence: kept, labelled as the original's, and not shown to readers until the copier says so.
  if (read.outputs) out.outputs = read.outputs;
  if (read.review) out.review = read.review;
  if (read.outputs || read.review) out.from_original = true;
  return out as SessionExtras;
}

/** What the cost well shows and what it takes back: a number with at most two decimals, or nothing. */
export function costField(value: string): number | undefined | null {
  const said = value.trim().replace(/^[£$]/, "").replace(/,/g, "");
  if (!said) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(said)) return null;
  const n = Number(said);
  return n >= 0 && n <= COST_MAX ? n : null;
}

/** Why extras cannot be saved, or null. */
export function extrasRefusal(extras: SessionExtras): string | null {
  if (extras.cost !== undefined && (!Number.isFinite(extras.cost) || extras.cost < 0 || extras.cost > COST_MAX)) return `What it cost is a number from 0 to ${COST_MAX.toLocaleString("en-GB")}.`;
  if (extras.startedWith !== undefined && extras.startedWith.length > STARTED_WITH_MAX) return `Command: ${STARTED_WITH_MAX} characters max`;
  if (extras.ownCopy !== undefined && extras.ownCopy.length > OWN_COPY_MAX) return `Name: ${OWN_COPY_MAX} characters max`;
  if (extras.model_id !== undefined && extras.model_id.trim().length > MODEL_ID_MAX) return `Model ID: ${MODEL_ID_MAX} characters max`;
  if (extras.effort !== undefined && !EFFORTS.includes(extras.effort)) return "Reasoning effort is default, low or high.";
  if (extras.environment !== undefined && !ENVIRONMENTS.includes(extras.environment)) return "Where it ran is the maker's machine, a remote environment or a cloud sandbox.";
  if (extras.isolation !== undefined && !ISOLATIONS.includes(extras.isolation)) return "Isolation is a worktree, a container, a virtual machine or none.";
  if (extras.access && (extras.access.length > ACCESS_SYSTEMS.length || accessOf(extras.access).length !== extras.access.length)) return "Access is a system and read or write, once each.";
  if (extras.messages !== undefined && !(Number.isInteger(extras.messages) && extras.messages >= 0)) return "Messages is a whole number.";
  if (extras.compactions !== undefined && !(Number.isInteger(extras.compactions) && extras.compactions >= 0 && extras.compactions <= 10_000)) return "Compactions is a whole number.";
  if (extras.outputs) {
    const why = outputsRefusal(extras.outputs);
    if (why) return why;
  }
  if (extras.review) {
    const why = reviewRefusal(extras.review);
    if (why) return why;
  }
  if (extras.parallelWith && extras.parallelWith.length > PARALLEL_MAX) return `At most ${PARALLEL_MAX} sessions ran at the same time.`;
  return null;
}

/* ── the line under a session's head ── */

export const FACTS_COPY = {
  long: (words: number) => `Long session, about ${words.toLocaleString("en-GB")} words. Smaller models may not read it all at once.`,
  cost: (cost: number, currency: Currency) => `Cost about ${currency === "USD" ? "$" : "£"}${cost.toFixed(2)}`,
  tokens: (tokens: number) => (tokens >= 1_000_000 ? `${(Math.round(tokens / 100_000) / 10).toString()} million tokens` : `${tokens.toLocaleString("en-GB")} tokens`),
  cached: "Later runs cost less, because the start is reused.",
  background: "Ran in the background",
  /** SV-30 P1. */
  effort: (effort: Effort) => `Reasoning effort: ${EFFORT_LABEL[effort].toLowerCase()}`,
} as const;

/** SV-30 P1: "Claude Opus 4.5 (claude-opus-4-5-20251101)"; the display name alone, or the ID alone, when only one is known. */
export function modelWithId(display: string | null | undefined, id: string | null | undefined): string | null {
  const name = display?.trim() ?? "";
  const modelId = id?.trim() ?? "";
  if (name && modelId && name !== modelId) return `${name} (${modelId})`;
  return name || modelId || null;
}

/** The words of a session, to the nearest thousand: it is said as "about". */
export const roundedWords = (words: number): number => Math.round(words / 1000) * 1000;

export interface FactsInput {
  extras?: SessionExtras;
  /** The session's own text, in words, worked out from its steps. */
  words?: number;
  /** SV-30 P1: the session's display model name, so a model ID is said beside it. */
  model?: string | null;
  /** SV-30 P6: what the import showed (its turns, its compaction summaries), used where the maker gave no figure. */
  run?: RunFacts;
}

/**
 * The one optional line under a session head: the parts that exist, joined with " · ", or null. A maker sees all of
 * it; a reader sees the cost, the tokens and the cached sentence only when the maker ticked Show readers.
 */
export function sessionFactsLine({ extras = {}, words = 0, model = null, run = {} }: FactsInput, audience: "maker" | "reader"): string | null {
  const total = Math.max(words, extras.words ?? 0);
  const costShown = audience === "maker" || extras.showCost === true;
  const parts: string[] = [];
  if (total > LONG_SESSION_WORDS) parts.push(FACTS_COPY.long(roundedWords(total)));
  if (costShown) {
    const cost = [
      extras.cost !== undefined ? FACTS_COPY.cost(extras.cost, extras.currency ?? "GBP") : null,
      extras.tokens !== undefined ? FACTS_COPY.tokens(extras.tokens) : null,
    ].filter((part): part is string => part !== null);
    if (cost.length > 0) parts.push(cost.join(" and "));
    if (extras.cached) parts.push(FACTS_COPY.cached);
  }
  const messages = figureOf(extras.messages, run.messages);
  const compactions = figureOf(extras.compactions, run.compactions);
  if (messages) parts.push(countWords.messages(messages.value));
  if (compactions) parts.push(countWords.compactions(compactions.value));
  // SV-30 P7: the count of what it produced; readers get it only when the maker ticked Show readers.
  const produced = audience === "maker" || extras.showOutputs === true ? outputsCountLine(extras.outputs ?? []) : null;
  if (produced) parts.push(extras.from_original ? `The original's: ${produced}` : produced);
  // SV-30 P8: how much a human reviewed. It is a fact the maker states about their own work, so readers see it.
  if (extras.review) parts.push(extras.from_original ? `The original's: ${reviewLine(extras.review)}` : reviewLine(extras.review));
  if (extras.model_id) parts.push(modelWithId(model, extras.model_id) as string);
  if (extras.effort) parts.push(FACTS_COPY.effort(extras.effort));
  const environment = environmentLine(extras);
  if (environment) parts.push(environment);
  const access = accessLine(extras.access);
  if (access) parts.push(access);
  if (extras.background) parts.push(FACTS_COPY.background);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/* ── a Claude Code result file ── */

export interface ResultFileFacts {
  /** US dollars, as the file reports it. */
  cost?: number;
  tokens?: number;
  cached?: number;
}

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0);

/** The result object of a script run's JSON output: the object itself, the last result in an array, or in JSON lines. */
function resultOf(text: string): Record<string, unknown> | null {
  const take = (value: unknown): Record<string, unknown> | null => {
    if (Array.isArray(value)) return [...value].reverse().map(take).find((found) => found !== null) ?? null;
    return isRecord(value) && value.type === "result" ? value : null;
  };
  try {
    return take(JSON.parse(text));
  } catch {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().startsWith("{"));
    for (const line of lines.reverse()) {
      try {
        const found = take(JSON.parse(line));
        if (found) return found;
      } catch {
        /* a line that is not JSON */
      }
    }
    return null;
  }
}

/**
 * What a Claude Code result file reports: the estimated total cost and the tokens used, and the tokens read from the
 * cache. Null when the text is not a result. Only keys the file has are returned; nothing is guessed.
 */
export function readResultFile(text: string): ResultFileFacts | null {
  if (!text.includes('"result"')) return null;
  const result = resultOf(text);
  if (!result) return null;
  const usage = isRecord(result.usage) ? result.usage : {};
  const cached = count(usage.cache_read_input_tokens);
  const tokens = count(usage.input_tokens) + count(usage.output_tokens) + count(usage.cache_creation_input_tokens) + cached;
  const cost = typeof result.total_cost_usd === "number" && Number.isFinite(result.total_cost_usd) && result.total_cost_usd >= 0 ? result.total_cost_usd : undefined;
  if (cost === undefined && tokens === 0) return null;
  return { ...(cost !== undefined ? { cost: Math.round(cost * 100) / 100 } : null), ...(tokens > 0 ? { tokens } : null), ...(cached > 0 ? { cached } : null) };
}

/* ── sessions at the same time (CA-05 P5) ── */

/**
 * "At the same time as Session 3 · own copy: fix-totals", the parts that exist; null when there are none. `numberOf`
 * gives a session's number from its key; a key that names no session of the build is left out.
 */
export function togetherLine(extras: SessionExtras | undefined, numberOf: (key: string) => number | undefined): string | null {
  const numbers = (extras?.parallelWith ?? []).flatMap((key) => {
    const number = numberOf(key);
    return number === undefined ? [] : [number];
  });
  const parts: string[] = [];
  if (numbers.length > 0) {
    const names = [...new Set(numbers)].sort((a, b) => a - b).map((number) => `Session ${number}`);
    parts.push(`At the same time as ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}`);
  }
  if (extras?.ownCopy) parts.push(parts.length > 0 ? `own copy: ${extras.ownCopy}` : `Own copy: ${extras.ownCopy}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Sessions that ran at the same time are a pair both ways: marking 2 against 3 marks 3 against 2. Given what is stored
 * and the new list for one session, the lists that change: this session's own, and every other session whose list
 * gains or loses it. Pure; a session whose list does not change is not in the result.
 */
export function togetherChanges(stored: Readonly<Record<string, readonly string[] | undefined>>, key: string, next: readonly string[]): Record<string, string[]> {
  const wanted = [...new Set(next.filter((other) => other !== key))].slice(0, PARALLEL_MAX);
  const out: Record<string, string[]> = {};
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value) => b.includes(value));
  if (!same(stored[key] ?? [], wanted)) out[key] = wanted;
  const others = new Set([...Object.keys(stored), ...wanted]);
  others.delete(key);
  for (const other of others) {
    const has = stored[other] ?? [];
    const should = wanted.includes(other);
    if (should === has.includes(key)) continue;
    out[other] = should ? [...has, key].slice(0, PARALLEL_MAX) : has.filter((value) => value !== key);
  }
  return out;
}
