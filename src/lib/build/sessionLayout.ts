// CA-14 P1: where a draft keeps the order its sessions are numbered in, and which of them are folded.
//
// Two stores hold the same two facts. `build_sessions` (`position`, `collapsed`) is the one to use when the CA-12 table
// is there; until it is, `making.session_order` and `making.sessions_collapsed` carry them. Nothing outside this module
// needs to know which one answered. When the table is live a write goes to it AND to `making`, so a later fallback (the
// table dropped, a read that fails) never shows an old order.
//
// The other half is the tiles. A session's tiles are drawn one after another and numbered by their position, so putting a
// session earlier has to put its tiles earlier too: `stackBySessionMoves` hands the top-level steps' own positions out
// again, session by session, in the session order. It is pure; the caller writes the moves.

import { insertBuildSession, isMissingTable, listBuildSessionRows, nextSessionPosition, reorderBuildSessions, setSessionCollapsed, orderOf, type BuildSessionRow } from "./buildSessions";
import { groupKey, topSteps, type SessionGroup, type Step } from "./graph";
import { patchMaking, readMaking, sessionOrderOf, sessionsCollapsedOf } from "./making";
import type { NodeMove } from "./nodes";
import type { BuildNode } from "./types";

type RowLike = Pick<BuildSessionRow, "sessionKey" | "position" | "collapsed">;

const causeOf = (error: unknown): unknown => (error as { cause?: unknown } | null)?.cause ?? error;

/** The keys of a draft's sessions in the maker's order: the table's when it has rows, else `making.session_order`. */
export function getSessionOrder(made: unknown, rows: readonly RowLike[]): string[] {
  if (rows.length > 0) return orderOf(rows);
  return sessionOrderOf(made);
}

/** Whether a session is folded: its row's `collapsed` when it has one, else `making.sessions_collapsed`. */
export function isCollapsed(made: unknown, rows: readonly RowLike[], key: string): boolean {
  const row = rows.find((candidate) => candidate.sessionKey === key);
  if (row) return row.collapsed;
  return sessionsCollapsedOf(made).includes(key);
}

/** Every folded session's key, as the list wants them. */
export function collapsedKeys(made: unknown, rows: readonly RowLike[], keys: readonly string[]): Set<string> {
  return new Set(keys.filter((key) => isCollapsed(made, rows, key)));
}

/**
 * Save the sessions' order. Rows the table lacks for these keys are added first (a session made while the table was not
 * there), then the table is reordered, then `making` is written. A table that is not there is not an error.
 */
export async function setSessionOrder(buildId: string, keys: readonly string[]): Promise<void> {
  try {
    const rows = await listBuildSessionRows(buildId);
    // The table answers with nothing both when it is not there and when the draft has no rows. Only a draft that has rows
    // is reordered there; adding rows for an old draft is left to the first session added the CA-12 way.
    if (rows.length > 0) {
      const have = new Set(rows.map((row) => row.sessionKey));
      let next = nextSessionPosition(rows);
      for (const key of keys) {
        if (have.has(key)) continue;
        await insertBuildSession({ buildId, sessionKey: key, importId: null, position: next++ });
      }
      await reorderBuildSessions(buildId, keys);
    }
  } catch (cause) {
    if (!isMissingTable(causeOf(cause))) throw cause;
  }
  await patchMaking(buildId, { session_order: [...keys] });
}

/** Fold or open a session: the table's `collapsed` when it is there, and `making.sessions_collapsed` always. */
export async function setCollapsed(buildId: string, key: string, value: boolean, made?: unknown): Promise<void> {
  await setSessionCollapsed(buildId, key, value);
  const current = made === undefined ? undefined : sessionsCollapsedOf(made);
  if (current) {
    const next = value ? [...new Set([...current, key])] : current.filter((entry) => entry !== key);
    await patchMaking(buildId, { sessions_collapsed: next });
    return;
  }
  // The caller has no `making` at hand: read it first.
  const list = sessionsCollapsedOf(await readMaking(buildId));
  await patchMaking(buildId, { sessions_collapsed: value ? [...new Set([...list, key])] : list.filter((entry) => entry !== key) });
}

/**
 * The moves that stack the top-level steps by session: the implicit group's steps first, then each session's steps in
 * `groups` order, every session's steps in the order they already had. The steps' own positions are handed out again, so
 * files, tools and results keep theirs. None when the steps already sit that way.
 */
export function stackBySessionMoves(
  tree: readonly Pick<BuildNode, "id" | "parent_id" | "position" | "type">[],
  steps: readonly Step[],
  groups: readonly SessionGroup[],
  /** Steps that go to the end of their session, in this order (a tile moved or merged in), after the ones already there. */
  atEnd: readonly string[] = [],
): NodeMove[] {
  const nodes = topSteps(tree);
  const idOf = new Map(steps.map((step) => [step.number, step.id]));
  const wanted: string[] = [];
  const seen = new Set<string>();
  const take = (number: string) => {
    const id = idOf.get(number);
    if (id && !seen.has(id)) {
      seen.add(id);
      wanted.push(id);
    }
  };
  const last = new Set(atEnd);
  for (const group of groups.filter((entry) => entry.implicit)) group.stepNumbers.forEach(take);
  for (const group of groups.filter((entry) => !entry.implicit)) {
    // The tiles that were already there first, then the ones put at the end, in the order given.
    group.stepNumbers.filter((number) => !last.has(idOf.get(number) ?? "")).forEach(take);
    atEnd.filter((id) => group.stepNumbers.some((number) => idOf.get(number) === id)).forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        wanted.push(id);
      }
    });
  }
  for (const node of nodes) if (!seen.has(node.id)) wanted.push(node.id);
  const slots = nodes.map((node) => node.position as number);
  return wanted.flatMap((id, at) => (nodes[at] && nodes[at].id !== id ? [{ id, parent_id: null, position: slots[at] }] : []));
}

/** The keys of the sessions `groups` shows, in the order they are drawn. */
export const orderKeys = (groups: readonly SessionGroup[]): string[] => groups.filter((group) => !group.implicit).map((group) => groupKey(group));

/** `keys` with `key` moved by `by` places (-1 up, 1 down), kept inside the list. The same list when it cannot move. */
export function movedKey(keys: readonly string[], key: string, by: -1 | 1): string[] {
  const at = keys.indexOf(key);
  const to = at + by;
  if (at < 0 || to < 0 || to >= keys.length) return [...keys];
  const out = [...keys];
  [out[at], out[to]] = [out[to], out[at]];
  return out;
}

/** `keys` with `key` taken out and put where `over` is (a drop on another session's head). */
export function droppedKey(keys: readonly string[], key: string, over: string): string[] {
  const from = keys.indexOf(key);
  const to = keys.indexOf(over);
  if (from < 0 || to < 0 || from === to) return [...keys];
  const out = keys.filter((entry) => entry !== key);
  out.splice(to, 0, key);
  return out;
}
