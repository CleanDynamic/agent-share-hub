// What became of a saved item's source (SV-19).
//
// A saved copy is a snapshot (savedItems.ts) and stays usable when its source is edited or removed. This file says which has
// happened, so Library can mark the item `Edited` or `Removed`, offer the saved and the current version, and Add from Library can
// insert either.
//
// THE VERSION is build_nodes.updated_at (20261030120000_sv19_node_versions.sql): it moves when a node's type, title, note or
// payload changes, never when the node is only moved. A step's version is its own; a part's is the newest in its subtree; a
// session's is the newest of its prompt tiles. saveItem stores it in saved_items.source_version as the database wrote it.
//
// REMOVED is "I can no longer read the source": the node or its build is deleted, or the build is no longer published. Both
// look the same through the reader's rights, and both mean the same to them. A read that hit its cap never says Removed.
//
// Until the migration is applied the column does not exist; the read falls back to presence only (nothing reads Edited) and the
// save stores no version, so nothing breaks in between.

import { methodOf } from "@/lib/build/forkRules";
import { db, socialError } from "@/lib/social/types";

import type { LibrarySavedItem, SavedKind } from "./savedItems";

/** What the state of a source needs of a saved item. */
export type SourceItem = Pick<LibrarySavedItem, "id" | "kind" | "ref" | "buildId" | "sourceVersion">;

type Payload = Record<string, unknown>;

/** One line of a version, marked when only that version has it. The same shape LibraryView draws. */
export interface DiffLine {
  text: string;
  change?: "added" | "removed";
}

export type SourceState = "same" | "edited" | "removed";

export interface SourceStatus {
  state: SourceState;
  /** The source's version now, as the database wrote it; null when it is gone or the column is not there yet. */
  version: string | null;
}

/** The kinds whose source is a tile in a build. */
const NODE_KINDS: ReadonlySet<SavedKind> = new Set<SavedKind>(["step", "part", "session"]);

/** More nodes than this in the builds asked about, and the read is cut: a missing node is then not claimed to be removed. */
export const STAMP_ROW_LIMIT = 5000;

export interface StampRow {
  id: string;
  build_id: string;
  parent_id: string | null;
  type: string;
  updated_at: string | null;
  /** `payload->>session` and `source_ref->>import_session_id`: the two ways a prompt tile names its session. */
  session: string | null;
  import_session: string | null;
}

const STAMP_COLUMNS = "id, build_id, parent_id, type, session:payload->>session, import_session:source_ref->>import_session_id";

const ms = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : Number.NaN);

const newest = (stamps: readonly (string | null)[]): string | null => {
  let best: string | null = null;
  for (const stamp of stamps) if (stamp && (best === null || ms(stamp) > ms(best))) best = stamp;
  return best;
};

/* ── pure: which version a source has, and what that makes of the saved item ── */

/** A node and everything below it. Children are looked up from a Map, not searched for ⟦js-set-map-lookups⟧. */
function subtree(rows: readonly StampRow[], rootId: string): StampRow[] {
  const children = new Map<string, StampRow[]>();
  for (const row of rows) if (row.parent_id) children.set(row.parent_id, [...(children.get(row.parent_id) ?? []), row]);
  const root = rows.find((row) => row.id === rootId);
  if (!root) return [];
  const out: StampRow[] = [];
  const walk = (row: StampRow) => {
    out.push(row);
    for (const child of children.get(row.id) ?? []) walk(child);
  };
  walk(root);
  return out;
}

/** The tiles that make up a saved item's source, among one build's rows. Empty when the source is not there. */
export function sourceRows(kind: SavedKind, ref: string | null, rows: readonly StampRow[]): StampRow[] {
  if (!ref) return [];
  if (kind === "step") return rows.filter((row) => row.id === ref);
  if (kind === "part") return subtree(rows, ref);
  if (kind === "session") return rows.filter((row) => row.type === "prompt" && (row.session === ref || row.import_session === ref));
  return [];
}

/** The version of a saved item's source in one build's rows: null when it is not there or has no stamp. */
export function versionOf(kind: SavedKind, ref: string | null, rows: readonly StampRow[]): string | null {
  return newest(sourceRows(kind, ref, rows).map((row) => row.updated_at));
}

/** Same, Edited or Removed, from what the item recorded and what the source is now. */
export function statusOf(item: Pick<LibrarySavedItem, "kind" | "ref" | "buildId" | "sourceVersion">, rowsOfBuild: readonly StampRow[] | null, complete: boolean): SourceStatus {
  if (!NODE_KINDS.has(item.kind)) return { state: "same", version: null };
  if (!item.buildId || !item.ref) return { state: "removed", version: null };
  const found = sourceRows(item.kind, item.ref, rowsOfBuild ?? []);
  if (found.length === 0) return complete ? { state: "removed", version: null } : { state: "same", version: null };
  const version = newest(found.map((row) => row.updated_at));
  const edited = item.sourceVersion !== null && version !== null && ms(version) > ms(item.sourceVersion);
  return { state: edited ? "edited" : "same", version };
}

/* ── reads ── */

const missingColumn = (error: unknown): boolean => {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "42703" || /updated_at/.test(e?.message ?? "");
};

/** The nodes of these builds, as little as the question needs, in one request (two when the version column is not there yet). */
export async function readStamps(buildIds: readonly string[]): Promise<{ rows: StampRow[]; complete: boolean }> {
  const ids = [...new Set(buildIds)];
  if (ids.length === 0) return { rows: [], complete: true };
  const ask = (columns: string) => db.from("build_nodes").select(columns).in("build_id", ids).limit(STAMP_ROW_LIMIT);
  let response = await ask(`${STAMP_COLUMNS}, updated_at`);
  if (response.error && missingColumn(response.error)) response = await ask(STAMP_COLUMNS);
  if (response.error) throw socialError("readStamps", response);
  const rows = ((response.data ?? []) as unknown as Partial<StampRow>[]).map((row) => ({ ...row, updated_at: row.updated_at ?? null })) as StampRow[];
  return { rows, complete: rows.length < STAMP_ROW_LIMIT };
}

/**
 * The state of each of these saved items' sources, in one request for all of them. Kinds with no tile as a source (a request, a
 * filter set, a collection) are not in the answer.
 */
export async function listSourceStates(items: readonly SourceItem[]): Promise<Map<string, SourceStatus>> {
  const wanted = items.filter((item) => NODE_KINDS.has(item.kind));
  const out = new Map<string, SourceStatus>();
  const { rows, complete } = await readStamps(wanted.flatMap((item) => (item.buildId ? [item.buildId] : [])));
  const byBuild = new Map<string, StampRow[]>();
  for (const row of rows) byBuild.set(row.build_id, [...(byBuild.get(row.build_id) ?? []), row]);
  for (const item of wanted) out.set(item.id, statusOf(item, item.buildId ? (byBuild.get(item.buildId) ?? []) : null, complete));
  return out;
}

/** The version to store with a snapshot made now, from the build's nodes. Null when the column is not there yet. */
export async function versionNow(kind: SavedKind, ref: string | null, buildId: string): Promise<string | null> {
  const { rows } = await readStamps([buildId]);
  return versionOf(kind, ref, rows);
}

/* ── content, for the version switch ── */

const TEXT_KEYS = ["text", "instructions", "system_prompt"] as const;

/** The lines a step shows: its title, the text of its method, the model, its note. Empty lines are left out. */
export function contentLines(node: { title?: string | null; note?: string | null; payload?: unknown }): string[] {
  const payload = (node.payload && typeof node.payload === "object" && !Array.isArray(node.payload) ? node.payload : {}) as Payload;
  const key = TEXT_KEYS.find((name) => typeof payload[name] === "string" && (payload[name] as string).trim());
  const body = key ? (payload[key] as string).split(/\r?\n/) : [];
  const model = typeof payload.model === "string" && payload.model.trim() ? [`Model: ${payload.model.trim()}`] : [];
  return [node.title ?? "", ...body, ...model, node.note ?? ""].map((line) => line.trimEnd()).filter((line) => line.trim() !== "");
}

/** The saved and the current lines side by side, the lines only one side has marked: removed on the saved side, added on the current. */
export function diffLines(saved: readonly string[], current: readonly string[]): { saved: DiffLine[]; current: DiffLine[] } {
  const n = saved.length;
  const m = current.length;
  // Longest common subsequence of lines, so a line that moved is not shown as both removed and added.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) lcs[i][j] = saved[i] === current[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const a: DiffLine[] = [];
  const b: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (saved[i] === current[j]) {
      a.push({ text: saved[i] });
      b.push({ text: current[j] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      a.push({ text: saved[i], change: "removed" });
      i += 1;
    } else {
      b.push({ text: current[j], change: "added" });
      j += 1;
    }
  }
  for (; i < n; i += 1) a.push({ text: saved[i], change: "removed" });
  for (; j < m; j += 1) b.push({ text: current[j], change: "added" });
  return { saved: a, current: b };
}

/** The lines of a saved item as saved: its snapshot's title, method and note. */
export function savedLines(item: Pick<LibrarySavedItem, "snapshot">): string[] {
  const snap = item.snapshot as { title?: string | null; note?: string | null; payload?: unknown };
  return contentLines(snap);
}

/** The lines of a step or part's source now, or null when it can't be read (it is removed). One request. */
export async function currentLines(item: Pick<LibrarySavedItem, "kind" | "ref">): Promise<string[] | null> {
  if (!item.ref || (item.kind !== "step" && item.kind !== "part")) return null;
  const response = await db.from("build_nodes").select("id, title, note, payload").eq("id", item.ref).limit(1).maybeSingle();
  if (response.error) throw socialError("currentLines", response);
  const node = response.data as { title: string | null; note: string | null; payload: unknown } | null;
  return node ? contentLines({ ...node, payload: methodOf((node.payload ?? {}) as object) }) : null;
}
