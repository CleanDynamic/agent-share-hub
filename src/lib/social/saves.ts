// Saving a build (RC-P15).
//
// A save is one build_saves row per (build, reader), and it is private: only
// the reader who saved reads it, and anon has no grant on the table at all
// (20261001180000_rc_build_social.sql). builds.save_count follows by trigger.
//
// THE LIBRARY'S "SAVED" LIST (RC-P18) reads listMySavedBuilds: newest save
// first, keyset on the save's created_at ⟦supabase-postgres-best-practices ›
// references/data-pagination.md⟧, each build as the gallery's own card reads
// it — gallerySelect(false) with withCardEmbeds, as where next reads its rows —
// so a saved build looks the same in the Library as in the Gallery. One
// request a page (SV-03 P5): the saves, each with its build embedded.

import { gallerySelect, toGalleryBuild, withCardEmbeds, type GalleryRow } from "@/lib/build/gallery";
import {
  SAVED_PAGE_SIZE,
  currentUserId,
  db,
  isDuplicate,
  signedOutError,
  socialError,
  uniqueIds,
  type ReactionRow,
  type SavedBuildsPage,
} from "./types";

/** Save a build as the signed-in reader. Saving twice is not an error. */
export async function saveBuild(buildId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("saveBuild", { buildId });

  const response = await db.from("build_saves").insert({ build_id: buildId, user_id: userId });
  if (response.error && !isDuplicate(response.error)) {
    throw socialError("saveBuild", response, { buildId });
  }
}

/** Remove the signed-in reader's save. Removing a save that is not there is not an error. */
export async function unsaveBuild(buildId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("unsaveBuild", { buildId });

  const response = await db.from("build_saves").delete().eq("build_id", buildId).eq("user_id", userId);
  if (response.error) throw socialError("unsaveBuild", response, { buildId });
}

/**
 * The ids, among these, of the builds the signed-in reader has saved. One
 * request for the whole list; none when signed out or given no ids.
 */
export async function getMySaves(buildIds: readonly string[]): Promise<Set<string>> {
  const ids = uniqueIds(buildIds);
  if (ids.length === 0) return new Set();

  const userId = await currentUserId();
  if (!userId) return new Set();

  const response = await db
    .from("build_saves")
    .select("build_id")
    .eq("user_id", userId)
    .in("build_id", ids)
    .limit(ids.length);
  if (response.error) throw socialError("getMySaves", response);

  return new Set(((response.data ?? []) as Pick<ReactionRow, "build_id">[]).map((row) => row.build_id));
}

export interface ListMySavedBuildsOptions {
  /** At most this many saves; defaults to SAVED_PAGE_SIZE. */
  limit?: number;
  /** Saves strictly older than this savedAt: the last item of the page held. */
  before?: string;
}

/**
 * The signed-in reader's saved builds, newest save first.
 *
 * A save whose build the reader can no longer read (returned to draft, or
 * hidden) is left out of the page rather than drawn as a hole; the cursor
 * still advances past it, because it is computed from the saves read.
 */
export async function listMySavedBuilds(options: ListMySavedBuildsOptions = {}): Promise<SavedBuildsPage> {
  const limit = Math.max(1, Math.min(options.limit ?? SAVED_PAGE_SIZE, 100));

  const userId = await currentUserId();
  if (!userId) throw signedOutError("listMySavedBuilds");

  // One request: each save with its build embedded through the foreign key (SV-03 P5), as the gallery's card reads it.
  let savesQuery = withCardEmbeds(
    db
      .from("build_saves")
      .select(`created_at, build:builds!build_saves_build_id_fkey(${gallerySelect(false)})`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    "build.",
  );
  if (options.before) savesQuery = savesQuery.lt("created_at", options.before);

  const saves = await savesQuery;
  if (saves.error) throw socialError("listMySavedBuilds", saves);

  const rows = (saves.data ?? []) as unknown as Array<{ created_at: string; build: GalleryRow | GalleryRow[] | null }>;
  const nextBefore = rows.length < limit ? null : (rows[rows.length - 1]?.created_at ?? null);

  const items = rows.flatMap((row) => {
    const build = Array.isArray(row.build) ? (row.build[0] ?? null) : row.build;
    return build ? [{ savedAt: row.created_at, build: toGalleryBuild(build) }] : [];
  });

  return { items, nextBefore };
}
