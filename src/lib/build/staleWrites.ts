// staleWrites: a write that would undo a change made somewhere else is not made (CA-23 P4). No React in here.
//
// WHAT IT KEEPS, per build open in the composer: what this tab last KNEW of it (the build's row with its `updated_at`, and each
// node row), so a write can tell "nothing has changed" from "somebody else changed it". What it knows moves on when this tab
// reads the build for the first time, when a write of its own lands, and when the maker presses Show changes; an ordinary
// refetch learns of new rows but does not overwrite what is known, or a change made elsewhere would be forgotten unseen.
//
// HOW EACH TABLE IS CHECKED:
//   builds        `updated_at`: the write goes with `.eq("updated_at", known)`, so a stale write changes no rows (PGRST116).
//   build_nodes   no `updated_at` column: the row is read inside the write, just before it, and compared with what is known.
//   build_sessions / build_media / build_events: not checked. Their rows are only inserted, deleted, reordered or folded.
//
// A refused write is not an error and is not lost: what the two places changed apart is merged (clash.ts), and what both changed
// to different things is handed to the page as a clash for the maker to settle. Until there is a page to hand it to (nothing is
// watched), nothing here does anything and every write goes as it always did.

import { StaleWriteError } from "./pendingWrites";
import { applyFields, mergeTile, nodeContent, same } from "./clash";
import { rowTimes } from "./tabSync";
import type { BuildNode } from "./types";

type Obj = Record<string, unknown>;

export type ClashKind = "tile" | "session" | "part" | "post" | "field";

/** A thing changed in two places, as the layer that found it hands it over. */
export interface RawClash {
  kind: ClashKind;
  /** The node's id, the session's key, the part's key, "post", or the column. */
  key: string;
  /** What this tab was writing, and what the other place has, as the fields that differ (a label comes from `fieldLabel`). */
  fields: { key: string; mine: unknown; theirs: unknown }[];
  /** When each edit was made. */
  mineAt: number;
  theirsAt: number;
  /** A tile's row as the other place has it, to draw at once. */
  theirsRow?: BuildNode;
  /** Put one side's version over the build as it stands now. Resolves when it has landed. */
  write: (side: "mine" | "theirs") => Promise<void>;
}

export type ClashHandler = (clash: RawClash) => void;

interface Watched {
  /** The build's row as the database last showed it to this tab (a read, or the answer to a write): its stamp and every value. */
  latest: Obj | null;
  /** Each column as this tab last ACCEPTED it: read at the start, written by this tab, or settled in the clash window. */
  base: Obj;
  nodes: Map<string, BuildNode>;
  handler: ClashHandler | null;
  /** Told when a write was merged with a change made elsewhere, so the page can show it. */
  onMerged: (() => void) | null;
  chain: Promise<unknown>;
}

const watched = new Map<string, Watched>();

/** Start keeping what is known of a build. `handler` hears of every clash. Returns the way to stop. */
export function watchBuild(buildId: string, handler: ClashHandler, onMerged?: () => void): () => void {
  const entry: Watched = watched.get(buildId) ?? { latest: null, base: {}, nodes: new Map(), handler: null, onMerged: null, chain: Promise.resolve() };
  entry.handler = handler;
  entry.onMerged = onMerged ?? null;
  watched.set(buildId, entry);
  return () => {
    if (watched.get(buildId) === entry) watched.delete(buildId);
  };
}

export const isWatched = (buildId: string): boolean => watched.has(buildId);

/** The `updated_at` this tab last knew, or null when the build is not watched (or nothing has been read). */
export const knownStamp = (buildId: string): string | null => {
  const stamp = watched.get(buildId)?.latest?.updated_at;
  return typeof stamp === "string" ? stamp : null;
};

/** The build's row as the database last showed it to this tab. */
export const latestRow = (buildId: string): Obj | null => watched.get(buildId)?.latest ?? null;

/** Each column as this tab last accepted it. */
export const baseRow = (buildId: string): Obj => watched.get(buildId)?.base ?? {};

/** The page hears that a write was merged with another place's change. */
export const tellMerged = (buildId: string): void => watched.get(buildId)?.onMerged?.();

/** The database showed this tab the build's row again (a read after a refused write): not accepted, only seen. */
export function noteLatest(buildId: string, row: Obj): void {
  const entry = watched.get(buildId);
  if (entry) entry.latest = { ...row };
}

/** These columns are settled (the maker chose, in the clash window): what the database holds for them is now the base. */
export function acceptColumns(buildId: string, columns: readonly string[]): void {
  const entry = watched.get(buildId);
  if (!entry?.latest) return;
  for (const column of columns) entry.base[column] = entry.latest[column];
}

/** A node row as last known. */
export const knownNodeRow = (buildId: string, id: string): BuildNode | undefined => watched.get(buildId)?.nodes.get(id);

/** What this tab learned from reading the build. `force` replaces what was known (Show changes); otherwise only what is new is learned. */
export function noteRecord(buildId: string, record: { build: Obj; tree?: readonly BuildNode[] }, force = false): void {
  const entry = watched.get(buildId);
  if (!entry) return;
  if (force || !entry.latest) {
    entry.latest = { ...record.build };
    entry.base = { ...record.build };
  }
  if (force) entry.nodes = new Map();
  for (const row of record.tree ?? []) if (force || !entry.nodes.has(row.id)) entry.nodes.set(row.id, row);
}

/** A write of this tab landed: the build's row as the database now has it. Only the columns written become the base. */
export function noteBuildRow(buildId: string, row: Obj, written?: readonly string[]): void {
  const entry = watched.get(buildId);
  if (!entry) return;
  entry.latest = { ...row };
  if (!written) entry.base = { ...row };
  else for (const column of written) entry.base[column] = row[column];
}

/** Node rows as the database now has them (written by this tab); a row that is gone is forgotten. */
export function noteNodes(buildId: string, rows: readonly BuildNode[], gone: readonly string[] = []): void {
  const entry = watched.get(buildId);
  if (!entry) return;
  for (const row of rows) entry.nodes.set(row.id, row);
  for (const id of gone) entry.nodes.delete(id);
}

/** Every flat row of a tree, for `noteRecord`. */
export function flatNodes(tree: readonly (BuildNode & { children?: unknown })[]): BuildNode[] {
  const out: BuildNode[] = [];
  const walk = (nodes: readonly (BuildNode & { children?: unknown })[]) => {
    for (const node of nodes) {
      const { children, ...row } = node;
      out.push(row as BuildNode);
      walk((Array.isArray(children) ? children : []) as (BuildNode & { children?: unknown })[]);
    }
  };
  walk(tree);
  return out;
}

/** The handler of a watched build, if there is one. */
export const clashHandler = (buildId: string): ClashHandler | null => watched.get(buildId)?.handler ?? null;

/**
 * Writes to the build's own row go one at a time in this tab, each with the stamp the one before left, so a tab does not refuse
 * itself. Not watched: the write just runs.
 */
export function serial<T>(buildId: string, task: () => Promise<T>): Promise<T> {
  const entry = watched.get(buildId);
  if (!entry) return task();
  const next = entry.chain.then(task, task);
  entry.chain = next.catch(() => undefined);
  return next;
}

/** A PostgREST answer for "no row matched" when one row was asked for. */
export const isZeroRows = (error: unknown): boolean => Boolean(error) && typeof error === "object" && ((error as { code?: unknown }).code === "PGRST116" || /0 rows/i.test(String((error as { details?: unknown }).details ?? "")));

/* ── node rows ── */

export interface RowCheck {
  /** The rows to write now: the ones given, merged with what was changed elsewhere where only one place changed it. */
  write: BuildNode[];
  /** The rows as the other place has them, for those whose content was left out of the write because both changed it. */
  theirs: BuildNode[];
}

/**
 * The rows about to be written, read against the database just before: a row whose content changed elsewhere since this tab knew
 * it is merged, never overwritten. `readRows` reads the current rows by id; `writeRows` writes whole rows (for a clash settled
 * later). Not watched, or nothing known of a row: it is written as given.
 */
export async function checkRows(
  buildId: string,
  rows: readonly BuildNode[],
  readRows: (ids: string[]) => Promise<BuildNode[]>,
  writeRows: (rows: BuildNode[]) => Promise<BuildNode[]>,
  bases?: ReadonlyMap<string, BuildNode>,
): Promise<RowCheck> {
  const entry = watched.get(buildId);
  if (!entry || !entry.handler) return { write: [...rows], theirs: [] };
  // `bases` are what the tab knew when the write was first made (a write kept across a reload); else what it knows now.
  const baseOf = (id: string): BuildNode | undefined => bases?.get(id) ?? entry.nodes.get(id);
  const known = rows.filter((row) => baseOf(row.id));
  if (known.length === 0) return { write: [...rows], theirs: [] };

  const current = new Map((await readRows(known.map((row) => row.id))).map((row) => [row.id, row]));
  const write: BuildNode[] = [];
  const theirsOut: BuildNode[] = [];
  const asked = new Set(known.map((row) => row.id));
  for (const row of rows) {
    const now = current.get(row.id);
    const base = baseOf(row.id);
    if (!asked.has(row.id) || !now || !base) {
      write.push(row);
      continue;
    }
    if (same(nodeContent(now), nodeContent(base))) {
      write.push(row);
      continue;
    }
    const { row: merged, conflicts } = mergeTile(base, row, now);
    write.push(merged);
    if (conflicts.length === 0) continue;
    theirsOut.push(now);
    const mineFields = Object.fromEntries(conflicts.map((c) => [c.key, c.mine]));
    const theirsFields = Object.fromEntries(conflicts.map((c) => [c.key, c.theirs]));
    entry.handler({
      kind: "tile",
      key: row.id,
      fields: conflicts,
      mineAt: Date.now(),
      theirsAt: rowTimes.get(row.id) ?? Date.now(),
      theirsRow: now,
      write: async (side) => {
        const at = entry.nodes.get(row.id) ?? merged;
        const written = await writeRows([applyFields(at, side === "mine" ? mineFields : theirsFields)]);
        noteNodes(buildId, written);
      },
    });
  }
  return { write, theirs: theirsOut };
}

export { StaleWriteError };
