// SV-24 P1: saved filter sets, and Groups.
//
// A FILTER SET is the Builds filters under a name: `query.search` is the address's query string (what `galleryHref` wrote), and
// `query.layout` the panel's order, heights and the columns (SV-24 P2). A set is private to its owner until the owner makes it
// public. A GROUP is a public filter set with members (`filter_set_members`), not a guild: see the migration.
//
// LIBRARY. A set made here is also kept in Library as a saved item of kind `filter_set` (`ref` is the set's id, the snapshot its name
// and search), so Library's Filter sets lists it with no read of its own. That copy is best effort: Library failing to keep it is not
// the set failing to save, and a saved item with no set behind it still opens as the search it holds.
//
// ERRORS carry identifiers only (SocialError), never a name a reader typed. THE TABLES MAY NOT BE THERE YET: a read answers "nothing"
// when the error's code says so, and a write says it could not.

import { saveItem } from "@/lib/library/savedItems";
import { SocialError, currentUserId, db, signedOutError, socialError } from "@/lib/social/types";

import { isEmptyLayout, parseLayout, type BuildsLayout } from "./buildsLayout";

export const FILTER_SET_NAME_MAX = 80;
export const FILTER_SETS_LIMIT = 50;
export const GROUPS_LIMIT = 12;

const MISSING = new Set(["42P01", "PGRST205", "42883", "PGRST202"]);
const isMissing = (error: unknown): boolean => MISSING.has(String((error as { code?: unknown } | null)?.code));

export interface FilterSet {
  id: string;
  name: string;
  /** The address's query string, without `?`. */
  search: string;
  isPublic: boolean;
  ownerId: string;
  layout: BuildsLayout | null;
}

export interface FilterSetDetail extends FilterSet {
  /** The viewer made it. */
  mine: boolean;
  members: number;
  /** The viewer follows it. */
  member: boolean;
}

export interface Group {
  id: string;
  name: string;
  search: string;
  members: number;
  member: boolean;
  mine: boolean;
}

interface SetRow {
  id: string;
  name: string;
  query: unknown;
  is_public: boolean;
  user_id: string;
}

const COLUMNS = "id, name, query, is_public, user_id";

/** A name as it is kept: trimmed, one space at a time, at most 80 characters. Empty is refused by the caller. */
export const cleanSetName = (raw: string): string => raw.replace(/\s+/g, " ").trim().slice(0, FILTER_SET_NAME_MAX);

function setOf(row: SetRow): FilterSet {
  const query = row.query && typeof row.query === "object" && !Array.isArray(row.query) ? (row.query as Record<string, unknown>) : {};
  return {
    id: row.id,
    name: row.name,
    search: typeof query.search === "string" ? query.search : "",
    isPublic: row.is_public === true,
    ownerId: row.user_id,
    layout: query.layout === undefined ? null : parseLayout(query.layout),
  };
}

/** What the `query` column holds. A layout with nothing in it is not written. */
export function queryOf(search: string, layout: BuildsLayout | null): Record<string, unknown> {
  return { search: search.replace(/^\?/, ""), ...(layout && !isEmptyLayout(layout) ? { layout } : {}) };
}

/** The signed-in reader's sets, newest first. Signed out, or before the table is there: none. */
export async function listMyFilterSets(limit: number = FILTER_SETS_LIMIT): Promise<FilterSet[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const response = await db.from("filter_sets").select(COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(Math.min(limit, FILTER_SETS_LIMIT));
  if (response.error) {
    if (isMissing(response.error)) return [];
    throw socialError("listMyFilterSets", response);
  }
  return ((response.data ?? []) as SetRow[]).map(setOf);
}

/** One set the viewer may read, with its members; null when it is not there, is private to someone else, or the table is not. */
export async function getFilterSet(id: string): Promise<FilterSetDetail | null> {
  const userId = await currentUserId();
  const [found, count, own] = await Promise.all([
    db.from("filter_sets").select(COLUMNS).eq("id", id).limit(1).maybeSingle(),
    db.from("filter_set_members").select("user_id", { count: "exact", head: true }).eq("filter_set_id", id),
    userId ? db.from("filter_set_members").select("user_id").eq("filter_set_id", id).eq("user_id", userId).limit(1) : Promise.resolve({ data: [], error: null }),
  ]);
  if (found.error) {
    if (isMissing(found.error)) return null;
    throw socialError("getFilterSet", found);
  }
  if (!found.data) return null;
  const set = setOf(found.data as SetRow);
  return {
    ...set,
    mine: userId !== null && set.ownerId === userId,
    members: count.error ? 0 : (count.count ?? 0),
    member: !own.error && ((own.data ?? []) as unknown[]).length > 0,
  };
}

/** Library's copy of a set: best effort, so a Library that cannot keep it does not fail the set. */
async function keepInLibrary(set: Pick<FilterSet, "id" | "name" | "search">): Promise<void> {
  try {
    await saveItem({ kind: "filter_set", ref: set.id, snapshot: { name: set.name, query: set.search } });
  } catch {
    /* Library keeps what it can. */
  }
}

/** Save the current filters as a set. A public set is joined by its maker, so a Group has a member from the start. */
export async function createFilterSet(input: { name: string; search: string; isPublic?: boolean; layout?: BuildsLayout | null }): Promise<FilterSet> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("createFilterSet");
  const name = cleanSetName(input.name);
  if (!name) throw new SocialError("createFilterSet", "invalid");
  const response = await db.from("filter_sets").insert({ user_id: userId, name, query: queryOf(input.search, input.layout ?? null), is_public: input.isPublic === true }).select(COLUMNS).single();
  if (response.error || !response.data) throw socialError("createFilterSet", response);
  const set = setOf(response.data as SetRow);
  if (set.isPublic) await joinFilterSet(set.id).catch(() => undefined);
  await keepInLibrary(set);
  return set;
}

export async function renameFilterSet(id: string, rawName: string): Promise<string> {
  const name = cleanSetName(rawName);
  if (!name) throw new SocialError("renameFilterSet", "invalid");
  const response = await db.from("filter_sets").update({ name }).eq("id", id);
  if (response.error) throw socialError("renameFilterSet", response);
  // Library's copy follows; its search is already the set's.
  await db.from("saved_items").update({ snapshot: { name } }).eq("kind", "filter_set").eq("ref", id).then(() => undefined, () => undefined);
  return name;
}

/** Make a set public (a Group) or private again. Making it public joins its maker. */
export async function setFilterSetPublic(id: string, isPublic: boolean): Promise<void> {
  const response = await db.from("filter_sets").update({ is_public: isPublic }).eq("id", id);
  if (response.error) throw socialError("setFilterSetPublic", response);
  if (isPublic) await joinFilterSet(id).catch(() => undefined);
}

/** Keep the layout in the set: `query` is replaced whole, so the search comes with it. */
export async function saveFilterSetLayout(id: string, search: string, layout: BuildsLayout): Promise<void> {
  const response = await db.from("filter_sets").update({ query: queryOf(search, layout) }).eq("id", id);
  if (response.error) throw socialError("saveFilterSetLayout", response);
}

export async function deleteFilterSet(id: string): Promise<void> {
  const response = await db.from("filter_sets").delete().eq("id", id);
  if (response.error) throw socialError("deleteFilterSet", response);
  await db.from("saved_items").delete().eq("kind", "filter_set").eq("ref", id).then(() => undefined, () => undefined);
}

/** Follow a public set. Following it twice is not an error. */
export async function joinFilterSet(id: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("joinFilterSet");
  const response = await db.from("filter_set_members").insert({ filter_set_id: id, user_id: userId });
  if (response.error && String((response.error as { code?: unknown }).code) !== "23505") throw socialError("joinFilterSet", response);
}

export async function leaveFilterSet(id: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("leaveFilterSet");
  const response = await db.from("filter_set_members").delete().eq("filter_set_id", id).eq("user_id", userId);
  if (response.error) throw socialError("leaveFilterSet", response);
}

interface GroupRow {
  id: string;
  name: string;
  search: string | null;
  members: number | string;
  is_member: boolean;
  is_owner: boolean;
}

/** OpenBuilds' Groups: the public sets, the reader's own first and then by members. One request; none before the function is there. */
export async function listGroups(limit: number = GROUPS_LIMIT): Promise<Group[]> {
  const response = await db.rpc("list_filter_set_groups", { p_limit: limit });
  if (response.error) {
    if (isMissing(response.error)) return [];
    throw socialError("listGroups", response);
  }
  return ((response.data ?? []) as GroupRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    search: row.search ?? "",
    members: Number(row.members) || 0,
    member: row.is_member === true,
    mine: row.is_owner === true,
  }));
}

/** The address that opens a set: its filters, and `set=` so the page knows which set the layout is kept in. */
export function filterSetHref(set: Pick<FilterSet, "id" | "search">): string {
  const search = new URLSearchParams(set.search);
  search.set("set", set.id);
  return `/builds?${search.toString()}`;
}
