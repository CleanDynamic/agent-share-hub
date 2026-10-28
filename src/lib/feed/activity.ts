// SV-15: what others did with the reader's builds and saves, in one function.
//
// Home's "Since you were last here", Library's changes and (from SV-20) notifications all read `listActivityFor`, so
// the three never disagree. Four kinds, newest first:
//   run      a reproduction by someone else of a build the reader made or saved
//   rebuild  a published build whose parent is one the reader made or saved
//   answer   a solution, by someone else, on a request the reader opened
//   stale    a build the reader made or saved that passed STALE_AFTER_DAYS since `since`
// and, with `savedOnly` (the Library's changes), two about the reader's SAVED ITEMS below build size (SV-19):
//   edited   a saved step, part or session whose source changed after `since` and after it was saved
//   removed  a saved step, part or session whose source can no longer be read. Nothing records WHEN it went, so it is dated
//            at the read: it stays in the list for as long as it is true, and Home (which does not pass `savedOnly`) never sees it.
// (An answer on a request the reader SAVED waits for SV-17's saved requests.)
//
// THREE HOPS, each a set of parallel reads ⟦async-parallel⟧:
//   1. what the reader owns: their builds, their saved builds, their requests
//   2. what others did to those, one query per kind, on the ids from hop 1
//   3. the handles of the people in hop 2, one read
// `stale` costs no read: it is worked out from hop 1's rows with `isStale`.
//
// THE INDEXES each read relies on:
//   builds by creator            idx_builds_creator_status_updated (SV-03)
//   build_saves by user          idx_build_saves_user_created
//   bounties by author           idx_bounties_author (already live; SV-15's migration adds idx_bounties_author_created only
//                                where no index leads with author_id)
//   reproductions by build       idx_build_reproductions_build_confirmed
//   rebuilds by parent           idx_builds_parent_build
//   solutions by bounty          idx_solutions_bounty_slot_status
// Private by design: every read is about the reader's own builds and saves, and RLS decides what they may see.

import { STALE_AFTER_DAYS, isStale } from "@/lib/build/signals";
import type { SavedKind } from "@/lib/library/savedItems";
import { listSourceStates, type SourceItem, type SourceStatus } from "@/lib/library/sourceVersions";
import { db } from "@/lib/social/types";

export type ActivityKind = "run" | "rebuild" | "answer" | "stale" | "edited" | "removed";

/** Whose build it is to the reader: they made it, or they saved it. */
export type ActivityRole = "maker" | "saver";

export interface ActivityPerson {
  id: string;
  /** Without the @; null when the profile has none. */
  handle: string | null;
  name: string;
}

interface ActivityBase {
  /** Unique across kinds: the kind and the row it came from. */
  id: string;
  /** When it happened, ISO. */
  at: string;
  /** The reader's build it is about, for the link to the canonical page. */
  buildId: string;
  buildSlug: string;
  buildTitle: string;
  role: ActivityRole;
}

export interface RunActivity extends ActivityBase {
  kind: "run";
  runner: ActivityPerson;
  worked: boolean;
  model: string | null;
  note: string | null;
}

export interface RebuildActivity extends ActivityBase {
  kind: "rebuild";
  /** The rebuild itself. */
  rebuildId: string;
  rebuildSlug: string;
  rebuildTitle: string;
  rebuilder: ActivityPerson;
}

export interface AnswerActivity extends ActivityBase {
  kind: "answer";
  bountyId: string;
  solutionId: string;
  solver: ActivityPerson;
}

export interface StaleActivity extends ActivityBase {
  kind: "stale";
}

/** A saved item whose source was edited or went away. The build fields are the snapshot's own (empty where the snapshot has none). */
export interface SavedItemActivity extends ActivityBase {
  kind: "edited" | "removed";
  item: { id: string; kind: SavedKind; snapshot: Record<string, unknown> };
}

export type ActivityEvent = RunActivity | RebuildActivity | AnswerActivity | StaleActivity | SavedItemActivity;

export interface ListActivityArgs {
  userId: string;
  /** The start of the window: an ISO string or a time in ms. Events at or before it are not returned. */
  since: string | number;
  limit?: number;
  /** Only the events on builds the reader saved: their own builds and requests are not read. The Library's changes. */
  savedOnly?: boolean;
}

/** Each read is capped; the reader's own builds and saves are few, and the events on them are cut to `limit` at the end. */
const OWN_LIMIT = 200;
const EVENT_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const MS_PER_DAY = 86_400_000;

const BUILD_COLUMNS = "id, slug, title, creator_id, status, last_confirmed_at, published_at";

interface OwnedBuild {
  id: string;
  slug: string;
  title: string;
  creator_id: string;
  status: string | null;
  last_confirmed_at: string | null;
  published_at: string | null;
}

interface ReproRow {
  id: string;
  build_id: string;
  user_id: string;
  confirmed_at: string;
  model_used: string | null;
  worked: boolean;
  note: string | null;
}

interface RebuildRow {
  id: string;
  slug: string;
  title: string;
  creator_id: string;
  parent_build_id: string | null;
  published_at: string | null;
}

interface SolutionRow {
  id: string;
  bounty_id: string;
  solver_id: string;
  submitted_at: string | null;
}

interface SavedItemRow extends SourceItem {
  snapshot: Record<string, unknown>;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
}

const NONE = { data: [], error: null };

const toMs = (since: string | number): number => (typeof since === "number" ? since : Date.parse(since));

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/** A read that failed throws, so the section can say so; the three kinds never half-answer. */
function rows<T>(response: { data: unknown; error: unknown }): T[] {
  if (response.error) throw response.error;
  return (response.data ?? []) as T[];
}

export async function listActivityFor({ userId, since, limit = DEFAULT_LIMIT, savedOnly = false }: ListActivityArgs): Promise<ActivityEvent[]> {
  const sinceMs = toMs(since);
  const sinceIso = new Date(sinceMs).toISOString();
  const now = Date.now();

  /* ── hop 1: what the reader owns ── */
  const [mine, saves, bounties, kept] = await Promise.all([
    savedOnly ? NONE : db.from("builds").select(BUILD_COLUMNS).eq("creator_id", userId).neq("status", "draft").limit(OWN_LIMIT),
    db
      .from("build_saves")
      .select(`build:builds!build_saves_build_id_fkey(${BUILD_COLUMNS})`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(OWN_LIMIT),
    savedOnly ? NONE : db.from("bounties").select("id, build_id").eq("author_id", userId).limit(OWN_LIMIT),
    savedOnly
      ? db.from("saved_items").select("id, kind, build_id, ref, snapshot, source_version").eq("user_id", userId).in("kind", ["step", "part", "session"]).limit(OWN_LIMIT)
      : NONE,
  ]);

  // A build the reader both made and saved is theirs as its maker, so savedOnly leaves it out. Keyed by id ⟦js-set-map-lookups⟧.
  const owned = new Map<string, { build: OwnedBuild; role: ActivityRole }>();
  for (const build of rows<OwnedBuild>(mine)) owned.set(build.id, { build, role: "maker" });
  for (const save of rows<{ build: OwnedBuild | OwnedBuild[] | null }>(saves)) {
    const build = first(save.build);
    if (build && !owned.has(build.id) && build.creator_id !== userId) owned.set(build.id, { build, role: "saver" });
  }
  const bountyRows = rows<{ id: string; build_id: string | null }>(bounties);
  const buildIds = [...owned.keys()];
  const bountyIds = bountyRows.map((row) => row.id);
  const buildOfBounty = new Map(bountyRows.map((row) => [row.id, row.build_id]));

  /* ── hop 2: what others did to them, one query per kind ── */
  const keptRows = rows<{ id: string; kind: SavedKind; build_id: string | null; ref: string | null; snapshot: Record<string, unknown> | null; source_version: string | null }>(kept).map(
    (row): SavedItemRow => ({ id: row.id, kind: row.kind, buildId: row.build_id, ref: row.ref, snapshot: row.snapshot ?? {}, sourceVersion: row.source_version }),
  );
  const [runs, rebuilds, answers, sources] = await Promise.all([
    buildIds.length === 0
      ? NONE
      : db
          .from("build_reproductions")
          .select("id, build_id, user_id, confirmed_at, model_used, worked, note")
          .in("build_id", buildIds)
          .neq("user_id", userId)
          .gt("confirmed_at", sinceIso)
          .order("confirmed_at", { ascending: false })
          .limit(EVENT_LIMIT),
    buildIds.length === 0
      ? NONE
      : db
          .from("builds")
          .select("id, slug, title, creator_id, parent_build_id, published_at")
          .in("parent_build_id", buildIds)
          .neq("creator_id", userId)
          .in("status", ["published", "gallery"])
          .gt("published_at", sinceIso)
          .order("published_at", { ascending: false })
          .limit(EVENT_LIMIT),
    bountyIds.length === 0
      ? NONE
      : db
          .from("solutions")
          .select("id, bounty_id, solver_id, submitted_at")
          .in("bounty_id", bountyIds)
          .neq("solver_id", userId)
          .gt("submitted_at", sinceIso)
          .order("submitted_at", { ascending: false })
          .limit(EVENT_LIMIT),
    keptRows.length === 0 ? new Map<string, SourceStatus>() : listSourceStates(keptRows),
  ]);
  const runRows = rows<ReproRow>(runs);
  const rebuildRows = rows<RebuildRow>(rebuilds);
  const solutionRows = rows<SolutionRow>(answers);

  /* ── hop 3: the people ── */
  const personIds = [...new Set([...runRows.map((r) => r.user_id), ...rebuildRows.map((r) => r.creator_id), ...solutionRows.map((r) => r.solver_id)])];
  const people = new Map<string, ActivityPerson>();
  if (personIds.length > 0) {
    for (const profile of rows<ProfileRow>(await db.from("profiles").select("id, username, display_name").in("id", personIds).limit(personIds.length))) {
      people.set(profile.id, { id: profile.id, handle: profile.username, name: profile.display_name?.trim() || profile.username || "Someone" });
    }
  }
  const person = (id: string): ActivityPerson => people.get(id) ?? { id, handle: null, name: "Someone" };

  /* ── the events, merged and de-duplicated by id ── */
  const events = new Map<string, ActivityEvent>();
  const about = (buildId: string) => {
    const entry = owned.get(buildId);
    return entry ? { buildId, buildSlug: entry.build.slug, buildTitle: entry.build.title, role: entry.role } : null;
  };

  for (const run of runRows) {
    const base = about(run.build_id);
    if (!base) continue;
    events.set(`run:${run.id}`, { ...base, id: `run:${run.id}`, kind: "run", at: run.confirmed_at, runner: person(run.user_id), worked: run.worked, model: run.model_used, note: run.note?.trim() || null });
  }
  for (const rebuild of rebuildRows) {
    const base = rebuild.parent_build_id ? about(rebuild.parent_build_id) : null;
    if (!base || !rebuild.published_at) continue;
    events.set(`rebuild:${rebuild.id}`, { ...base, id: `rebuild:${rebuild.id}`, kind: "rebuild", at: rebuild.published_at, rebuildId: rebuild.id, rebuildSlug: rebuild.slug, rebuildTitle: rebuild.title, rebuilder: person(rebuild.creator_id) });
  }
  for (const solution of solutionRows) {
    const buildId = buildOfBounty.get(solution.bounty_id);
    const base = buildId ? about(buildId) : null;
    if (!base || !solution.submitted_at) continue;
    events.set(`answer:${solution.id}`, { ...base, id: `answer:${solution.id}`, kind: "answer", at: solution.submitted_at, bountyId: solution.bounty_id, solutionId: solution.id, solver: person(solution.solver_id) });
  }
  // Stale: fresh at `since`, stale now. It happened when the last confirmation (or the publication) turned STALE_AFTER_DAYS old.
  for (const [buildId, { build }] of owned) {
    if (isStale(build, sinceMs) || !isStale(build, now)) continue;
    const base = about(buildId);
    const from = build.last_confirmed_at ?? build.published_at;
    if (!base || !from) continue;
    events.set(`stale:${buildId}`, { ...base, id: `stale:${buildId}`, kind: "stale", at: new Date(Date.parse(from) + STALE_AFTER_DAYS * MS_PER_DAY).toISOString() });
  }

  // Saved items: the source's version is newer than both the item and the window, or the source is gone.
  for (const row of keptRows) {
    const status = sources.get(row.id);
    const source = (row.snapshot.source ?? {}) as { buildId?: string; buildSlug?: string | null; buildTitle?: string | null };
    const base = { buildId: row.buildId ?? source.buildId ?? "", buildSlug: source.buildSlug ?? "", buildTitle: source.buildTitle ?? "", role: "saver" as const, item: { id: row.id, kind: row.kind, snapshot: row.snapshot } };
    if (status?.state === "edited" && status.version && Date.parse(status.version) > sinceMs) events.set(`edited:${row.id}`, { ...base, id: `edited:${row.id}`, kind: "edited", at: status.version });
    else if (status?.state === "removed") events.set(`removed:${row.id}`, { ...base, id: `removed:${row.id}`, kind: "removed", at: new Date(now).toISOString() });
  }

  return [...events.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, Math.max(1, limit));
}
