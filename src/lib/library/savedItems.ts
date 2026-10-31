// Saved items below build size (SV-17).
//
// A reader keeps a part, a session, a step, a request or a filter set, and a public collection (to count "saved by n"). Builds
// stay in build_saves (src/lib/social/saves.ts), so builds.save_count keeps working. One saved_items row per (reader, kind,
// build, ref); the row holds a SNAPSHOT, so the saved copy stays usable when its source is edited or removed.
//
// WHAT A SNAPSHOT HOLDS follows the rules that already exist for copying. A step or part is stored as forkRules.methodOf copies
// it: the method and never the evidence (build_cost, run_cost, trace_url, what a helper did). A session is stored as addSession
// writes its tiles: the prompt text and the model, and where it came from. The answers, run costs and trace urls are never read
// into a snapshot, because a copy of a snapshot has run nowhere.
//
// PRIVATE TO THE SAVER (20261029120000_sv17_saved_items.sql): the table's policies give every command to the owner and nobody
// else, the source's maker included. A DRAFT'S CONTENT CAN'T BE SAVED: refused here before any write, and by the insert policy.
//
// ERRORS CARRY IDENTIFIERS ONLY ⟦neoscale-error-monitoring › Privacy⟧: a snapshot is a reader's prompt text, and a refused
// insert's details can quote it, so failures are SocialErrors (operation, ids, code, status), never the server's message.
//
// LISTS are one request a page, a limit on every one, and a cursor that is the offset of the next page: a reader's saved items
// are tens, and a sort by name has no stable keyset to page on. The counts and the reads for Used in and saved by are one
// request each, started with the list.

import type { Json } from "@/integrations/supabase/types";
import { getBuildHeader } from "@/lib/build/builds";
import { methodOf } from "@/lib/build/forkRules";
import { sessionsMetaOf } from "@/lib/build/making";
import { getNodeTree } from "@/lib/build/nodes";
import type { Build, NodeTree } from "@/lib/build/types";
import { versionNow } from "./sourceVersions";
import { SocialError, currentUserId, db, isDuplicate, signedOutError, socialError, uniqueIds } from "@/lib/social/types";

export type SavedKind = "part" | "session" | "step" | "request" | "filter_set" | "collection";

export const SAVED_KINDS: readonly SavedKind[] = ["part", "session", "step", "request", "filter_set", "collection"];

/** The longest note saved_items.note accepts. */
export const SAVED_NOTE_MAX = 2000;

/** Saved items in one page, unless the caller asks for fewer. */
export const SAVED_ITEMS_PAGE_SIZE = 25;

/** The most one list returns. */
export const SAVED_ITEMS_MAX = 100;

export type SavedSort = "used" | "saved" | "changed" | "name";

/* ── snapshots ── */

type Payload = Record<string, unknown>;

/** Where a saved item came from. Ids and names a reader can already see on the source; never a cost or a trace. */
export interface SnapshotSource {
  buildId: string;
  buildTitle: string | null;
  /** For the link back to the source. */
  buildSlug: string | null;
  /** The profile that made the work: the tile's contributor (SV-16), else the build's maker. */
  makerId: string | null;
  nodeId?: string;
  tool?: string | null;
  date?: string | null;
}

export interface StepSnapshot {
  type: string;
  title: string | null;
  note: string | null;
  /** The method, as forkRules.methodOf copies it. */
  payload: Payload;
  source: SnapshotSource;
}

export interface PartSnapshot extends StepSnapshot {
  /** The part's own tiles, nested, each as a step is stored. Their ids are the source's, so a pointer between them can be rewritten. */
  children: PartChild[];
}

export interface PartChild {
  id: string;
  type: string;
  title: string | null;
  note: string | null;
  payload: Payload;
  children: PartChild[];
}

export interface SessionSnapshot {
  title: string | null;
  model: string | null;
  /** The prompts in order: their text, nothing else. */
  prompts: { text: string }[];
  source: SnapshotSource;
}

export interface RequestSnapshot {
  bountyId: string;
  status: string;
  rewardGbp: number | null;
  /** The step the request asks to have filled, as a step is stored; null when the request has none. */
  gap: { type: string; title: string | null; payload: Payload } | null;
  source: SnapshotSource | null;
}

const asPayload = (value: unknown): Payload => (value && typeof value === "object" && !Array.isArray(value) ? (value as Payload) : {});

const sourceOf = (build: Pick<Build, "id" | "title" | "slug" | "creator_id">, node?: Pick<NodeTree, "id"> & { contributor_id?: string | null }): SnapshotSource => ({
  buildId: build.id,
  buildTitle: build.title ?? null,
  buildSlug: build.slug ?? null,
  makerId: node?.contributor_id ?? build.creator_id ?? null,
  ...(node ? { nodeId: node.id } : null),
});

export function stepSnapshot(node: Pick<NodeTree, "id" | "type" | "title" | "note" | "payload"> & { contributor_id?: string | null }, build: Pick<Build, "id" | "title" | "slug" | "creator_id">): StepSnapshot {
  return { type: node.type, title: node.title ?? null, note: node.note ?? null, payload: methodOf(asPayload(node.payload)), source: sourceOf(build, node) };
}

const childOf = (node: NodeTree): PartChild => ({
  id: node.id,
  type: node.type,
  title: node.title ?? null,
  note: node.note ?? null,
  payload: methodOf(asPayload(node.payload)),
  children: (node.children ?? []).map(childOf),
});

export function partSnapshot(node: NodeTree, build: Pick<Build, "id" | "title" | "slug" | "creator_id">): PartSnapshot {
  return { ...stepSnapshot(node, build), children: (node.children ?? []).map(childOf) };
}

/** The top-level prompt tiles of one session: those that name it by `payload.session` or `source_ref.import_session_id`. */
export function sessionSnapshot(tree: readonly NodeTree[], sessionKey: string, build: Pick<Build, "id" | "title" | "slug" | "creator_id" | "making">): SessionSnapshot {
  const tiles = tree.filter((node) => {
    const ref = asPayload(node.source_ref);
    return node.type === "prompt" && (asPayload(node.payload).session === sessionKey || ref.import_session_id === sessionKey);
  });
  const prompts = tiles.map((node) => ({ text: String(asPayload(node.payload).text ?? "") })).filter((prompt) => prompt.text.trim());
  const model = tiles.map((node) => asPayload(node.payload).model).find((value): value is string => typeof value === "string" && value.length > 0) ?? null;
  const meta = sessionsMetaOf(build.making)[sessionKey];
  return {
    title: meta?.title?.trim() || null,
    model,
    prompts,
    source: { ...sourceOf(build), makerId: meta?.contributor_id ?? build.creator_id ?? null, tool: meta?.tool ?? null, date: meta?.date || null },
  };
}

const findNode = (tree: readonly NodeTree[], id: string): NodeTree | null => {
  for (const node of tree) {
    if (node.id === id) return node;
    const inside = findNode(node.children ?? [], id);
    if (inside) return inside;
  }
  return null;
};

/* ── rows ── */

export interface LibrarySavedItem {
  id: string;
  kind: SavedKind;
  buildId: string | null;
  ref: string | null;
  snapshot: Payload;
  sourceVersion: string | null;
  note: string | null;
  savedAt: string;
  lastUsedAt: string;
}

interface SavedItemRow {
  id: string;
  kind: SavedKind;
  build_id: string | null;
  ref: string | null;
  snapshot: Json;
  source_version: string | null;
  note: string | null;
  created_at: string;
  last_used_at: string;
}

const SAVED_COLUMNS = "id, kind, build_id, ref, snapshot, source_version, note, created_at, last_used_at";

const toItem = (row: SavedItemRow): LibrarySavedItem => ({
  id: row.id,
  kind: row.kind,
  buildId: row.build_id,
  ref: row.ref,
  snapshot: asPayload(row.snapshot),
  sourceVersion: row.source_version,
  note: row.note,
  savedAt: row.created_at,
  lastUsedAt: row.last_used_at,
});

/* ── save ── */

export interface SaveItemInput {
  kind: SavedKind;
  /** The build the item is in. Required for a part, a session and a step. */
  buildId?: string | null;
  /** A tile id (part, step), a session key, a bounty id, a collection id, or a filter set's id. */
  ref?: string | null;
  /** Given for a filter set and a collection, whose content is the caller's; read from the source for the rest. */
  snapshot?: Payload;
}

const invalid = (operation: string, ids: { buildId?: string | null; nodeId?: string | null }) => new SocialError(operation, "invalid", ids);

/** The published build an item is in, or an error: a build the reader can't read and a draft are both refused. */
async function readableBuild(buildId: string | null | undefined): Promise<Build> {
  if (!buildId) throw invalid("saveItem", {});
  const build = await getBuildHeader(buildId);
  if (!build) throw new SocialError("saveItem", "no_access", { buildId });
  if (build.status === "draft") throw invalid("saveItem", { buildId });
  return build;
}

async function snapshotFor(input: SaveItemInput): Promise<{ buildId: string | null; snapshot: Payload }> {
  const ref = input.ref ?? null;
  switch (input.kind) {
    case "step":
    case "part": {
      if (!ref) throw invalid("saveItem", { buildId: input.buildId });
      const build = await readableBuild(input.buildId);
      const node = findNode(await getNodeTree(build.id), ref);
      if (!node) throw invalid("saveItem", { buildId: build.id, nodeId: ref });
      return { buildId: build.id, snapshot: (input.kind === "step" ? stepSnapshot(node, build) : partSnapshot(node, build)) as unknown as Payload };
    }
    case "session": {
      if (!ref) throw invalid("saveItem", { buildId: input.buildId });
      const build = await readableBuild(input.buildId);
      const snapshot = sessionSnapshot(await getNodeTree(build.id), ref, build);
      if (snapshot.prompts.length === 0) throw invalid("saveItem", { buildId: build.id });
      return { buildId: build.id, snapshot: snapshot as unknown as Payload };
    }
    case "request": {
      if (!ref) throw invalid("saveItem", {});
      const response = await db.from("bounties").select("id, build_id, gap_node_id, status, reward_gbp").eq("id", ref).limit(1).maybeSingle();
      if (response.error) throw socialError("saveItem", response);
      const bounty = response.data as { id: string; build_id: string | null; gap_node_id: string | null; status: string; reward_gbp: number | null } | null;
      if (!bounty) throw new SocialError("saveItem", "no_access");
      const build = bounty.build_id ? await readableBuild(bounty.build_id) : null;
      const gap = build && bounty.gap_node_id ? findNode(await getNodeTree(build.id), bounty.gap_node_id) : null;
      const snapshot: RequestSnapshot = {
        bountyId: bounty.id,
        status: bounty.status,
        rewardGbp: bounty.reward_gbp,
        gap: gap ? { type: gap.type, title: gap.title ?? null, payload: methodOf(asPayload(gap.payload)) } : null,
        source: build ? sourceOf(build) : null,
      };
      return { buildId: build?.id ?? null, snapshot: snapshot as unknown as Payload };
    }
    case "filter_set":
    case "collection":
      if (!ref) throw invalid("saveItem", {});
      return { buildId: null, snapshot: input.snapshot ?? {} };
  }
}

const SOURCE_KINDS: ReadonlySet<SavedKind> = new Set<SavedKind>(["step", "part", "session"]);

/** A saved item's snapshot made again from its source as it is now (SV-19): what Add from Library inserts as the current version. */
export async function currentSnapshotOf(item: Pick<LibrarySavedItem, "kind" | "buildId" | "ref">): Promise<Payload> {
  return (await snapshotFor({ kind: item.kind, buildId: item.buildId, ref: item.ref })).snapshot;
}

/** Keep an item as the signed-in reader. Keeping it twice is not an error. */
export async function saveItem(input: SaveItemInput): Promise<void> {
  const ids = { buildId: input.buildId ?? null };
  const userId = await currentUserId();
  if (!userId) throw signedOutError("saveItem", ids);
  if (!SAVED_KINDS.includes(input.kind)) throw invalid("saveItem", ids);

  const { buildId, snapshot } = await snapshotFor(input);
  // SV-19: the source's version now, so a later edit reads as Edited. Best effort: without it the item reads as unchanged.
  const sourceVersion = buildId && SOURCE_KINDS.has(input.kind) ? await versionNow(input.kind, input.ref ?? null, buildId).catch(() => null) : null;
  const response = await db.from("saved_items").insert({
    user_id: userId,
    kind: input.kind,
    build_id: buildId,
    ref: input.ref ?? null,
    snapshot,
    source_version: sourceVersion,
  });
  if (response.error && !isDuplicate(response.error)) throw socialError("saveItem", response, { buildId });
}

/** Remove one of the reader's saved items. Removing one that is not there is not an error. */
export async function unsaveItem(savedItemId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("unsaveItem");
  const response = await db.from("saved_items").delete().eq("id", savedItemId).eq("user_id", userId);
  if (response.error) throw socialError("unsaveItem", response);
}

/** Change the reader's note on a saved item. An overlong note is refused before any request; an empty one clears it. */
export async function updateSavedItemNote(savedItemId: string, note: string): Promise<void> {
  const text = note.trim();
  if ([...text].length > SAVED_NOTE_MAX) throw new SocialError("updateSavedItemNote", "invalid");
  const userId = await currentUserId();
  if (!userId) throw signedOutError("updateSavedItemNote");
  const response = await db.from("saved_items").update({ note: text || null }).eq("id", savedItemId).eq("user_id", userId);
  if (response.error) throw socialError("updateSavedItemNote", response);
}

/** Turn notifications on or off for a saved item (SV-20). Only the reader's own row; the database does the notifying. */
export async function setSavedItemNotify(savedItemId: string, on: boolean): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("setSavedItemNotify");
  const response = await db.from("saved_items").update({ notify: on }).eq("id", savedItemId).eq("user_id", userId);
  if (response.error) throw socialError("setSavedItemNotify", response);
}

/* ── read ── */

export interface ListSavedItemsOptions {
  kind?: SavedKind;
  sort?: SavedSort;
  limit?: number;
  /** The `next` of the page before. */
  after?: string | null;
}

export interface SavedItemsPage {
  items: LibrarySavedItem[];
  /** Pass as `after` for the next page, or null at the end. */
  next: string | null;
}

/** Each sort's column. "changed" puts the items whose source has a newer version first; SV-19 is what fills source_version. */
const ORDER: Record<SavedSort, { column: string; ascending: boolean }> = {
  used: { column: "last_used_at", ascending: false },
  saved: { column: "created_at", ascending: false },
  changed: { column: "source_version", ascending: false },
  name: { column: "snapshot->>title", ascending: true },
};

/** The signed-in reader's saved items of one kind (all kinds when none is given), one request. */
export async function listSavedItems(options: ListSavedItemsOptions = {}): Promise<SavedItemsPage> {
  const limit = Math.max(1, Math.min(options.limit ?? SAVED_ITEMS_PAGE_SIZE, SAVED_ITEMS_MAX));
  const from = Math.max(0, Number.parseInt(options.after ?? "0", 10) || 0);
  const userId = await currentUserId();
  if (!userId) throw signedOutError("listSavedItems");

  const order = ORDER[options.sort ?? "used"];
  let query = db.from("saved_items").select(SAVED_COLUMNS).eq("user_id", userId);
  if (options.kind) query = query.eq("kind", options.kind);
  query = query.order(order.column, { ascending: order.ascending, nullsFirst: false });
  if (order.column !== "last_used_at") query = query.order("last_used_at", { ascending: false });
  const response = await query.range(from, from + limit - 1);
  if (response.error) throw socialError("listSavedItems", response);

  const rows = (response.data ?? []) as SavedItemRow[];
  return { items: rows.map(toItem), next: rows.length < limit ? null : String(from + rows.length) };
}

export type SavedCounts = Record<SavedKind, number>;

/** How many of each kind the reader has kept, in one request. Builds are counted from build_saves, not here. */
export async function countSavedItems(): Promise<SavedCounts> {
  const counts = Object.fromEntries(SAVED_KINDS.map((kind) => [kind, 0])) as SavedCounts;
  const userId = await currentUserId();
  if (!userId) return counts;
  const response = await db.from("saved_items").select("kind").eq("user_id", userId).limit(1000);
  if (response.error) throw socialError("countSavedItems", response);
  for (const row of (response.data ?? []) as { kind: SavedKind }[]) if (row.kind in counts) counts[row.kind] += 1;
  return counts;
}

/** For each saved part, step and session, the number of builds with a tile that came from it. One request. */
export async function savedItemsUsedIn(): Promise<Map<string, number>> {
  const userId = await currentUserId();
  if (!userId) return new Map();
  const response = await db.rpc("saved_items_used_in");
  if (response.error) throw socialError("savedItemsUsedIn", response);
  return new Map(((response.data ?? []) as { saved_item_id: string; builds: number }[]).map((row) => [row.saved_item_id, Number(row.builds)]));
}

/** For each of these collections that is public, how many other readers kept it. One request; none for no ids. */
export async function collectionSavedBy(collectionIds: readonly string[]): Promise<Map<string, number>> {
  const ids = uniqueIds(collectionIds);
  if (ids.length === 0) return new Map();
  const response = await db.rpc("collection_saved_by_count", { _collection_ids: ids });
  if (response.error) throw socialError("collectionSavedBy", response);
  return new Map(((response.data ?? []) as { collection_id: string; saved_by: number }[]).map((row) => [row.collection_id, Number(row.saved_by)]));
}

/* ── for Add from Library (SV-18) ── */

/** The handles (no @) of these profiles, for "@maya" on a saved item. One request; none for no ids. A profile with no handle is absent. */
export async function makerHandles(profileIds: readonly string[]): Promise<Map<string, string>> {
  const ids = uniqueIds(profileIds);
  if (ids.length === 0) return new Map();
  const response = await db.from("profiles").select("id, username").in("id", ids).limit(ids.length);
  if (response.error) throw socialError("makerHandles", response);
  return new Map(((response.data ?? []) as { id: string; username: string | null }[]).flatMap((row) => (row.username ? [[row.id, row.username] as const] : [])));
}

/** For each of these collections, the ids of the reader's saved items in it, in the collection's order. One request; none for no ids. */
export async function collectionSavedItemIds(collectionIds: readonly string[]): Promise<Map<string, string[]>> {
  const ids = uniqueIds(collectionIds);
  const out = new Map<string, string[]>();
  if (ids.length === 0) return out;
  const response = await db
    .from("collection_items")
    .select("collection_id, saved_item_id, position")
    .in("collection_id", ids)
    .not("saved_item_id", "is", null)
    .order("position", { ascending: true, nullsFirst: false })
    .limit(SAVED_ITEMS_MAX * 10);
  if (response.error) throw socialError("collectionSavedItemIds", response);
  for (const row of (response.data ?? []) as { collection_id: string; saved_item_id: string }[]) out.set(row.collection_id, [...(out.get(row.collection_id) ?? []), row.saved_item_id]);
  return out;
}

/** These saved items of the signed-in reader, in the order of `ids`. One request; ids that are not the reader's are absent. */
export async function savedItemsByIds(savedItemIds: readonly string[]): Promise<LibrarySavedItem[]> {
  const ids = uniqueIds(savedItemIds);
  if (ids.length === 0) return [];
  const userId = await currentUserId();
  if (!userId) throw signedOutError("savedItemsByIds");
  const response = await db.from("saved_items").select(SAVED_COLUMNS).eq("user_id", userId).in("id", ids).limit(ids.length);
  if (response.error) throw socialError("savedItemsByIds", response);
  const found = new Map(((response.data ?? []) as SavedItemRow[]).map((row) => [row.id, toItem(row)]));
  return savedItemIds.flatMap((id) => {
    const item = found.get(id);
    return item ? [item] : [];
  });
}

/** The reader used these saved items just now: their "last used" moves to the present, so Library lists them first. Best effort; the caller ignores a failure. */
export async function touchSavedItems(savedItemIds: readonly string[]): Promise<void> {
  const ids = uniqueIds(savedItemIds);
  if (ids.length === 0) return;
  const userId = await currentUserId();
  if (!userId) return;
  const response = await db.from("saved_items").update({ last_used_at: new Date().toISOString() }).eq("user_id", userId).in("id", ids);
  if (response.error) throw socialError("touchSavedItems", response);
}

/* ── for the build page (SV-25) ── */

/** What the signed-in reader has kept in one build: `kind:ref` -> the saved item's id. One request; empty when signed out. */
export async function savedInBuild(buildId: string): Promise<Map<string, string>> {
  const userId = await currentUserId();
  if (!userId) return new Map();
  const response = await db.from("saved_items").select("id, kind, ref").eq("user_id", userId).eq("build_id", buildId).in("kind", ["part", "step", "session"]).limit(SAVED_ITEMS_MAX * 5);
  if (response.error) throw socialError("savedInBuild", response, { buildId });
  return new Map(((response.data ?? []) as { id: string; kind: SavedKind; ref: string | null }[]).flatMap((row) => (row.ref ? [[`${row.kind}:${row.ref}`, row.id] as const] : [])));
}
