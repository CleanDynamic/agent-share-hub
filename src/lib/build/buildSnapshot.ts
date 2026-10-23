// buildSnapshot: taking a snapshot of the build, and putting it back (CA-20 P2).
//
// WHAT A SNAPSHOT HOLDS. Every placed node row of the build, parents first (so a team comes back with its agents), the
// `build_sessions` rows, and the slices of `builds.making` that removing, moving and merging change: the sessions' entries,
// their order, the parts, their labels, the map's settings, which sessions are folded, and the imported sessions and the
// tools they were made with (which only the layout reads). Colours, groups and the post's links are the reference bridge's.
//
// PUTTING IT BACK WRITES THE SAME IDS. A snapshot is restored by planning the difference between the build as it is and the
// snapshot (`planRestore`, pure), then writing it: what is not in the snapshot goes, what is missing comes back with its
// own id (so post links, group members and map connections still point at it), what changed is written back, and what is
// out of place moves. Places are written through `reorderNodes`, which parks the moved rows first, because the unique
// index on (build_id, parent_id, position) is not deferrable.
//
// Nothing is kept after the visit: a snapshot lives in memory with the history.

import { deleteBuildSession, insertBuildSession, isMissingTable, listBuildSessionRows, nextSessionPosition, reorderBuildSessions, setSessionCollapsed, type BuildSessionRow } from "./buildSessions";
import { patchMaking, readMaking, refreshMakingStats } from "./making";
import { deleteNode, reorderNodes, type NodeMove } from "./nodes";
import { flatRows, writeNodeRows } from "./sessionEdit";
import type { BuildNode, NodeTree } from "./types";

/** The slices of `making` a snapshot keeps. A key the build did not have is put back as absent. */
export const MAKING_KEYS = ["sessions_meta", "session_order", "workstreams", "sessions_collapsed", "part_labels", "map", "sessions", "session_tools"] as const;

export interface BuildSnapshot {
  /** Every placed node row, parents first, in position order. */
  nodes: BuildNode[];
  /** The draft's `build_sessions` rows, in order. */
  sessions: BuildSessionRow[];
  /** The slices of `making`, by key; a key that is absent was absent. */
  making: Record<string, unknown>;
}

const asObject = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** A snapshot from what the page holds: the tree as it stands, the draft's `making`, and its session rows. */
export function snapshotOf(tree: readonly NodeTree[], making: unknown, sessions: readonly BuildSessionRow[]): BuildSnapshot {
  const source = asObject(making);
  const kept: Record<string, unknown> = {};
  for (const key of MAKING_KEYS) if (key in source && source[key] !== undefined) kept[key] = JSON.parse(JSON.stringify(source[key]));
  return { nodes: flatRows(tree).map((row) => ({ ...row, payload: JSON.parse(JSON.stringify(row.payload ?? null)) })), sessions: sessions.map((row) => ({ ...row })), making: kept };
}

/** What the page reads from the database to take a snapshot: `making` and the session rows. */
export async function readSnapshotParts(buildId: string): Promise<{ making: unknown; sessions: BuildSessionRow[] }> {
  const [making, sessions] = await Promise.all([readMaking(buildId), listBuildSessionRows(buildId).catch(() => [] as BuildSessionRow[])]);
  return { making, sessions };
}

/* ── the plan ── */

export interface RestorePlan {
  /** Rows to delete, only the topmost of each subtree (the foreign key takes the rest). */
  remove: string[];
  /** Rows kept that sit inside a row that goes: they are moved out first. */
  rescue: BuildNode[];
  /** Rows the build lacks, parents first. */
  insert: BuildNode[];
  /** Rows whose contents differ, to write where they stand. */
  update: BuildNode[];
  /** Every row that is not where the snapshot has it, including the rows just inserted. */
  moves: NodeMove[];
}

/** What of a row is its contents, not its place. */
const contentsOf = (row: BuildNode): string => JSON.stringify([row.type, row.title, row.note, row.payload, row.source_ref, row.event_id, row.is_gap]);

/** The difference between the build as it is (`current`) and the snapshot's rows (`target`). Pure. */
export function planRestore(current: readonly BuildNode[], target: readonly BuildNode[]): RestorePlan {
  const now = new Map(current.map((row) => [row.id, row]));
  const want = new Map(target.map((row) => [row.id, row]));
  const goes = new Set(current.filter((row) => !want.has(row.id)).map((row) => row.id));
  const remove = current.filter((row) => goes.has(row.id) && !(row.parent_id && goes.has(row.parent_id))).map((row) => row.id);
  // A row that stays but sits inside a row that goes would be taken with it: it is moved out under its place in the snapshot.
  const inside = (row: BuildNode): boolean => {
    for (let parent = row.parent_id ? now.get(row.parent_id) : undefined; parent; parent = parent.parent_id ? now.get(parent.parent_id) : undefined) if (goes.has(parent.id)) return true;
    return false;
  };
  const rescue = current.filter((row) => want.has(row.id) && inside(row));
  const insert = target.filter((row) => !now.has(row.id));
  const update = target.filter((row) => {
    const here = now.get(row.id);
    return Boolean(here) && contentsOf(here as BuildNode) !== contentsOf(row);
  });
  const moves: NodeMove[] = [];
  for (const row of target) {
    const here = now.get(row.id);
    if (here && here.parent_id === row.parent_id && here.position === row.position) continue;
    moves.push({ id: row.id, parent_id: row.parent_id, position: row.position as number });
  }
  return { remove, rescue, insert, update, moves };
}

/** Whether restoring would change nothing. */
export const isNoChange = (plan: RestorePlan): boolean => plan.remove.length === 0 && plan.insert.length === 0 && plan.update.length === 0 && plan.moves.length === 0;

/** Every id in a row's subtree, in the rows given. */
export function subtreeIds(rows: readonly Pick<BuildNode, "id" | "parent_id">[], id: string): string[] {
  const out = [id];
  for (let at = 0; at < out.length; at += 1) for (const row of rows) if (row.parent_id === out[at] && !out.includes(row.id)) out.push(row.id);
  return out;
}

/* ── a step's own changes ── */

/** A row as it matters to a step: its place and its contents. */
const rowKey = (row: BuildNode | undefined): string => (row ? JSON.stringify([row.parent_id, row.position, contentsOf(row)]) : "");

/** Rows parents first, each parent's children in position order. */
export function parentsFirst(rows: readonly BuildNode[]): BuildNode[] {
  const ids = new Set(rows.map((row) => row.id));
  const byParent = new Map<string | null, BuildNode[]>();
  for (const row of rows) {
    const key = row.parent_id && ids.has(row.parent_id) ? row.parent_id : null;
    byParent.set(key, [...(byParent.get(key) ?? []), row]);
  }
  const out: BuildNode[] = [];
  const walk = (parent: string | null) => {
    for (const row of [...(byParent.get(parent) ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      out.push(row);
      walk(row.id);
    }
  };
  walk(null);
  return out;
}

/**
 * Rows that share a place under one parent are given places in turn: the one with the lower position first, a row the step
 * changed before one it did not, and each moved up past the one before it. Every other row keeps the place it has.
 */
function settled(rows: readonly BuildNode[], changed: ReadonlySet<string>): BuildNode[] {
  const groups = new Map<string, BuildNode[]>();
  for (const row of rows) groups.set(String(row.parent_id), [...(groups.get(String(row.parent_id)) ?? []), row]);
  const place = new Map<string, number>();
  for (const group of groups.values()) {
    if (new Set(group.map((row) => row.position)).size === group.length) continue;
    const ordered = [...group].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || Number(changed.has(b.id)) - Number(changed.has(a.id)));
    let last = Number.NEGATIVE_INFINITY;
    for (const row of ordered) {
      last = Math.max(row.position ?? 0, last + 1);
      place.set(row.id, last);
    }
  }
  return rows.map((row) => (place.has(row.id) ? { ...row, position: place.get(row.id) as number } : row));
}

/**
 * The snapshot that undoes (or redoes) one step: the build as it stands, with only what the step changed put as `to` has it.
 * `from` is the state the step left, `to` the state it is going back to (or the one it first started from, for a redo).
 * Anything written since that the step did not touch (a prompt's text saved later) stays as it is.
 */
export function deltaTarget(current: BuildSnapshot, from: BuildSnapshot, to: BuildSnapshot): BuildSnapshot {
  const was = new Map(from.nodes.map((row) => [row.id, row]));
  const goes = new Map(to.nodes.map((row) => [row.id, row]));
  const changed = new Set<string>();
  for (const id of new Set([...was.keys(), ...goes.keys()])) if (rowKey(was.get(id)) !== rowKey(goes.get(id))) changed.add(id);
  const rows = [...current.nodes.filter((row) => !changed.has(row.id)), ...to.nodes.filter((row) => changed.has(row.id))];

  const making: Record<string, unknown> = { ...current.making };
  for (const key of MAKING_KEYS) {
    if (JSON.stringify(from.making[key] ?? null) === JSON.stringify(to.making[key] ?? null)) continue;
    if (key in to.making) making[key] = to.making[key];
    else delete making[key];
  }

  const sessionKey = (row: BuildSessionRow) => JSON.stringify([row.sessionKey, row.importId, row.position, row.collapsed]);
  const sessionsDiffer = JSON.stringify(from.sessions.map(sessionKey)) !== JSON.stringify(to.sessions.map(sessionKey));
  let sessions = current.sessions;
  if (sessionsDiffer) {
    const touched = new Set([...from.sessions, ...to.sessions].map((row) => row.sessionKey));
    const extra = current.sessions.filter((row) => !touched.has(row.sessionKey));
    sessions = [...to.sessions, ...extra.map((row, at) => ({ ...row, position: to.sessions.length + at }))];
  }
  return { nodes: parentsFirst(settled(rows, changed)), sessions, making };
}

/* ── writing it ── */

/** What the writer needs of the composer's node queue. */
export interface SnapshotNodes {
  run: <T>(task: () => Promise<T>) => Promise<T>;
  current: () => NodeTree[];
  record: (id: string, node: BuildNode | null) => void;
}

/** Parking places for rows put back and rows moved out: below zero, apart from `reorderNodes`' own. */
const PARK_INSERT = -200_000;
const PARK_RESCUE = -300_000;

/** The snapshot to make: given as it is, or worked out from the build as it stands once the node queue has reached it. */
export type SnapshotTarget = BuildSnapshot | ((current: BuildSnapshot) => BuildSnapshot);

/** The build as it stands, read inside the node queue. */
export async function currentSnapshot(buildId: string, nodes: Pick<SnapshotNodes, "current">): Promise<BuildSnapshot> {
  const { making, sessions } = await readSnapshotParts(buildId);
  return snapshotOf(nodes.current(), making, sessions);
}

/** Make the build as the snapshot has it. Runs in the node queue, behind any write already going. */
export async function restoreSnapshot(buildId: string, nodes: SnapshotNodes, wanted: SnapshotTarget): Promise<void> {
  await nodes.run(async () => {
    const target = typeof wanted === "function" ? wanted(await currentSnapshot(buildId, nodes)) : wanted;
    const plan = planRestore(flatRows(nodes.current()), target.nodes);
    const rowOf = new Map(target.nodes.map((row) => [row.id, row]));

    // Kept rows inside a row that goes are moved out first, parked under their place in the snapshot.
    if (plan.rescue.length > 0) {
      const moves = plan.rescue.map((row, at) => ({ id: row.id, parent_id: rowOf.get(row.id)?.parent_id ?? null, position: PARK_RESCUE - at }));
      await reorderNodes(buildId, moves);
      for (const move of moves) {
        const fresh = flatRows(nodes.current()).find((row) => row.id === move.id);
        if (fresh) nodes.record(move.id, { ...fresh, parent_id: move.parent_id, position: move.position });
      }
    }

    const before = flatRows(nodes.current());
    for (const id of plan.remove) {
      // What is inside goes first, then the row itself: nothing here depends on the foreign key's cascade.
      const within = subtreeIds(before, id);
      for (const inner of [...within].reverse()) await deleteNode(inner);
      for (const gone of within) nodes.record(gone, null);
    }

    if (plan.insert.length > 0) {
      const parked = plan.insert.map((row, at) => ({ ...row, position: PARK_INSERT - at }));
      for (const row of await writeNodeRows(parked)) nodes.record(row.id, row);
    }

    if (plan.update.length > 0) {
      const here = new Map(flatRows(nodes.current()).map((row) => [row.id, row]));
      const rows = plan.update.map((row) => ({ ...row, parent_id: here.get(row.id)?.parent_id ?? row.parent_id, position: here.get(row.id)?.position ?? row.position }));
      for (const row of await writeNodeRows(rows)) nodes.record(row.id, row);
    }

    if (plan.moves.length > 0) {
      await reorderNodes(buildId, plan.moves);
      const here = new Map(flatRows(nodes.current()).map((row) => [row.id, row]));
      for (const move of plan.moves) {
        const fresh = here.get(move.id) ?? rowOf.get(move.id);
        if (fresh) nodes.record(move.id, { ...fresh, parent_id: move.parent_id, position: move.position });
      }
    }

    // The slices of `making` the snapshot keeps; a key the build did not have goes again.
    const patch: Record<string, unknown> = {};
    for (const key of MAKING_KEYS) patch[key] = key in target.making ? target.making[key] : undefined;
    await patchMaking(buildId, patch);

    await restoreSessionRows(buildId, target.sessions);
  });
  await refreshMakingStats(buildId).catch(() => undefined);
}

/** `build_sessions` as the snapshot had it: rows it lacked go, rows it had come back, the order and the folds are put right. A draft without the table has nothing to do. */
async function restoreSessionRows(buildId: string, wanted: readonly BuildSessionRow[]): Promise<void> {
  try {
    const rows = await listBuildSessionRows(buildId);
    const keys = new Set(wanted.map((row) => row.sessionKey));
    for (const row of rows) if (!keys.has(row.sessionKey)) await deleteBuildSession(buildId, row.sessionKey);
    const have = new Map(rows.filter((row) => keys.has(row.sessionKey)).map((row) => [row.sessionKey, row]));
    let next = nextSessionPosition(rows);
    for (const row of wanted) {
      if (!have.has(row.sessionKey)) await insertBuildSession({ buildId, sessionKey: row.sessionKey, importId: row.importId, position: next++, collapsed: row.collapsed });
      else if (have.get(row.sessionKey)?.collapsed !== row.collapsed) await setSessionCollapsed(buildId, row.sessionKey, row.collapsed);
    }
    if (wanted.length > 0) await reorderBuildSessions(buildId, [...wanted].sort((a, b) => a.position - b.position).map((row) => row.sessionKey));
  } catch (cause) {
    const inner = (cause as { cause?: unknown } | null)?.cause ?? cause;
    if (!isMissingTable(inner)) throw cause;
  }
}
