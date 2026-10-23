// CA-17 P1: a build's parts. PURE.
//
// A part is a group of sessions, the way a session is a group of tiles. On screen it is a "Part"; in code it is a
// workstream, because "part" already means a tile or a session here (`postRefs.ts`, `partColour.ts`, `usePartRef`).
//
// Everything lives in `builds.making` (`workstreams`, `part_labels`, and `sessions_meta[key].workstream`). A build with no
// stored parts has one implicit part, which holds every session and is never drawn. The build keeps its ONE session order
// (`sessionLayout.getSessionOrder`), and it is always the parts in their order, each part's sessions in theirs, so session
// and tile numbers keep counting straight down the List. Every change here returns the new order with the change.

import {
  WORKSTREAM_MAX,
  newWorkstreamKey,
  partLabelsOf,
  sessionsMetaOf,
  storedWorkstreamsOf,
  type PartLabels,
  type SessionMeta,
  type Workstream,
} from "./making";

/** The key of the one part of a build that stores none. Never written. */
export const IMPLICIT_WORKSTREAM = "ws-implicit";

/** A part with its sessions, in order. */
export interface WorkstreamGroup extends Workstream {
  /** Where it stands among the parts, from 0. */
  index: number;
  /** The one part of a build that stores none: it has no label and nothing is drawn for it. */
  implicit: boolean;
  /** The keys of its sessions, in the one order. */
  sessions: string[];
}

type MetaMap = Readonly<Record<string, Pick<SessionMeta, "workstream" | "withAbove"> | undefined>>;

/** The part a session is in: its own `workstream` when the build has that part, else the first. */
export function workstreamKeyOf(meta: MetaMap[string], stored: readonly Pick<Workstream, "key">[]): string {
  const own = meta?.workstream;
  return own && stored.some((part) => part.key === own) ? own : (stored[0]?.key ?? IMPLICIT_WORKSTREAM);
}

/** The parts in order, each with its sessions. One implicit part when none are stored. `order` is the one session order. */
export function workstreamsOf(making: unknown, order: readonly string[]): WorkstreamGroup[] {
  const stored = storedWorkstreamsOf(making);
  if (stored.length === 0) return [{ key: IMPLICIT_WORKSTREAM, index: 0, implicit: true, sessions: [...order] }];
  const meta = sessionsMetaOf(making);
  return stored.map((part, index) => ({
    ...part,
    index,
    implicit: false,
    sessions: order.filter((key) => workstreamKeyOf(meta[key], stored) === part.key),
  }));
}

/** Whether the build draws parts: two or more. With one (or none), every screen is as it was. */
export const hasParts = (parts: readonly unknown[]): boolean => parts.length >= 2;

/** "Part B" or "Part 2". */
export function workstreamLabel(index: number, labels: PartLabels): string {
  return `Part ${labels === "letters" && index < WORKSTREAM_MAX ? String.fromCharCode(65 + index) : index + 1}`;
}

/** The letter or number alone: "B" or "2". */
export const workstreamMark = (index: number, labels: PartLabels): string => workstreamLabel(index, labels).slice(5);

/** "Part B · Support agent", or "Part B" when it has no name. */
export function workstreamTitle(part: Pick<Workstream, "name">, index: number, labels: PartLabels): string {
  return part.name ? `${workstreamLabel(index, labels)} · ${part.name}` : workstreamLabel(index, labels);
}

/** The labelling a build uses, read from its `making`. */
export const labelsOf = partLabelsOf;

/** `keys` grouped by part: the parts in their order, each part's sessions in the order they had. Unchanged with no stored parts. */
export function orderByWorkstream(keys: readonly string[], meta: MetaMap, workstreams: readonly Pick<Workstream, "key">[]): string[] {
  if (workstreams.length === 0) return [...keys];
  return workstreams.flatMap((part) => keys.filter((key) => workstreamKeyOf(meta[key], workstreams) === part.key));
}

/** What a change to the parts asks to be written. Pure; the caller writes it (see `workstreamPatch`). */
export interface WorkstreamChange {
  /** The parts as they stand afterwards. */
  workstreams: Workstream[];
  /** Sessions whose entry changes: their part, and whether they share the stage above. `undefined` takes a key off. */
  sessions: Record<string, { workstream?: string; withAbove?: boolean | undefined }>;
  /** The one session order afterwards. */
  order: string[];
}

/** The sessions each part holds, by part key, as the change leaves them. */
function holdings(change: Pick<WorkstreamChange, "workstreams" | "sessions" | "order">, making: unknown): Map<string, string[]> {
  const meta = sessionsMetaOf(making);
  const out = new Map(change.workstreams.map((part) => [part.key, [] as string[]]));
  for (const key of change.order) {
    const own = key in change.sessions && "workstream" in change.sessions[key] ? change.sessions[key].workstream : meta[key]?.workstream;
    out.get(workstreamKeyOf({ workstream: own }, change.workstreams))?.push(key);
  }
  return out;
}

/** A part may only begin after a session of another part, and never one that begins after it. Entries that break this lose `startsAfter`. */
export function sanitisedStarts(workstreams: readonly Workstream[], partOf: (session: string) => string | undefined): Workstream[] {
  const out = workstreams.map((part) => ({ ...part }));
  const dependsOn = (from: string, wanted: string, seen = new Set<string>()): boolean => {
    if (seen.has(from)) return false;
    seen.add(from);
    const part = out.find((entry) => entry.key === from);
    const after = part?.startsAfter ? partOf(part.startsAfter) : undefined;
    if (!after) return false;
    return after === wanted || dependsOn(after, wanted, seen);
  };
  for (const part of out) {
    if (!part.startsAfter) continue;
    const after = partOf(part.startsAfter);
    if (!after || after === part.key || dependsOn(after, part.key)) delete part.startsAfter;
  }
  return out;
}

/** Which part each session is in, once `change` is applied. */
function partOfAfter(change: WorkstreamChange, making: unknown): (session: string) => string | undefined {
  const held = holdings(change, making);
  const map = new Map<string, string>();
  for (const [part, sessions] of held) for (const key of sessions) map.set(key, part);
  return (session) => map.get(session);
}

/**
 * A change, finished: its order grouped by part and its `startsAfter` entries kept honest. A session with no part of its own
 * belongs to the FIRST part, so when the first part changes (a part moved to the top, the first one removed) those sessions
 * are given the part they were in, or they would move with the change.
 */
function finished(making: unknown, change: WorkstreamChange): WorkstreamChange {
  const original = storedWorkstreamsOf(making);
  const meta = sessionsMetaOf(making);
  const sessions = { ...change.sessions };
  if (original[0] && change.workstreams[0]?.key !== original[0].key) {
    for (const key of change.order) {
      if (sessions[key] && "workstream" in sessions[key]) continue;
      if (workstreamKeyOf(meta[key], original) === original[0].key && !original.slice(1).some((part) => part.key === meta[key]?.workstream) && change.workstreams.some((part) => part.key === original[0].key))
        sessions[key] = { ...sessions[key], workstream: original[0].key };
    }
  }
  const settled = { ...change, sessions };
  const held = holdings(settled, making);
  const order = settled.workstreams.flatMap((part) => held.get(part.key) ?? []);
  const next = { ...settled, order: [...order, ...settled.order.filter((key) => !order.includes(key))] };
  return { ...next, workstreams: sanitisedStarts(next.workstreams, partOfAfter(next, making)) };
}

/**
 * "Add a part". With no stored parts it writes two entries: the first for the sessions already there (they have no
 * `workstream`, so nothing is written on them), the second empty. Null when the build already has 26.
 */
export function addWorkstream(making: unknown, order: readonly string[]): (WorkstreamChange & { key: string }) | null {
  const stored = storedWorkstreamsOf(making);
  if (stored.length >= WORKSTREAM_MAX) return null;
  const key = newWorkstreamKey();
  const workstreams = stored.length === 0 ? [{ key: newWorkstreamKey() }, { key }] : [...stored, { key }];
  return { key, workstreams, sessions: {}, order: [...order] };
}

/**
 * Move a session into another part: to the end of it, or before `before`. It stops sharing a stage with a session above,
 * since it has a new one. Returns the change and the new order; the same order when the session is already there.
 */
export function moveSessionToWorkstream(making: unknown, order: readonly string[], session: string, to: string, before?: string): WorkstreamChange | null {
  const stored = storedWorkstreamsOf(making);
  if (!stored.some((part) => part.key === to) || !order.includes(session)) return null;
  const meta = sessionsMetaOf(making);
  const here = workstreamKeyOf(meta[session], stored);
  const draft: WorkstreamChange = { workstreams: stored, sessions: { [session]: { workstream: to, withAbove: undefined } }, order: [...order] };
  const held = holdings({ ...draft, order: order.filter((key) => key !== session) }, making);
  // Where in the order it goes: after the last session of the part it joins, else right after the part above it that has any.
  const rest = order.filter((key) => key !== session);
  let at: number;
  const target = held.get(to) ?? [];
  if (before && target.includes(before)) at = rest.indexOf(before);
  else if (target.length > 0) at = rest.indexOf(target[target.length - 1]) + 1;
  else {
    const index = stored.findIndex((part) => part.key === to);
    const above = stored
      .slice(0, index)
      .reverse()
      .flatMap((part) => held.get(part.key) ?? []);
    at = above.length > 0 ? rest.indexOf(above[0]) + 1 : 0;
  }
  rest.splice(at, 0, session);
  const moved = finished(making, { ...draft, order: rest });
  if (here === to && moved.order.join() === order.join()) return null;
  return moved;
}

/**
 * Take a part away. Its sessions join the part above, or the one below when it is the first; since parts sit side by side
 * in the one order, the order does not change. Null when it is the only part.
 */
export function removeWorkstream(making: unknown, order: readonly string[], key: string): (WorkstreamChange & { joins: string }) | null {
  const stored = storedWorkstreamsOf(making);
  const at = stored.findIndex((part) => part.key === key);
  if (at < 0 || stored.length < 2) return null;
  const joins = (stored[at - 1] ?? stored[at + 1]).key;
  const meta = sessionsMetaOf(making);
  const sessions: WorkstreamChange["sessions"] = {};
  for (const session of order) if (workstreamKeyOf(meta[session], stored) === key) sessions[session] = { workstream: joins };
  const workstreams = stored.filter((part) => part.key !== key);
  const change = finished(making, { workstreams, sessions, order: [...order] });
  // Sessions that sat first in a part had no "above"; now they have one, so they do not claim its stage.
  const firstOfRemoved = order.find((session) => session in sessions);
  const firstBelow = at === 0 ? order.find((session) => workstreamKeyOf(meta[session], stored) === joins && !(session in sessions)) : undefined;
  for (const session of [firstOfRemoved, firstBelow]) if (session && meta[session]?.withAbove) change.sessions[session] = { ...change.sessions[session], withAbove: undefined };
  return { ...change, joins };
}

/**
 * A session just made goes to the end of part `to`, in the one order. `order` is the order before it; the session is not in
 * it yet (or is, and is moved). With no stored parts the order is the old one with the session last.
 */
export function orderWithNewSession(making: unknown, order: readonly string[], session: string, to: string | undefined): string[] {
  const rest = order.filter((key) => key !== session);
  const stored = storedWorkstreamsOf(making);
  if (!to || !stored.some((part) => part.key === to)) return [...rest, session];
  const meta = { ...sessionsMetaOf(making), [session]: { tool: null, date: "", workstream: to } };
  return orderByWorkstream([...rest, session], meta, stored);
}

/** The part a session joins when its maker does not say: the last, once the build has two or more parts. */
export function defaultWorkstream(making: unknown, chosen?: string): string | undefined {
  const stored = storedWorkstreamsOf(making);
  if (chosen && stored.some((part) => part.key === chosen)) return chosen;
  return stored.length >= 2 ? stored[stored.length - 1].key : undefined;
}

/** Move a part up or down one place. The sessions go with it. Null when it cannot move. */
export function moveWorkstream(making: unknown, order: readonly string[], key: string, by: -1 | 1): WorkstreamChange | null {
  const stored = storedWorkstreamsOf(making);
  const at = stored.findIndex((part) => part.key === key);
  const to = at + by;
  if (at < 0 || to < 0 || to >= stored.length) return null;
  const workstreams = [...stored];
  [workstreams[at], workstreams[to]] = [workstreams[to], workstreams[at]];
  return finished(making, { workstreams, sessions: {}, order: [...order] });
}

/**
 * Drop part `key` into the place of part `over` (a drag by its handle). The sessions go with it.
 */
export function droppedWorkstream(making: unknown, order: readonly string[], key: string, over: string): WorkstreamChange | null {
  const stored = storedWorkstreamsOf(making);
  const from = stored.findIndex((part) => part.key === key);
  const to = stored.findIndex((part) => part.key === over);
  if (from < 0 || to < 0 || from === to) return null;
  const workstreams = stored.filter((part) => part.key !== key);
  workstreams.splice(to, 0, stored[from]);
  return finished(making, { workstreams, sessions: {}, order: [...order] });
}

/**
 * The sessions part `key` may start after: those of other parts. Never its own sessions, and never one in a part that
 * starts after this one, directly or through others.
 */
export function startsAfterChoices(key: string, all: readonly WorkstreamGroup[]): string[] {
  const partOf = new Map<string, string>();
  for (const part of all) for (const session of part.sessions) partOf.set(session, part.key);
  const dependsOn = (from: string, wanted: string, seen = new Set<string>()): boolean => {
    if (from === wanted) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    const after = all.find((part) => part.key === from)?.startsAfter;
    const there = after ? partOf.get(after) : undefined;
    return there ? dependsOn(there, wanted, seen) : false;
  };
  return all.filter((part) => part.key !== key && !dependsOn(part.key, key)).flatMap((part) => part.sessions);
}

/** Set one part's own fields (name, colour, start, fold) and keep the rest. `undefined` takes a field off. */
export function withWorkstream(stored: readonly Workstream[], key: string, next: Partial<Omit<Workstream, "key">>): Workstream[] {
  return stored.map((part) => {
    if (part.key !== key) return part;
    const out: Record<string, unknown> = { ...part, ...next };
    for (const field of Object.keys(next) as (keyof typeof next)[]) if (next[field] === undefined || next[field] === false) delete out[field];
    return out as unknown as Workstream;
  });
}

/**
 * What to write into `making` for a change: the parts, the sessions' entries merged into the stored ones (an entry that
 * does not exist yet is made `{ tool: null, date: "" }`, as an added session's is), and the order. Old keys are kept as they
 * are; nothing is rewritten.
 */
export function workstreamPatch(making: unknown, change: WorkstreamChange): Record<string, unknown> {
  const raw = ((making as { sessions_meta?: unknown } | null)?.sessions_meta ?? {}) as Record<string, Record<string, unknown>>;
  const sessions_meta: Record<string, unknown> = { ...raw };
  for (const [key, edit] of Object.entries(change.sessions)) {
    const entry: Record<string, unknown> = { ...(raw[key] ?? { tool: null, date: "" }) };
    if ("workstream" in edit) {
      if (edit.workstream === undefined) delete entry.workstream;
      else entry.workstream = edit.workstream;
    }
    if ("withAbove" in edit) {
      if (edit.withAbove) entry.withAbove = true;
      else delete entry.withAbove;
    }
    sessions_meta[key] = entry;
  }
  return {
    workstreams: change.workstreams.map((part) => ({ ...part })),
    ...(Object.keys(change.sessions).length > 0 ? { sessions_meta } : null),
    session_order: [...change.order],
  };
}

/** The part (group) a session is in. */
export function workstreamOfSession(parts: readonly WorkstreamGroup[], session: string): WorkstreamGroup | undefined {
  return parts.find((part) => part.sessions.includes(session));
}
