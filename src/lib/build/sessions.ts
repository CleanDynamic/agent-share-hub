// Sessions: the conversations a creator has sent, and may still use.
//
// A "session" is an import_sessions row the creator can still use: `parsed`
// (waiting, not yet in a build) or `claimed` (in one). The table is owner-only
// under RLS, so every read here is the signed-in creator's own without a filter
// saying so; a row someone else owns, or one that is gone, simply is not there.
//
// NOTHING FROM A CONVERSATION IS WRITTEN INTO A BUILD HERE. attachSession ties
// a session to a build and writes no events and no nodes. A session is
// verbatim, and copying its events across would put every turn in the public
// timeline. The maker picks prompts in the composer (UI-P48) and only those are
// ever published. A build made this way has an empty Watch it get built until
// they do.
//
// THE TABLE IS NEWER THAN THE GENERATED TYPES, and so is its `model` column, so
// the calls go through the one cast declared here, as imports.ts does.

import { supabase } from "@/integrations/supabase/client";
import { modelLabel } from "@/lib/models/registry";
import { addSessionToBuild } from "./addSession";
import { draftsOfImports, listBuildSessionRows } from "./buildSessions";
import { discardImport, loadImportProposal } from "./imports";
import type { TranscriptSourceRef } from "./intake";
import { refreshMakingStats } from "./making";
import { isSessionSummary } from "./summaryTurn";
import { buildLayerError } from "./types";

/** The characters of the first prompt a list keeps. */
const FIRST_PROMPT_MAX = 160;

/** The longest model text stored; the column's CHECK says the same. */
const MODEL_MAX = 64;

const DEFAULT_LIST_LIMIT = 50;

/** CA-12: a page of the composer's Your sessions. "Show more" reads the next. */
export const LIBRARY_PAGE = 100;

/** CA-12: the most imports that did not finish that Sources lists. */
const UNFINISHED_LIMIT = 50;

/** CA-12: the characters of a failed import's reason that are shown. */
const REASON_MAX = 120;

/** More sessions than one build can plausibly be made from. A ceiling, not a page. */
const BUILD_SESSIONS_LIMIT = 100;

const UNTITLED = "Untitled build";

const STATUS_PARSED = "parsed";
const STATUS_CLAIMED = "claimed";
const STATUS_EXPIRED = "expired";

export interface SessionSummary {
  id: string;
  /** claude | claude-code | chatgpt | cursor | web | unknown */
  client: string | null;
  /** As stored. */
  model: string | null;
  /** The draft the connector was told to aim at ("add this conversation to my … draft"). */
  targetBuildId: string | null;
  /** modelLabel(model); null when model is null. */
  modelName: string | null;
  firstPrompt: string | null;
  promptCount: number;
  turnCount: number;
  createdAt: string;
  buildId: string | null;
  /** parsed | claimed | expired, when the read asked for it (listLibrarySessions does). */
  status?: string | null;
  /** CA-12: the drafts this session is in (`build_sessions`, and the one an old claim named). Absent when the read did not ask. */
  draftIds?: string[];
  /** SV-07 P7: the hash of the transcript it was imported from (`content_hash`): the same chat imported twice has the same one. */
  contentHash?: string;
}

/** CA-12: an import that did not finish arriving, or did not parse. */
export interface UnfinishedSession {
  id: string;
  /** open | assembling | failed | duplicate */
  status: string;
  client: string | null;
  createdAt: string;
  /** One line: why it did not finish. Absent for one still arriving. */
  reason?: string;
}

export interface SessionPrompt {
  ordinal: number;
  text: string;
  sourceRef: TranscriptSourceRef;
}

export type AttachTarget = { kind: "new" } | { kind: "existing"; buildId: string };

/**
 * The select for the list, one literal, JSON-path aliases and all.
 *
 * `first_prompt` is event 0's text. A JSON path cannot select "the first event
 * whose kind is prompt", so this takes the first event. The parser writes one
 * event per user turn and each one is a prompt, so event 0 is the first prompt
 * for every proposal the readers produce today; if a reader ever emits another
 * kind first, this is the line to revisit.
 */
const SESSION_COLUMNS =
  "id, client, model, target_build_id, build_id, created_at, " +
  "first_prompt:proposal->events->0->payload->>text, " +
  "second_prompt:proposal->events->1->payload->>text, " +
  "user_turns:proposal->summary->user_turn_count, " +
  "assistant_turns:proposal->summary->assistant_turn_count, " +
  // SV-07 P7: the hash of the transcript it came from: two imports of one chat share it.
  "content_hash";

interface SessionRow {
  id: string;
  client: string | null;
  model?: string | null;
  target_build_id: string | null;
  build_id: string | null;
  created_at: string;
  first_prompt: unknown;
  /** SV-05 P3: event 1's text, for a session whose first turn is Claude Code's summary of an earlier one. */
  second_prompt?: unknown;
  user_turns: unknown;
  assistant_turns: unknown;
  status?: string | null;
  content_hash?: unknown;
}

interface StatusRow {
  id: string;
  status: string;
  build_id: string | null;
}

interface UpdatedRow {
  id: string;
  build_id: string | null;
}

/** A PostgREST builder described by hand: chainable, and awaited for its result. */
interface Query<Row> extends PromiseLike<{ data: Row[] | null; error: unknown }> {
  select: (columns: string) => Query<Row>;
  eq: (column: string, value: string) => Query<Row>;
  in: (column: string, values: string[]) => Query<Row>;
  not: (column: string, operator: string, value: null) => Query<Row>;
  order: (column: string, options: { ascending: boolean }) => Query<Row>;
  limit: (count: number) => Query<Row>;
  range: (from: number, to: number) => Query<Row>;
  maybeSingle: () => PromiseLike<{ data: Row | null; error: unknown }>;
}

interface SessionsTable {
  select: <Row>(columns: string) => Query<Row>;
  update: <Row>(patch: Record<string, unknown>) => Query<Row>;
}

function sessionsTable(): SessionsTable {
  return (supabase as unknown as { from: (table: string) => SessionsTable }).from("import_sessions");
}

/** SV-05 P3: the turn Claude Code opens a continued session with, its summary of the one before (SV-07 P7: now in `summaryTurn.ts`). */
export { isSessionSummary };

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toSummary(row: SessionRow): SessionSummary {
  const model = typeof row.model === "string" && row.model.trim() ? row.model : null;
  // SV-05 P3: a first turn that is Claude Code's summary of an earlier session does not name it: the next turn does.
  const opening = typeof row.first_prompt === "string" && isSessionSummary(row.first_prompt) ? row.second_prompt : row.first_prompt;
  const first = typeof opening === "string" ? opening.trim().slice(0, FIRST_PROMPT_MAX).trimEnd() : "";
  const user = asCount(row.user_turns);
  return {
    id: row.id,
    client: row.client ?? null,
    model,
    targetBuildId: row.target_build_id ?? null,
    modelName: model === null ? null : modelLabel(model),
    firstPrompt: first || null,
    promptCount: user,
    turnCount: user + asCount(row.assistant_turns),
    createdAt: row.created_at,
    buildId: row.build_id ?? null,
    ...(typeof row.status === "string" ? { status: row.status } : null),
    ...(typeof row.content_hash === "string" && row.content_hash ? { contentHash: row.content_hash } : null),
  };
}

// -----------------------------------------------------------------------------
// Reading
// -----------------------------------------------------------------------------

/** The signed-in creator's sessions, newest first. Claimed ones only on request. */
export async function listSessions({
  includeAttached = false,
  limit = DEFAULT_LIST_LIMIT,
}: { includeAttached?: boolean; limit?: number } = {}): Promise<SessionSummary[]> {
  const statuses = includeAttached ? [STATUS_PARSED, STATUS_CLAIMED] : [STATUS_PARSED];
  const { data, error } = await sessionsTable()
    .select<SessionRow>(SESSION_COLUMNS)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw buildLayerError("listSessions", error);
  return (data ?? []).map(toSummary);
}

/**
 * CA-12: every finished session the signed-in creator has sent, newest first, in pages of `LIBRARY_PAGE`. Nothing
 * finished is hidden: waiting (`parsed`), in a draft (`claimed`) and `expired` ones all come back, each with the drafts
 * it is in (`draftIds`). A session is the creator's, not a draft's, so this is not filtered by draft. Its prompts are
 * read from `proposal`, which no status change clears, so an expired session is as usable as the others. A row with no
 * proposal never finished parsing and is read by `listUnfinishedSessions` instead.
 *
 * One more row than the page is asked for, to say whether there is a next page: `hasMore`.
 */
export async function listLibrarySessions({ limit = LIBRARY_PAGE, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<{ sessions: SessionSummary[]; hasMore: boolean }> {
  const { data, error } = await sessionsTable()
    .select<SessionRow>(`${SESSION_COLUMNS}, status`)
    .in("status", [STATUS_PARSED, STATUS_CLAIMED, STATUS_EXPIRED])
    .not("proposal", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);
  if (error) throw buildLayerError("listLibrarySessions", error);
  const rows = data ?? [];
  const page = rows.slice(0, limit).map(toSummary);
  const drafts = await draftsOfImports(page.map((session) => session.id));
  const sessions = page.map((session) => {
    // An import claimed before CA-12 names its one draft on the row; the table holds it too once backfilled.
    const ids = new Set(drafts.get(session.id) ?? []);
    if (session.buildId) ids.add(session.buildId);
    return { ...session, draftIds: [...ids] };
  });
  return { sessions, hasMore: rows.length > limit };
}

/** CA-12: the line a failed or duplicate import is listed with. Never a stack: the first line, short. */
export function unfinishedReason(status: string, error: unknown): string | undefined {
  if (status === "duplicate") return "You had already sent this one.";
  if (status !== "failed") return undefined;
  const line = typeof error === "string" ? error.split("\n")[0].trim().slice(0, REASON_MAX).trimEnd() : "";
  return line || "It couldn't be read.";
}

/**
 * CA-12: the imports that are not sessions yet: still arriving (`open`, `assembling`) and the ones that did not finish
 * (`failed`, `duplicate`). Newest first.
 */
export async function listUnfinishedSessions({ limit = UNFINISHED_LIMIT }: { limit?: number } = {}): Promise<UnfinishedSession[]> {
  interface Row {
    id: string;
    status: string;
    client: string | null;
    created_at: string;
    error: unknown;
  }
  const { data, error } = await sessionsTable()
    .select<Row>("id, status, client, created_at, error")
    .in("status", ["open", "assembling", "failed", "duplicate"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw buildLayerError("listUnfinishedSessions", error);
  return (data ?? []).map((row) => {
    const reason = unfinishedReason(row.status, row.error);
    return { id: row.id, status: row.status, client: row.client ?? null, createdAt: row.created_at, ...(reason ? { reason } : null) };
  });
}

/**
 * The sessions a draft holds, in its order, so the composer can number them 1, 2, 3. A session is in a draft when
 * `build_sessions` says so, or, for a draft that has none of those rows yet, when the import was claimed into it
 * (the way every session was joined before CA-12). The table not being there is the second case alone.
 */
export async function listBuildSessions(buildId: string): Promise<SessionSummary[]> {
  const [linked, claimed] = await Promise.all([
    listBuildSessionRows(buildId),
    sessionsTable()
      .select<SessionRow>(SESSION_COLUMNS)
      .eq("build_id", buildId)
      .eq("status", STATUS_CLAIMED)
      .order("created_at", { ascending: true })
      .limit(BUILD_SESSIONS_LIMIT),
  ]);
  if (claimed.error) throw buildLayerError("listBuildSessions", claimed.error);
  const byId = new Map<string, SessionSummary>((claimed.data ?? []).map(toSummary).map((session) => [session.id, session]));

  const linkedIds = linked.map((row) => row.importId).filter((id): id is string => Boolean(id) && !byId.has(id as string));
  if (linkedIds.length > 0) {
    const { data, error } = await sessionsTable().select<SessionRow>(`${SESSION_COLUMNS}, status`).in("id", linkedIds).limit(BUILD_SESSIONS_LIMIT);
    if (error) throw buildLayerError("listBuildSessions", error);
    for (const row of data ?? []) byId.set(row.id, toSummary(row));
  }

  const position = new Map(linked.map((row) => [row.importId ?? row.sessionKey, row.position]));
  return [...byId.values()].sort((a, b) => {
    const left = position.get(a.id);
    const right = position.get(b.id);
    if (left !== undefined && right !== undefined) return left - right;
    if (left !== undefined) return -1;
    if (right !== undefined) return 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

/**
 * The prompts of one session, in ordinal order, for the composer's picker.
 * Built on loadImportProposal, so a session that is gone (or not the caller's)
 * throws its message rather than returning an empty list that looks like a
 * session with no prompts.
 */
export async function getSessionPrompts(importId: string): Promise<SessionPrompt[]> {
  const proposal = await loadImportProposal(importId);
  return proposal.events
    .filter((event) => event.kind === "prompt")
    .map((event) => ({ ordinal: event.ordinal, text: event.payload.text, sourceRef: event.source_ref }))
    .sort((a, b) => a.ordinal - b.ordinal);
}

/** SV-26: lives in draftCount.ts so the header can count drafts without loading this file. */
export { countDraftBuilds } from "./draftCount";

// -----------------------------------------------------------------------------
// Writing
// -----------------------------------------------------------------------------

/**
 * CA-12: add a session to a draft (or a new one): every prompt becomes a tile, and the session joins the draft's sessions
 * (`build_sessions`). The import is not marked claimed and does not leave the library: it can be in any number of drafts,
 * and each draft has its own tiles. See addSession.ts. Resolves with the draft's id.
 */
export async function attachSession(importId: string, target: AttachTarget): Promise<string> {
  return (await addSessionToBuild(importId, target)).buildId;
}

/**
 * Remove a session that is not yet in a build. discardImport only touches a
 * parsed row, so on a claimed or vanished one this does nothing; the Drafts
 * page offers it only for the former.
 */
export async function removeSession(importId: string): Promise<void> {
  await discardImport(importId);
}

/**
 * Store the model a session ran on, as the maker typed it: trimmed, null when
 * empty, 64 characters at most (refused above that rather than cut, so what is
 * stored is what they wrote). A session in a build then refreshes that build's
 * making stats.
 */
export async function setSessionModel(importId: string, raw: string): Promise<void> {
  const text = (raw ?? "").trim();
  if (text.length > MODEL_MAX) {
    throw buildLayerError(
      "setSessionModel",
      new Error(`Model name: ${MODEL_MAX} characters max`),
    );
  }

  const { data, error } = await sessionsTable()
    .update<UpdatedRow>({ model: text || null, updated_at: new Date().toISOString() })
    .eq("id", importId)
    .select("id, build_id");
  if (error) throw buildLayerError("setSessionModel", error);
  if (!data || data.length === 0) {
    throw buildLayerError("setSessionModel", new Error("That session is no longer available."));
  }

  const buildId = data[0]?.build_id;
  if (buildId) await refreshMakingStats(buildId);
}
