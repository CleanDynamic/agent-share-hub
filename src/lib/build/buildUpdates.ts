// SV-27 P2 and P12: a published build's changelog (`build_updates`): a short dated note a maker adds when they publish again.
//
// Not `build_events`, which is the public making timeline. Anyone reads the notes of a published build; the maker adds and
// deletes their own; nobody edits one. No notification is written here (SV-20's notifications come from database triggers).
//
// THE TABLE MAY NOT BE THERE YET (SV-27's migration). A read answers `{ available: false }` when the error's code says the table
// is missing (42P01, PGRST205; codes only, never the message), and the field and the list stay hidden. Errors carry identifiers
// only (SocialError), never the note's words.

import { SocialError, db, signedOutError, socialError, currentUserId } from "@/lib/social/types";

export const UPDATE_NOTE_MAX = 200;
/** The build page lists at most this many, then "Show all n". */
export const UPDATES_SHOWN = 20;
/** One more than shown, so the page knows there are more without counting. */
export const UPDATES_READ = UPDATES_SHOWN + 1;
/** The most "Show all" reads. */
export const UPDATES_ALL_LIMIT = 200;

const MISSING = new Set(["42P01", "PGRST205"]);
export const isMissingUpdates = (error: unknown): boolean => MISSING.has(String((error as { code?: unknown } | null)?.code));

export interface BuildUpdate {
  id: string;
  note: string;
  createdAt: string;
}

export interface BuildUpdates {
  /** False while the table is missing: the changelog field and list are hidden. */
  available: boolean;
  updates: BuildUpdate[];
  /** More than `UPDATES_SHOWN` exist. */
  more: boolean;
}

const COLUMNS = "id, note, created_at";

interface Row {
  id: string;
  note: string;
  created_at: string;
}

/** A note as it is kept: one line, trimmed, at most 200 characters. Empty means no note, so no row. */
export const cleanUpdateNote = (raw: string | null | undefined): string => (raw ?? "").replace(/\s+/g, " ").trim().slice(0, UPDATE_NOTE_MAX);

/** The newest notes of a build, newest first. */
export async function listBuildUpdates(buildId: string, limit: number = UPDATES_READ): Promise<BuildUpdates> {
  const response = await db.from("build_updates").select(COLUMNS).eq("build_id", buildId).order("created_at", { ascending: false }).limit(Math.min(limit, UPDATES_ALL_LIMIT));
  if (response.error) {
    if (isMissingUpdates(response.error)) return { available: false, updates: [], more: false };
    throw socialError("listBuildUpdates", response, { buildId });
  }
  const rows = (response.data ?? []) as Row[];
  const shown = limit === UPDATES_READ ? rows.slice(0, UPDATES_SHOWN) : rows;
  return { available: true, updates: shown.map((row) => ({ id: row.id, note: row.note, createdAt: row.created_at })), more: limit === UPDATES_READ && rows.length > UPDATES_SHOWN };
}

/** Whether the table is there: one cheap read, used by the publish window to decide whether to show What changed?. */
export async function buildUpdatesAvailable(): Promise<boolean> {
  const response = await db.from("build_updates").select("id", { head: true, count: "planned" }).limit(1);
  return !response.error;
}

/** Writes one note with a publish. No note, no row: answers null. */
export async function addBuildUpdate(buildId: string, raw: string | null | undefined): Promise<BuildUpdate | null> {
  const note = cleanUpdateNote(raw);
  if (!note) return null;
  const userId = await currentUserId();
  if (!userId) throw signedOutError("addBuildUpdate");
  const response = await db.from("build_updates").insert({ build_id: buildId, note }).select(COLUMNS).single();
  if (response.error || !response.data) {
    if (response.error && isMissingUpdates(response.error)) return null;
    throw socialError("addBuildUpdate", response, { buildId });
  }
  const row = response.data as Row;
  return { id: row.id, note: row.note, createdAt: row.created_at };
}

/** The maker removes one of their notes (the policy refuses anyone else). */
export async function deleteBuildUpdate(id: string): Promise<void> {
  if (!id) throw new SocialError("deleteBuildUpdate", "invalid");
  const response = await db.from("build_updates").delete().eq("id", id);
  if (response.error) throw socialError("deleteBuildUpdate", response);
}
