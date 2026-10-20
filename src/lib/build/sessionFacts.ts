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

export type Currency = "GBP" | "USD";

export interface SessionExtras {
  /** What it cost, two decimals at most. */
  cost?: number;
  currency?: Currency;
  /** Tokens used, from a result file. */
  tokens?: number;
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
}

export const COST_MAX = 100_000;
export const TOKENS_MAX = 1_000_000_000_000;
export const STARTED_WITH_MAX = 2000;
export const OWN_COPY_MAX = 80;
export const PARALLEL_MAX = 20;
/** A session over this many words is "long". */
export const LONG_SESSION_WORDS = 100_000;

const EXTRA_KEYS = ["cost", "currency", "tokens", "cached", "words", "showCost", "background", "startedWith", "parallelWith", "ownCopy"] as const;

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
  return out;
}

/** An entry with its extras replaced by `next`: keys left out of `next` are taken off; every other key stays. */
export function withExtras<T extends object>(entry: T, next: SessionExtras): T {
  const out: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
  for (const key of EXTRA_KEYS) delete out[key];
  return { ...out, ...extrasOf(next) } as T;
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
  if (extras.startedWith !== undefined && extras.startedWith.length > STARTED_WITH_MAX) return `The command is at most ${STARTED_WITH_MAX} characters.`;
  if (extras.ownCopy !== undefined && extras.ownCopy.length > OWN_COPY_MAX) return `The name is at most ${OWN_COPY_MAX} characters.`;
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
} as const;

/** The words of a session, to the nearest thousand: it is said as "about". */
export const roundedWords = (words: number): number => Math.round(words / 1000) * 1000;

export interface FactsInput {
  extras?: SessionExtras;
  /** The session's own text, in words, worked out from its steps. */
  words?: number;
}

/**
 * The one optional line under a session head: the parts that exist, joined with " · ", or null. A maker sees all of
 * it; a reader sees the cost, the tokens and the cached sentence only when the maker ticked Show readers.
 */
export function sessionFactsLine({ extras = {}, words = 0 }: FactsInput, audience: "maker" | "reader"): string | null {
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
