// CA-13 Part 9: comparing two builds of the same thing, pure. Steps are matched by kind and order and the ones with no match are
// shown as gaps. Totals keep "to build" and "to run" in separate rows (rule 3); the differences read in plain words.

import { setupDifference } from "./deploymentCost";
import { buildPartsOf, runTilesOf, showsCost } from "./costView";
import { buildTotals, duration, money, runTotals, tokensWords, type BuildTotals, type RunTotals } from "./cost";
import type { SessionGroup, Step } from "./graph";
import { buildPatterns, PATTERN_LABEL, type Pattern } from "./patterns";

export interface CompareSide {
  title: string;
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  /** The models its sessions and agents used, by name. */
  models: readonly string[];
  /** SV-27 P9: its setup figures (the maker's) and its API estimate, each kept apart from To build and To run. */
  setup?: number | null;
  estimate?: string | null;
  currency?: "GBP" | "USD";
}

export interface CompareRow {
  a: Step | null;
  b: Step | null;
}

/** Pair steps by kind and order: the longest run of equal kinds, in order, is matched; everything else is a gap on its own side. */
export function matchSteps(a: readonly Step[], b: readonly Step[]): CompareRow[] {
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) table[i][j] = a[i].kind === b[j].kind ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const rows: CompareRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].kind === b[j].kind) rows.push({ a: a[i++], b: b[j++] });
    else if (table[i + 1][j] >= table[i][j + 1]) rows.push({ a: a[i++], b: null });
    else rows.push({ a: null, b: b[j++] });
  }
  while (i < n) rows.push({ a: a[i++], b: null });
  while (j < m) rows.push({ a: null, b: b[j++] });
  return rows;
}

export interface SideTotals {
  build: BuildTotals | null;
  run: RunTotals | null;
  steps: number;
  models: string[];
  patterns: Pattern[];
  money: boolean;
  setup: number | null;
  estimate: string | null;
  currency: "GBP" | "USD";
}

export function totalsOf(side: CompareSide): SideTotals {
  return {
    build: buildTotals(buildPartsOf(side.steps, side.groups)),
    run: runTotals(runTilesOf(side.steps)),
    steps: side.steps.length,
    models: [...new Set(side.models)],
    patterns: buildPatterns(side.steps, side.groups),
    money: showsCost(side.groups),
    setup: side.setup ?? null,
    estimate: side.estimate ?? null,
    currency: side.currency ?? "GBP",
  };
}

/** The rows of the totals table: each row is one thing, "to build" and "to run" apart. */
export interface TotalsRow {
  label: string;
  a: string;
  b: string;
}

const dash = "–";

export function totalsRows(a: SideTotals, b: SideTotals): TotalsRow[] {
  const buildCell = (t: SideTotals, pick: (b: BuildTotals) => string | null): string => (t.build ? (pick(t.build) ?? dash) : dash);
  const runCell = (t: SideTotals): string => {
    if (!t.run) return dash;
    if (t.run.kind === "list") return `${t.run.rows.length} figures, each its own unit`;
    const said = [t.money && t.run.money.length ? t.run.money.map((m) => money(m.cost, m.currency)).join(" and ") + " a call" : null, t.run.ms > 0 ? duration(t.run.ms) : null, t.run.tokens > 0 ? tokensWords(t.run.tokens) : null].filter(Boolean);
    return said.length ? said.join(" · ") : dash;
  };
  return [
    { label: "To build · time", a: buildCell(a, (t) => (t.ms > 0 ? duration(t.ms) : null)), b: buildCell(b, (t) => (t.ms > 0 ? duration(t.ms) : null)) },
    { label: "To build · tokens", a: buildCell(a, (t) => (t.tokens > 0 ? tokensWords(t.tokens) : null)), b: buildCell(b, (t) => (t.tokens > 0 ? tokensWords(t.tokens) : null)) },
    { label: "To build · cost", a: a.money ? buildCell(a, (t) => (t.money.length ? t.money.map((m) => money(m.cost, m.currency)).join(" and ") : null)) : dash, b: b.money ? buildCell(b, (t) => (t.money.length ? t.money.map((m) => money(m.cost, m.currency)).join(" and ") : null)) : dash },
    { label: "To run", a: runCell(a), b: runCell(b) },
    // SV-27 P9: each in its own row, never added to To build or To run.
    { label: "To set up", a: a.money && a.setup !== null ? money(a.setup, a.currency) : dash, b: b.money && b.setup !== null ? money(b.setup, b.currency) : dash },
    { label: "API estimate", a: a.money && a.estimate ? a.estimate : dash, b: b.money && b.estimate ? b.estimate : dash },
    { label: "Steps", a: String(a.steps), b: String(b.steps) },
    { label: "Models used", a: a.models.join(", ") || dash, b: b.models.join(", ") || dash },
  ];
}

const share = (a: number, b: number): number => Math.round((Math.abs(a - b) / Math.max(a, b)) * 100);

/**
 * What is different, in plain words, as clauses of "This one …": "used a router", "used 40% fewer tokens". Only what both builds
 * gave figures for is compared; a figure one of them lacks is not a difference.
 */
export function differences(a: SideTotals, b: SideTotals): string[] {
  const out: string[] = [];
  for (const pattern of ["router", "long-running", "structured-output"] as const) {
    const mine = a.patterns.includes(pattern);
    const theirs = b.patterns.includes(pattern);
    if (mine && !theirs) out.push(pattern === "router" ? "used a router" : pattern === "long-running" ? "used a long-running agent" : "used structured output");
    else if (!mine && theirs) out.push(pattern === "router" ? "did not use a router" : pattern === "long-running" ? "did not use a long-running agent" : "did not use structured output");
  }
  if (a.build && b.build) {
    if (a.build.tokens > 0 && b.build.tokens > 0 && a.build.tokens !== b.build.tokens && share(a.build.tokens, b.build.tokens) >= 5) out.push(`used ${share(a.build.tokens, b.build.tokens)}% ${a.build.tokens < b.build.tokens ? "fewer" : "more"} tokens`);
    if (a.build.ms > 0 && b.build.ms > 0 && a.build.ms !== b.build.ms && share(a.build.ms, b.build.ms) >= 5) out.push(`took ${share(a.build.ms, b.build.ms)}% ${a.build.ms < b.build.ms ? "less" : "more"} time`);
  }
  if (a.money && b.money) {
    const setup = setupDifference(a.setup, b.setup, a.currency);
    if (setup) out.push(setup);
  }
  if (a.steps !== b.steps) out.push(`has ${Math.abs(a.steps - b.steps)} ${a.steps < b.steps ? "fewer" : "more"} ${Math.abs(a.steps - b.steps) === 1 ? "step" : "steps"}`);
  return out;
}

/** "This one used a router and 40% fewer tokens.", or a line saying they look alike. */
export function differenceSentence(a: SideTotals, b: SideTotals): string {
  const clauses = differences(a, b);
  if (clauses.length === 0) return "These two look alike on every figure given.";
  const joined = clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
  return `This one ${joined}.`;
}

/** Whether two builds can be compared: they share a root in the rebuild tree. */
export const shareRoot = (a: { id: string; root_build_id: string | null }, b: { id: string; root_build_id: string | null }): boolean => (a.root_build_id ?? a.id) === (b.root_build_id ?? b.id) && a.id !== b.id;

export { PATTERN_LABEL };
