// CA-12: the sessions in a draft, in the maker's order (`build_sessions`).
//
// A session is the maker's, not a build's: one import can be in any number of
// drafts, and each draft holds its own copy of the tiles. This table is the link,
// and it stores the order sessions are numbered in. A session made here has the
// key `typed-<uuid>`; an imported one has its import id as text.
//
// THE TABLE IS NEWER THAN THE GENERATED TYPES, so every call goes through the one
// cast declared here, as sessions.ts does. A draft that has no rows (an old one,
// or the table not applied yet) reads as it always did: every read here treats a
// missing table as empty, and `hasRows` tells a caller whether to trust the order.

import { supabase } from "@/integrations/supabase/client";
import { buildLayerError } from "./types";

/** A session with more prompts than this is added collapsed. */
export const COLLAPSE_OVER = 12;
/** A collapsed session shows its head, this many tiles, and "Show all {n} prompts". */
export const COLLAPSED_TILES = 3;

export interface BuildSessionRow {
  buildId: string;
  sessionKey: string;
  importId: string | null;
  position: number;
  collapsed: boolean;
}

interface Row {
  build_id: string;
  session_key: string;
  import_id: string | null;
  position: number;
  collapsed: boolean;
}

interface Query<R> extends PromiseLike<{ data: R[] | null; error: unknown }> {
  select: (columns: string) => Query<R>;
  eq: (column: string, value: unknown) => Query<R>;
  in: (column: string, values: readonly string[]) => Query<R>;
  order: (column: string, options: { ascending: boolean }) => Query<R>;
  limit: (count: number) => Query<R>;
}

interface Table {
  select: <R>(columns: string) => Query<R>;
  insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => PromiseLike<{ error: unknown }>;
  upsert: (rows: Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) => PromiseLike<{ error: unknown }>;
  update: (patch: Record<string, unknown>) => { eq: (column: string, value: unknown) => { eq: (column: string, value: unknown) => PromiseLike<{ error: unknown }> } };
  delete: () => { eq: (column: string, value: unknown) => { eq: (column: string, value: unknown) => PromiseLike<{ error: unknown }> } };
}

const table = (): Table => (supabase as unknown as { from: (name: string) => Table }).from("build_sessions");

const COLUMNS = "build_id, session_key, import_id, position, collapsed";
const ROWS_LIMIT = 500;
const DRAFTS_LIMIT = 1000;

/** The table is not there yet (the migration is not applied): Postgres 42P01, PostgREST PGRST205. */
export function isMissingTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === "42P01" || code === "PGRST205" || (typeof message === "string" && /build_sessions/.test(message) && /(does not exist|schema cache)/i.test(message));
}

const toRow = (row: Row): BuildSessionRow => ({
  buildId: row.build_id,
  sessionKey: row.session_key,
  importId: row.import_id ?? null,
  position: row.position,
  collapsed: row.collapsed === true,
});

/** A draft's sessions in order. A missing table, or a draft with none, is an empty list. */
export async function listBuildSessionRows(buildId: string): Promise<BuildSessionRow[]> {
  const { data, error } = await table().select<Row>(COLUMNS).eq("build_id", buildId).order("position", { ascending: true }).limit(ROWS_LIMIT);
  if (error) {
    if (isMissingTable(error)) return [];
    throw buildLayerError("listBuildSessionRows", error);
  }
  return (data ?? []).map(toRow);
}

/**
 * The drafts each import is in, as import id to build ids. A missing table or a failed read gives an empty map: the
 * library still lists the session, it only cannot say which other drafts hold it.
 */
export async function draftsOfImports(importIds: readonly string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (importIds.length === 0) return out;
  const { data, error } = await table().select<Pick<Row, "build_id" | "import_id">>("build_id, import_id").in("import_id", importIds).limit(DRAFTS_LIMIT);
  if (error) {
    // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
    if (!isMissingTable(error)) console.error("[Sessions] drafts of sessions not read", error);
    return out;
  }
  for (const row of data ?? []) {
    if (!row.import_id) continue;
    const list = out.get(row.import_id) ?? [];
    if (!list.includes(row.build_id)) list.push(row.build_id);
    out.set(row.import_id, list);
  }
  return out;
}

/** The next position: one past the highest, so a new session is last. */
export function nextSessionPosition(rows: readonly Pick<BuildSessionRow, "position">[]): number {
  return rows.reduce((highest, row) => Math.max(highest, row.position), -1) + 1;
}

export async function insertBuildSession(row: Omit<BuildSessionRow, "collapsed"> & { collapsed?: boolean }): Promise<void> {
  const { error } = await table().insert({
    build_id: row.buildId,
    session_key: row.sessionKey,
    import_id: row.importId,
    position: row.position,
    collapsed: row.collapsed ?? false,
  });
  if (error) throw buildLayerError("insertBuildSession", error);
}

/** Like `insertBuildSession`, but a table that is not there yet is not an error: false says it was not stored. */
export async function insertBuildSessionIfTable(row: Parameters<typeof insertBuildSession>[0]): Promise<boolean> {
  try {
    await insertBuildSession(row);
    return true;
  } catch (cause) {
    if (isMissingTable((cause as { cause?: unknown } | null)?.cause ?? cause)) return false;
    throw cause;
  }
}

export async function deleteBuildSession(buildId: string, sessionKey: string): Promise<void> {
  const { error } = await table().delete().eq("build_id", buildId).eq("session_key", sessionKey);
  if (error) throw buildLayerError("deleteBuildSession", error);
}

/** Opening or closing a collapsed session is kept. */
export async function setSessionCollapsed(buildId: string, sessionKey: string, collapsed: boolean): Promise<void> {
  const { error } = await table().update({ collapsed }).eq("build_id", buildId).eq("session_key", sessionKey);
  if (error) {
    if (isMissingTable(error)) return;
    throw buildLayerError("setSessionCollapsed", error);
  }
}

/**
 * Sessions in a new order. The unique index on (build_id, position) is not deferrable, so every row is first parked at
 * a negative position and then given its place, as reorderNodes does for nodes.
 */
export async function reorderBuildSessions(buildId: string, keys: readonly string[]): Promise<void> {
  for (const [at, key] of keys.entries()) {
    const { error } = await table().update({ position: -(at + 1) }).eq("build_id", buildId).eq("session_key", key);
    if (error) throw buildLayerError("reorderBuildSessions", error);
  }
  for (const [at, key] of keys.entries()) {
    const { error } = await table().update({ position: at }).eq("build_id", buildId).eq("session_key", key);
    if (error) throw buildLayerError("reorderBuildSessions", error);
  }
}

/** The keys of a draft's sessions in order, for `sessionGroups`. Empty when the draft has no rows. */
export const orderOf = (rows: readonly Pick<BuildSessionRow, "sessionKey" | "position">[]): string[] =>
  [...rows].sort((a, b) => a.position - b.position).map((row) => row.sessionKey);
