// SV-05 P1: the one session numbering. PURE: no React, no Supabase, so the build page, OpenBuilds, the Maps view and
// stored counts can import it without the composer.
//
// A SESSION'S NUMBER IS ITS PLACE IN THE LIST, COUNTED FROM THE TOP. The List draws the parts in their order, and in each
// part its sessions in the build's one order: `build_sessions.position` (else `making.session_order`), the order every
// move writes and stacks the tiles by. A session that order does not hold yet (an old draft's, a run of typed prompts)
// keeps the place its first tile gives it; one with no tiles, where it was made. A session with no tiles counts like any
// other. The numbers have no gaps and no repeats, and nothing else works one out: `sessionGroups` numbers its groups with
// this, every place that shows a session number reads the group's, and the List draws its sessions in this order.
//
// The map is built once per call, so once per change of the order (the page builds its groups once per change).

import type { SessionMeta } from "./making";
import { workstreamKeyOf } from "./workstreams";

export interface NumberedSession {
  key: string;
  /** Where the session's first tile stands among the build's tiles (0 is the first), or null when it has none. */
  firstTile: number | null;
}

export interface SessionParts {
  /** `builds.making.sessions_meta`: each session's own part, if it names one. */
  meta: Readonly<Record<string, Pick<SessionMeta, "workstream"> | undefined>>;
  /** The build's parts, in order (`builds.making.workstreams`). None: one part holds every session. */
  workstreams: readonly { key: string }[];
}

export interface SessionNumbers {
  /** Every session's key, in the List's order. */
  keys: readonly string[];
  /** Session key to its number, from 1. */
  numberOf: ReadonlyMap<string, number>;
  /** Session key to the key of its part. */
  partOf: ReadonlyMap<string, string>;
}

const NO_PARTS: SessionParts = { meta: {}, workstreams: [] };

export function numberSessions(sessions: readonly NumberedSession[], order: readonly string[], parts: SessionParts = NO_PARTS): SessionNumbers {
  // Where each stands by its tiles: a session with tiles where its first tile stands, then those with none, as given.
  const natural = [
    ...sessions.filter((session) => session.firstTile !== null).sort((a, b) => (a.firstTile as number) - (b.firstTile as number)),
    ...sessions.filter((session) => session.firstTile === null),
  ].map((session) => session.key);
  // The sessions the order holds take the places those sessions hold, in the order's sequence; the others keep theirs.
  const rank = new Map(order.map((key, at) => [key, at]));
  const slots = natural.flatMap((key, at) => (rank.has(key) ? [at] : []));
  const ranked = slots.map((at) => natural[at]).sort((a, b) => (rank.get(a) as number) - (rank.get(b) as number));
  const placed = [...natural];
  slots.forEach((at, n) => {
    placed[at] = ranked[n];
  });

  // The parts in their order, each part's sessions in the order above.
  const partOf = new Map(placed.map((key) => [key, workstreamKeyOf(parts.meta[key], parts.workstreams)]));
  const partRank = new Map(parts.workstreams.map((part, at) => [part.key, at]));
  const keys = parts.workstreams.length === 0 ? placed : [...placed].sort((a, b) => (partRank.get(partOf.get(a) as string) ?? 0) - (partRank.get(partOf.get(b) as string) ?? 0));
  return { keys, numberOf: new Map(keys.map((key, at) => [key, at + 1])), partOf };
}

/**
 * SV-05 P2: the number a session added now would take: the next place at the end of its part (the last part when none
 * is named), so it never repeats one. `keys` are the build's sessions in the List's order. The sessions below it, in
 * later parts, move down one.
 */
export function nextSessionNumber(keys: readonly string[], parts: SessionParts, part?: string): number {
  if (parts.workstreams.length === 0) return keys.length + 1;
  const into = parts.workstreams.some((entry) => entry.key === part) ? (part as string) : parts.workstreams[parts.workstreams.length - 1].key;
  const until = parts.workstreams.findIndex((entry) => entry.key === into);
  const before = new Set(parts.workstreams.slice(0, until + 1).map((entry) => entry.key));
  return keys.filter((key) => before.has(workstreamKeyOf(parts.meta[key], parts.workstreams))).length + 1;
}
