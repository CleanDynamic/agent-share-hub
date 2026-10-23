// CA-17 P1: the stages of a build's sessions. PURE.
//
// A stage is a column (horizontal) or a row (vertical) of the map. Inside a part a session is either in the same stage as
// the session above it or in a later one, never an earlier one; parts do not have to line up with each other; a part can say
// where it starts; and a session that uses something from another part is always placed after it.
//
// Rules, applied until nothing changes:
//   1. A part's first session is in stage 1, or one after its `startsAfter` session's stage.
//   2. Every next session in the part is in the stage of the one above when it is `withAbove`, else one after it.
//   3. `uses` lists pairs (a session, a session it uses something from). A use across parts puts the first one in a later
//      stage than the second. The sessions after it in its part move along, by rule 2.
//   4. A use that would make a loop is left out of the count (it is still drawn as a line). `loops` says how many.

import type { SessionMeta } from "./making";
import type { WorkstreamGroup } from "./workstreams";

export interface StageUse {
  /** The session that uses something. */
  session: string;
  /** The session it uses something from. */
  from: string;
}

export interface StageInfo {
  /** From 1. */
  number: number;
  /** The sessions in it, in the order of the build. */
  sessions: string[];
  /** The earliest day of its sessions, "2026-10-09"; absent when none has one. */
  date?: string;
  /** The first and the last day, when its sessions are on different days. */
  until?: string;
}

export interface StagesResult {
  /** Every session's stage. */
  stageOf: Record<string, number>;
  stages: StageInfo[];
  /** How many uses were left out of the count because they would make a loop. */
  loops: number;
}

export interface StagesInput {
  workstreams: readonly Pick<WorkstreamGroup, "key" | "sessions" | "startsAfter">[];
  /** The one session order. */
  order: readonly string[];
  meta: Readonly<Record<string, Pick<SessionMeta, "withAbove" | "date"> & { parallelWith?: readonly string[] } | undefined>>;
  uses: readonly StageUse[];
  /** A session's day when its entry has none (an imported session's own). */
  days?: Readonly<Record<string, string | undefined>>;
}

interface Edge {
  from: number;
  to: number;
  /** `to` is at least `from` + weight. */
  weight: 0 | 1;
}

/** Longest paths from stage 1, or null when the edges loop with a positive weight. */
function solve(count: number, edges: readonly Edge[]): number[] | null {
  const stage = new Array<number>(count).fill(1);
  for (let round = 0; round <= count; round += 1) {
    let changed = false;
    for (const edge of edges) {
      if (stage[edge.to] < stage[edge.from] + edge.weight) {
        stage[edge.to] = stage[edge.from] + edge.weight;
        changed = true;
      }
    }
    if (!changed) return stage;
  }
  return null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `parallelWith` (CA-05) counts as "same stage as the session above" only when its partner is the session directly above in
 * the same part. Otherwise it is kept and shown where it is shown today, and ignored here. Never rewritten.
 */
export function withAboveOf(meta: StagesInput["meta"][string], above: string | undefined): boolean {
  if (!above) return false;
  return meta?.withAbove === true || Boolean(meta?.parallelWith?.includes(above));
}

export function stagesOf({ workstreams, order, meta, uses, days = {} }: StagesInput): StagesResult {
  const keys = [...new Set([...order, ...workstreams.flatMap((part) => part.sessions)])];
  const index = new Map(keys.map((key, at) => [key, at]));
  const base: Edge[] = [];
  let loops = 0;

  for (const part of workstreams) {
    part.sessions.forEach((key, at) => {
      const me = index.get(key);
      if (me === undefined) return;
      const above = part.sessions[at - 1];
      if (above !== undefined) base.push({ from: index.get(above) as number, to: me, weight: withAboveOf(meta[key], above) ? 0 : 1 });
    });
  }
  // A part's start, then each use, one at a time: whatever would make a loop is left out.
  const attempts: Edge[] = [];
  for (const part of workstreams) {
    const first = part.sessions[0];
    const after = part.startsAfter ? index.get(part.startsAfter) : undefined;
    if (first !== undefined && after !== undefined && !part.sessions.includes(part.startsAfter as string)) attempts.push({ from: after, to: index.get(first) as number, weight: 1 });
  }
  const partOf = new Map<string, string>();
  for (const part of workstreams) for (const key of part.sessions) partOf.set(key, part.key);
  const wanted = uses
    .filter((use) => index.has(use.session) && index.has(use.from) && use.session !== use.from && partOf.get(use.session) !== partOf.get(use.from))
    .sort((a, b) => (index.get(a.session) as number) - (index.get(b.session) as number) || (index.get(a.from) as number) - (index.get(b.from) as number));
  for (const use of wanted) attempts.push({ from: index.get(use.from) as number, to: index.get(use.session) as number, weight: 1 });

  const kept = [...base];
  let stage = solve(keys.length, kept) ?? new Array<number>(keys.length).fill(1);
  for (const edge of attempts) {
    const next = solve(keys.length, [...kept, edge]);
    if (next) {
      kept.push(edge);
      stage = next;
    } else loops += 1;
  }

  const stageOf: Record<string, number> = {};
  keys.forEach((key, at) => {
    stageOf[key] = stage[at];
  });
  const count = keys.length === 0 ? 0 : Math.max(...stage);
  const stages: StageInfo[] = [];
  for (let number = 1; number <= count; number += 1) {
    const sessions = keys.filter((key) => stageOf[key] === number);
    const dates = sessions.map((key) => meta[key]?.date || days[key] || "").filter((day) => ISO_DAY.test(day)).sort();
    const info: StageInfo = { number, sessions };
    if (dates.length > 0) {
      info.date = dates[0];
      if (dates[dates.length - 1] !== dates[0]) info.until = dates[dates.length - 1];
    }
    stages.push(info);
  }
  return { stageOf, stages, loops };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const partsOfDay = (day: string): { d: number; m: number } => ({ d: Number(day.slice(8, 10)), m: Number(day.slice(5, 7)) - 1 });

/** "9 Oct". */
export function dayLabel(day: string | undefined): string {
  if (!day || !ISO_DAY.test(day)) return "";
  const { d, m } = partsOfDay(day);
  return `${d} ${MONTHS[m]}`;
}

/** "7 to 8 Oct" for two days in a month, "30 Sep to 2 Oct" across months, "7 Oct" for one, "" for none. */
export function dayRange(first: string | undefined, last?: string): string {
  if (!first || !ISO_DAY.test(first)) return "";
  if (!last || !ISO_DAY.test(last) || last === first) return dayLabel(first);
  const [a, b] = first < last ? [first, last] : [last, first];
  const from = partsOfDay(a);
  const to = partsOfDay(b);
  return from.m === to.m && a.slice(0, 4) === b.slice(0, 4) ? `${from.d} to ${to.d} ${MONTHS[to.m]}` : `${dayLabel(a)} to ${dayLabel(b)}`;
}

/** The days a result's stages cover, as "7 to 12 Oct"; "" when no stage has a day. */
export function stagesRange(stages: readonly StageInfo[]): string {
  const all = stages.flatMap((stage) => [stage.date, stage.until]).filter((day): day is string => Boolean(day)).sort();
  return dayRange(all[0], all[all.length - 1]);
}

/** A stage's own days, as "7 to 8 Oct" when its sessions are on two days, "9 Oct" on one, "" on none. */
export const stageDays = (stage: Pick<StageInfo, "date" | "until">): string => dayRange(stage.date, stage.until);
