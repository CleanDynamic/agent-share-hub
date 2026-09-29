// Collections that hold builds (RC-P18).
//
// A collection is a reader's own named group of builds: collection_items rows
// with item_kind 'build' and build_id set (20261001180000_rc_build_social.sql,
// which also refuses the same build twice in one collection). The Library's
// "Saved" tab is build_saves, so the legacy default collection ("Saved items",
// one per reader, made for legacy posts) is left out of every list here.
//
// ORDERED BY THE READER'S OWN LAST USE ⟦hicks-law › Remedies 6 Customise⟧:
// collections.updated_at, which every add, removal and rename below moves to
// now. Nothing here orders by anything the reader did not do.
//
// BATCHED ⟦neoscale-performance⟧. A list of collections is one request, its
// counts embedded; a page of a collection's builds is two, the items and then
// their builds in one `.in` (resolveBuildItems).
//
// ERRORS CARRY IDENTIFIERS ONLY ⟦neoscale-error-monitoring › Privacy⟧. A
// collection's name is text a reader wrote, and a refused write's details can
// quote it, so failures are SocialErrors: the operation, the ids, the code
// and the status, never the server's message (CONTRACT §9).

import type { GalleryBuild } from "@/lib/build/gallery";
import {
  SocialError,
  currentUserId,
  db,
  isDuplicate,
  signedOutError,
  socialError,
} from "@/lib/social/types";
import { resolveBuildItems } from "./resolveItems";

/** The longest name collections.title accepts. */
export const COLLECTION_NAME_MAX = 80;

/** Collections in one list, unless the caller asks for fewer. */
export const COLLECTIONS_PAGE_SIZE = 50;

/** Builds in one page of a collection, unless the caller asks for fewer. */
export const COLLECTION_BUILDS_PAGE_SIZE = 24;

export interface BuildCollection {
  id: string;
  ownerId: string;
  name: string;
  isPrivate: boolean;
  /** Items in it. After the clear every item is a build. */
  itemCount: number;
  /** The reader's last use of it: made, renamed, or given or relieved of a build. */
  lastUsedAt: string;
}

interface CollectionListRow {
  id: string;
  owner_id: string;
  title: string;
  is_public: boolean;
  updated_at: string;
  collection_items?: Array<{ count: number | null }> | { count: number | null } | null;
}

const COLLECTION_SELECT = "id, owner_id, title, is_public, updated_at, collection_items(count)";

function toCollection(row: CollectionListRow): BuildCollection {
  const embed = Array.isArray(row.collection_items) ? row.collection_items[0] : row.collection_items;
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.title,
    isPrivate: !row.is_public,
    itemCount: Number(embed?.count ?? 0),
    lastUsedAt: row.updated_at,
  };
}

export interface ListCollectionsOptions {
  /** Whose collections; the signed-in reader's when omitted. Another owner's are their public ones. */
  ownerId?: string;
  limit?: number;
}

/** A reader's collections, most recently used first, each with its count. One request. */
export async function listCollections(options: ListCollectionsOptions = {}): Promise<BuildCollection[]> {
  const limit = Math.max(1, Math.min(options.limit ?? COLLECTIONS_PAGE_SIZE, 100));
  const viewer = await currentUserId();
  const owner = options.ownerId ?? viewer;
  if (!owner) throw signedOutError("listCollections");

  let query = db
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("owner_id", owner)
    .eq("is_default", false)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (owner !== viewer) query = query.eq("is_public", true);

  const response = await query;
  if (response.error) throw socialError("listCollections", response);
  return ((response.data ?? []) as CollectionListRow[]).map(toCollection);
}

/** One collection, or null when the reader may not read it. One request. */
export async function getCollection(collectionId: string): Promise<BuildCollection | null> {
  const response = await db
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("id", collectionId)
    .limit(1)
    .maybeSingle();
  if (response.error) throw socialError("getCollection", response, { collectionId });
  return response.data ? toCollection(response.data as CollectionListRow) : null;
}

export interface CollectionBuild {
  /** When it went into the collection: the page's order and its cursor. */
  addedAt: string;
  build: GalleryBuild;
}

export interface CollectionBuildsPage {
  items: CollectionBuild[];
  /** The addedAt to pass as `before` for the next page, or null at the end. */
  nextBefore: string | null;
}

interface CollectionBuildRow {
  build_id: string;
  added_at: string;
}

/**
 * A collection's builds, newest addition first, keyset on added_at. Two
 * requests a page. A build the reader can no longer read is left out rather
 * than drawn as a hole; the cursor still moves past it.
 */
export async function listCollectionBuilds(
  collectionId: string,
  options: { limit?: number; before?: string } = {},
): Promise<CollectionBuildsPage> {
  const limit = Math.max(1, Math.min(options.limit ?? COLLECTION_BUILDS_PAGE_SIZE, 100));

  let query = db
    .from("collection_items")
    .select("build_id, added_at")
    .eq("collection_id", collectionId)
    .eq("item_kind", "build")
    .order("added_at", { ascending: false })
    .limit(limit);
  if (options.before) query = query.lt("added_at", options.before);

  const response = await query;
  if (response.error) throw socialError("listCollectionBuilds", response, { collectionId });

  const rows = (response.data ?? []) as CollectionBuildRow[];
  const nextBefore = rows.length < limit ? null : (rows[rows.length - 1]?.added_at ?? null);
  if (rows.length === 0) return { items: [], nextBefore };

  const builds = await resolveBuildItems(rows.map((row) => row.build_id));
  const items = rows.flatMap((row) => {
    const build = builds.get(row.build_id);
    return build ? [{ addedAt: row.added_at, build }] : [];
  });
  return { items, nextBefore };
}

/** Moves a collection to the top of its owner's lists. */
async function touch(operation: string, collectionId: string): Promise<void> {
  const response = await db
    .from("collections")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", collectionId);
  if (response.error) throw socialError(operation, response, { collectionId });
}

/**
 * Put a build in one of the reader's collections. Putting it there twice is
 * not an error: it is there, which is what was asked.
 */
export async function addBuildToCollection(collectionId: string, buildId: string): Promise<void> {
  const ids = { collectionId, buildId };
  const userId = await currentUserId();
  if (!userId) throw signedOutError("addBuildToCollection", ids);

  const last = await db
    .from("collection_items")
    .select("position")
    .eq("collection_id", collectionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last.error) throw socialError("addBuildToCollection", last, ids);
  const position = Number((last.data as { position?: number } | null)?.position ?? -1) + 1;

  const insert = await db.from("collection_items").insert({
    collection_id: collectionId,
    item_kind: "build",
    build_id: buildId,
    // item_id carries the build too, so the legacy readers that key on
    // item_id ?? content_id still find it; content_id is a legacy post's.
    item_id: buildId,
    content_id: null,
    added_by: userId,
    position,
  });
  if (insert.error && !isDuplicate(insert.error)) throw socialError("addBuildToCollection", insert, ids);

  await touch("addBuildToCollection", collectionId);
}

/** Take a build out of one of the reader's collections. Taking out one that is not there is not an error. */
export async function removeBuildFromCollection(collectionId: string, buildId: string): Promise<void> {
  const ids = { collectionId, buildId };
  const userId = await currentUserId();
  if (!userId) throw signedOutError("removeBuildFromCollection", ids);

  const response = await db
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("build_id", buildId);
  if (response.error) throw socialError("removeBuildFromCollection", response, ids);

  await touch("removeBuildFromCollection", collectionId);
}

/** The name as stored, or null when it is empty or longer than collections.title accepts. */
function cleanName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length === 0 || [...trimmed].length > COLLECTION_NAME_MAX ? null : trimmed;
}

/** Start a new private collection for the signed-in reader. An empty or overlong name is refused before any request. */
export async function startCollection(name: string): Promise<BuildCollection> {
  const title = cleanName(name);
  if (!title) throw new SocialError("startCollection", "invalid");
  const userId = await currentUserId();
  if (!userId) throw signedOutError("startCollection");

  const response = await db
    .from("collections")
    .insert({
      owner_id: userId,
      title,
      is_public: false,
      visibility: "private",
      is_default: false,
      accent_color: "var(--text2)",
    })
    .select("id, owner_id, title, is_public, updated_at")
    .single();
  if (response.error) throw socialError("startCollection", response);
  return toCollection({ ...(response.data as CollectionListRow), collection_items: [{ count: 0 }] });
}

/** Rename one of the reader's collections. An empty or overlong name is refused before any request. */
export async function renameCollection(collectionId: string, name: string): Promise<void> {
  const title = cleanName(name);
  if (!title) throw new SocialError("renameCollection", "invalid", { collectionId });
  const response = await db
    .from("collections")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", collectionId);
  if (response.error) throw socialError("renameCollection", response, { collectionId });
}

/** Delete one of the reader's collections. Its builds stay where they are; only the grouping goes. */
export async function deleteBuildCollection(collectionId: string): Promise<void> {
  const response = await db.from("collections").delete().eq("id", collectionId).eq("is_default", false);
  if (response.error) throw socialError("deleteBuildCollection", response, { collectionId });
}

export interface LibraryOwner {
  id: string;
  username: string | null;
  displayName: string | null;
}

/** Whose library /library/:handle is, or null when nobody has that handle. One request. */
export async function getLibraryOwner(handle: string): Promise<LibraryOwner | null> {
  const response = await db
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", handle)
    .limit(1)
    .maybeSingle();
  if (response.error) throw socialError("getLibraryOwner", response);
  const row = response.data as { id: string; username: string | null; display_name: string | null } | null;
  return row ? { id: row.id, username: row.username, displayName: row.display_name } : null;
}
