// CA-13 Part 8: what it took to make, and what it costs to run. Pure.
//
// TWO DIFFERENT THINGS, NEVER ADDED TOGETHER (rule 3).
//   Cost to BUILD: what the maker's AI work cost while building (sessions and prompts: `SessionExtras`, and `build_cost` on a
//   prompt or any other tile). Cost to RUN: what the finished product costs each time it works, on runtime tiles only
//   (decisions, agents, code that calls a model, helpers): `run_cost`, per call, run, hour or day. They never share a line or
//   a total, and "to run" is summed only across tiles that are per the same unit.
//
// A figure a maker typed is theirs ("Maker's figure"); one read from a run file is "From the run". The site never states a
// vendor's figure as fact. Money is shown to readers only when the maker ticked Show readers (`showCost`); time and tokens
// show whenever they are given.

import type { Currency, SessionExtras } from "./sessionFacts";

export type CostSource = "run" | "maker";
/** SV-29 P5: `item` is the cost of processing one item (a product, a ticket), with the item's noun. */
export type RunPer = "call" | "run" | "hour" | "day" | "item";
/** SV-29 P5: the API's real-time pricing, or its batch pricing. */
export type Pricing = "standard" | "batch";

export interface CostFigures {
  ms?: number;
  tokensIn?: number;
  tokensOut?: number;
  cached?: number;
  cost?: number;
  currency?: Currency;
  source: CostSource;
}

export interface RunCost extends CostFigures {
  per: RunPer;
  /** `item` only: what one item is, up to 20 characters ("product"). Stored as `item_noun`. */
  itemNoun?: string;
  pricing?: Pricing;
}

export const RUN_PERS: readonly RunPer[] = ["call", "run", "hour", "day", "item"];
export const ITEM_NOUN_MAX = 20;
export const PRICINGS: readonly Pricing[] = ["standard", "batch"];
export const PRICING_LABEL: Record<Pricing, string> = { standard: "Standard pricing", batch: "Batch pricing" };

/** SV-29 P5: how many items a day a runtime tile processes (`payload.volume`). */
export interface Volume {
  count: number;
  per: "day";
}
export const VOLUME_MAX = 1_000_000_000_000;
export const VOLUME_LABEL = "Daily volume";

/** `payload.volume`, read defensively. */
export function volumeOf(raw: unknown): Volume | null {
  return isRecord(raw) && raw.per === "day" && whole(raw.count, VOLUME_MAX) !== undefined && (raw.count as number) > 0 ? { count: raw.count as number, per: "day" } : null;
}
export const COST_LIMITS = { ms: 31_536_000_000, tokens: 1_000_000_000_000, cost: 100_000 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const whole = (value: unknown, max: number): number | undefined => (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max ? value : undefined);

function figuresOf(raw: Record<string, unknown>): Omit<CostFigures, "source"> {
  const out: Omit<CostFigures, "source"> = {};
  const ms = whole(raw.ms, COST_LIMITS.ms);
  if (ms !== undefined) out.ms = ms;
  const tokensIn = whole(raw.tokensIn, COST_LIMITS.tokens);
  if (tokensIn !== undefined) out.tokensIn = tokensIn;
  const tokensOut = whole(raw.tokensOut, COST_LIMITS.tokens);
  if (tokensOut !== undefined) out.tokensOut = tokensOut;
  const cached = whole(raw.cached, COST_LIMITS.tokens);
  if (cached !== undefined) out.cached = cached;
  if (typeof raw.cost === "number" && Number.isFinite(raw.cost) && raw.cost >= 0 && raw.cost <= COST_LIMITS.cost) {
    // Run costs can be a fraction of a penny, so they keep four decimals; a session's two-decimal rule is for sessions.
    out.cost = Math.round(raw.cost * 10_000) / 10_000;
    out.currency = raw.currency === "USD" ? "USD" : "GBP";
  }
  return out;
}

const hasAny = (figures: object): boolean => Object.keys(figures).length > 0;

/** `payload.build_cost`, read defensively; null when it holds no figure. */
export function buildCostOf(raw: unknown): CostFigures | null {
  if (!isRecord(raw)) return null;
  const figures = figuresOf(raw);
  return hasAny(figures) ? { ...figures, source: raw.source === "run" ? "run" : "maker" } : null;
}

/** `payload.run_cost`, read defensively; null when it holds no figure or no known `per`. */
export function runCostOf(raw: unknown): RunCost | null {
  if (!isRecord(raw) || !RUN_PERS.includes(raw.per as RunPer)) return null;
  const figures = figuresOf(raw);
  const noun = raw.per === "item" && typeof (raw.item_noun ?? raw.itemNoun) === "string" ? String(raw.item_noun ?? raw.itemNoun).trim().slice(0, ITEM_NOUN_MAX) : "";
  return hasAny(figures)
    ? { ...figures, per: raw.per as RunPer, source: raw.source === "run" ? "run" : "maker", ...(noun ? { itemNoun: noun } : null), ...(PRICINGS.includes(raw.pricing as Pricing) ? { pricing: raw.pricing as Pricing } : null) }
    : null;
}

/** Why a figure cannot be saved, or null. Fixed words only. */
export function costRefusal(figures: Partial<CostFigures>): string | null {
  if (figures.ms !== undefined && (!Number.isInteger(figures.ms) || figures.ms < 0 || figures.ms > COST_LIMITS.ms)) return "Time is a whole number of milliseconds.";
  for (const key of ["tokensIn", "tokensOut", "cached"] as const) {
    const value = figures[key];
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > COST_LIMITS.tokens)) return "Tokens are whole numbers.";
  }
  if (figures.cost !== undefined && (!Number.isFinite(figures.cost) || figures.cost < 0 || figures.cost > COST_LIMITS.cost)) return `Cost: 0 to ${COST_LIMITS.cost.toLocaleString("en-GB")}`;
  return null;
}

// --- words --------------------------------------------------------------------

/** "120 ms", "1.2 s", "42 s", "12 min", "4 h 12 min". */
export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds < 10 ? Math.round(seconds * 10) / 10 : Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function tokensWords(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M tokens`;
  return `${n.toLocaleString("en-GB")} ${n === 1 ? "token" : "tokens"}`;
}

/** "£8.40", and for a fraction of a penny as many decimals as it needs, to four: "£0.0001". */
export function money(cost: number, currency: Currency = "GBP"): string {
  const sign = currency === "USD" ? "$" : "£";
  if (cost >= 0.01 || cost === 0) return `${sign}${cost.toFixed(2)}`;
  return `${sign}${cost.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".00")}`;
}

const tokensOf = (figures: Pick<CostFigures, "tokensIn" | "tokensOut">): number | undefined =>
  figures.tokensIn === undefined && figures.tokensOut === undefined ? undefined : (figures.tokensIn ?? 0) + (figures.tokensOut ?? 0);

const parts = (figures: CostFigures, showMoney: boolean): string[] =>
  [
    figures.ms !== undefined ? duration(figures.ms) : null,
    tokensOf(figures) !== undefined ? tokensWords(tokensOf(figures) as number) : null,
    showMoney && figures.cost !== undefined ? money(figures.cost, figures.currency) : null,
  ].filter((part): part is string => part !== null);

/** A tile's quiet line for what it took to make: "Made in 1.2 s · 3,400 tokens · £0.01"; null when there is nothing to say. */
export function buildLine(figures: CostFigures | null | undefined, showMoney = true): string | null {
  if (!figures) return null;
  const said = parts(figures, showMoney);
  return said.length ? `Made in ${said.join(" · ")}` : null;
}

const PER_LEAD: Record<RunPer, string> = { call: "Each call", run: "Each run", hour: "Per hour", day: "Per day", item: "Each item" };

/** "(batch pricing)" after the figure, only for batch. */
const pricingNote = (figures: Pick<RunCost, "pricing">): string => (figures.pricing === "batch" ? " (batch pricing)" : "");

/**
 * A runtime tile's quiet line: "Each call: 120 ms · £0.0001", "Per hour: £7.00"; SV-29: a cost per item reads "about $0.0005 per
 * product (batch pricing)". Null when there is nothing to say.
 */
export function runLine(figures: RunCost | null | undefined, showMoney = true): string | null {
  if (!figures) return null;
  if (figures.per === "item") {
    const noun = figures.itemNoun ?? "item";
    const priced = showMoney && figures.cost !== undefined ? `about ${money(figures.cost, figures.currency)} per ${noun}${pricingNote(figures)}` : null;
    const other = parts({ ...figures, cost: undefined }, false);
    return priced || other.length ? [priced, ...other].filter(Boolean).join(" · ") : null;
  }
  const said = parts(figures, showMoney);
  return said.length ? `${PER_LEAD[figures.per]}: ${said.join(" · ")}${pricingNote(figures)}` : null;
}

/**
 * SV-29 P5: "About $5,000 a day at 10,000,000 items · worked out from the cost per item": derived from a cost per item and the daily
 * volume, only when money shows. Never added to another unit (rule 3). Null otherwise.
 */
export function dailyLine(figures: RunCost | null | undefined, volume: Volume | null | undefined, showMoney = true): string | null {
  if (!showMoney || !figures || figures.per !== "item" || figures.cost === undefined || !volume) return null;
  const day = figures.cost * volume.count;
  const sign = figures.currency === "USD" ? "$" : "£";
  const said = day >= 100 ? `${sign}${Math.round(day).toLocaleString("en-GB")}` : money(day, figures.currency);
  return `About ${said} a day at ${volume.count.toLocaleString("en-GB")} items · worked out from the cost per item`;
}

/** "The original took 1.2 s to make" and "Each call cost the original £0.0001": the run view's quiet lines, never copied. */
export function originalBuildLine(figures: CostFigures | null | undefined, showMoney: boolean): string | null {
  const said = figures ? parts(figures, showMoney) : [];
  return said.length ? `The original took ${said.join(" · ")} to make` : null;
}

export function originalRunLine(figures: RunCost | null | undefined, showMoney: boolean): string | null {
  if (!figures) return null;
  const said = parts(figures, showMoney);
  if (!said.length) return null;
  const lead = figures.per === "call" ? "Each call" : figures.per === "run" ? "Each run" : figures.per === "hour" ? "Each hour" : figures.per === "item" ? `Each ${figures.itemNoun ?? "item"}` : "Each day";
  return `${lead} took the original ${said.join(" · ")}`;
}

// --- totals -------------------------------------------------------------------

export interface BuildTotals {
  ms: number;
  tokens: number;
  /** One entry for each currency, never converted. */
  money: { currency: Currency; cost: number }[];
  /** How many of the `of` parts carried a figure. */
  counted: number;
  of: number;
}

/** What one part (a session or a tile) gave towards the build total. */
export interface BuildPart {
  ms?: number;
  tokens?: number;
  cost?: number;
  currency?: Currency;
}

/** A session's extras as a part. */
export const partOfSession = (extras: SessionExtras | undefined): BuildPart => ({ ...(extras?.ms !== undefined ? { ms: extras.ms } : null), ...(extras?.tokens !== undefined ? { tokens: extras.tokens } : null), ...(extras?.cost !== undefined ? { cost: extras.cost, currency: extras.currency ?? "GBP" } : null) });

/** A tile's `build_cost` as a part. */
export const partOfBuildCost = (figures: CostFigures | null | undefined): BuildPart => (figures ? { ...(figures.ms !== undefined ? { ms: figures.ms } : null), ...(tokensOf(figures) !== undefined ? { tokens: tokensOf(figures) } : null), ...(figures.cost !== undefined ? { cost: figures.cost, currency: figures.currency ?? "GBP" } : null) } : {});

/** To build: the sum of every part that has a figure, and how many parts there were. Pure; it never reads a run cost. */
export function buildTotals(parts: readonly BuildPart[]): BuildTotals | null {
  const counted = parts.filter((part) => part.ms !== undefined || part.tokens !== undefined || part.cost !== undefined);
  if (counted.length === 0) return null;
  const money = new Map<Currency, number>();
  for (const part of counted) if (part.cost !== undefined) money.set(part.currency ?? "GBP", (money.get(part.currency ?? "GBP") ?? 0) + part.cost);
  return {
    ms: counted.reduce((sum, part) => sum + (part.ms ?? 0), 0),
    tokens: counted.reduce((sum, part) => sum + (part.tokens ?? 0), 0),
    money: [...money].map(([currency, cost]) => ({ currency, cost: Math.round(cost * 100) / 100 })),
    counted: counted.length,
    of: parts.length,
  };
}

const fromLine = (counted: number, of: number): string => (counted < of ? ` · from ${counted} of ${of} steps` : "");

/** "To build: 4 h 12 min · 1.2M tokens · £8.40 · from 9 of 12 steps". Money only when `showMoney`. */
export function buildTotalsLine(totals: BuildTotals | null, showMoney = true): string | null {
  if (!totals) return null;
  const said = [totals.ms > 0 ? duration(totals.ms) : null, totals.tokens > 0 ? tokensWords(totals.tokens) : null, showMoney && totals.money.length ? totals.money.map((m) => money(m.cost, m.currency)).join(" and ") : null].filter((part): part is string => part !== null);
  return said.length ? `To build: ${said.join(" · ")}${fromLine(totals.counted, totals.of)}` : null;
}

export interface RunTile {
  id: string;
  /** The tile's name, for a list. */
  name: string;
  run: RunCost | null;
  /** On the main path: it has no "Runs when". */
  mainPath: boolean;
}

export type RunTotals =
  | { kind: "sum"; per: "call"; ms: number; tokens: number; money: { currency: Currency; cost: number }[]; counted: number; of: number }
  | { kind: "list"; rows: { id: string; name: string; run: RunCost }[] };

/**
 * To run. The tiles' figures are summed only when every runtime tile on the main path that has one is per call; then it is "about
 * £0.003 a call". Otherwise each tile's own figure is listed and nothing is added across different units. Branch tiles (with a
 * "Runs when") are not on every call, so they are listed in neither a sum nor the count.
 */
export function runTotals(tiles: readonly RunTile[]): RunTotals | null {
  const withFigures = tiles.filter((tile) => tile.run);
  if (withFigures.length === 0) return null;
  const main = tiles.filter((tile) => tile.mainPath);
  const mainWith = main.filter((tile) => tile.run);
  if (mainWith.length > 0 && mainWith.every((tile) => tile.run?.per === "call")) {
    const money = new Map<Currency, number>();
    for (const tile of mainWith) if (tile.run?.cost !== undefined) money.set(tile.run.currency ?? "GBP", (money.get(tile.run.currency ?? "GBP") ?? 0) + tile.run.cost);
    return {
      kind: "sum",
      per: "call",
      ms: mainWith.reduce((sum, tile) => sum + (tile.run?.ms ?? 0), 0),
      tokens: mainWith.reduce((sum, tile) => sum + (tokensOf(tile.run as RunCost) ?? 0), 0),
      money: [...money].map(([currency, cost]) => ({ currency, cost: Math.round(cost * 10_000) / 10_000 })),
      counted: mainWith.length,
      of: main.length,
    };
  }
  return { kind: "list", rows: withFigures.map((tile) => ({ id: tile.id, name: tile.name, run: tile.run as RunCost })) };
}

/** "To run: about £0.003 a call · 0.4 s · from 2 of 3 steps", or the lines of a list. */
export function runTotalsLines(totals: RunTotals | null, showMoney = true): string[] {
  if (!totals) return [];
  if (totals.kind === "list") return totals.rows.flatMap((row) => {
    const line = runLine(row.run, showMoney);
    return line ? [`${row.name} · ${line}`] : [];
  });
  const said = [
    showMoney && totals.money.length ? `about ${totals.money.map((m) => money(m.cost, m.currency)).join(" and ")} a call` : null,
    totals.ms > 0 ? duration(totals.ms) : null,
    totals.tokens > 0 ? tokensWords(totals.tokens) : null,
  ].filter((part): part is string => part !== null);
  return said.length ? [`To run: ${said.join(" · ")}${fromLine(totals.counted, totals.of)}`] : [];
}
