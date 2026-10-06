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
import { discardImport, claimImport, loadImportProposal } from "./imports";
import type { TranscriptSourceRef } from "./intake";
import { refreshMakingStats } from "./making";
import { buildLayerError } from "./types";

/** The characters of the first prompt a list keeps. */
const FIRST_PROMPT_MAX = 160;

/** The longest model text stored; the column's CHECK says the same. */
const MODEL_MAX = 64;

const DEFAULT_LIST_LIMIT = 50;

/** More sessions than one build can plausibly be made from. A ceiling, not a page. */
const BUILD_SESSIONS_LIMIT = 100;

const UNTITLED = "Untitled build";

const STATUS_PARSED = "parsed";
const STATUS_CLAIMED = "claimed";

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
  "user_turns:proposal->summary->user_turn_count, " +
  "assistant_turns:proposal->summary->assistant_turn_count";

interface SessionRow {
  id: string;
  client: string | null;
  model?: string | null;
  target_build_id: string | null;
  build_id: string | null;
  created_at: string;
  first_prompt: unknown;
  user_turns: unknown;
  assistant_turns: unknown;
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
  order: (column: string, options: { ascending: boolean }) => Query<Row>;
  limit: (count: number) => Query<Row>;
  maybeSingle: () => PromiseLike<{ data: Row | null; error: unknown }>;
}

interface SessionsTable {
  select: <Row>(columns: string) => Query<Row>;
  update: <Row>(patch: Record<string, unknown>) => Query<Row>;
}

function sessionsTable(): SessionsTable {
  return (supabase as unknown as { from: (table: string) => SessionsTable }).from("import_sessions");
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toSummary(row: SessionRow): SessionSummary {
  const model = typeof row.model === "string" && row.model.trim() ? row.model : null;
  const first = typeof row.first_prompt === "string" ? row.first_prompt.trim().slice(0, FIRST_PROMPT_MAX).trimEnd() : "";
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

/** The sessions a build was made from, oldest first, so the composer can number them 1, 2, 3. */
export async function listBuildSessions(buildId: string): Promise<SessionSummary[]> {
  const { data, error } = await sessionsTable()
    .select<SessionRow>(SESSION_COLUMNS)
    .eq("build_id", buildId)
    .eq("status", STATUS_CLAIMED)
    .order("created_at", { ascending: true })
    .limit(BUILD_SESSIONS_LIMIT);
  if (error) throw buildLayerError("listBuildSessions", error);
  return (data ?? []).map(toSummary);
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

/**
 * How many drafts the signed-in creator has, for the nav badge.
 *
 * A head request: it returns a count and no rows. The count is exact rather
 * than estimated because it is filtered to one creator's drafts, where the
 * planner's estimate is a guess that is visibly wrong at the sizes a badge
 * shows; the (creator_id, status) set it counts is a handful of rows.
 */
export async function countDraftBuilds(): Promise<number> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw buildLayerError("countDraftBuilds (session)", sessionError);
  const creatorId = data.session?.user?.id;
  if (!creatorId) return 0;

  const { count, error } = await supabase
    .from("builds")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("status", "draft");
  if (error) throw buildLayerError("countDraftBuilds", error);
  return count ?? 0;
}

// -----------------------------------------------------------------------------
// Writing
// -----------------------------------------------------------------------------

/**
 * Tie a waiting session to a build, writing nothing from the conversation.
 *
 * The selections keep no events and no nodes and no outcome; the title is kept
 * only for a new draft. A NEW draft is created by claimImport, which needs a
 * title: the proposal's own, else "Untitled build". materialiseProposal accepts
 * empty selections (it reads, writes nothing, and only patches a kept title),
 * so claimImport is used unchanged and nothing is marked claimed by hand.
 *
 * The status is read first so a session that is gone (RLS) or already claimed
 * is refused BEFORE claimImport can create a new draft for it, which would
 * leave an empty draft behind. Two tabs racing past that read still end in
 * claimImport's own conditional update refusing the second.
 */
export async function attachSession(importId: string, target: AttachTarget): Promise<string> {
  const { data: row, error } = await sessionsTable()
    .select<StatusRow>("id, status, build_id")
    .eq("id", importId)
    .maybeSingle();
  if (error) throw buildLayerError("attachSession", error);
  if (!row) {
    throw buildLayerError("attachSession", new Error("That session is no longer available."));
  }
  if (row.status !== STATUS_PARSED) {
    throw buildLayerError("attachSession", new Error("That session is already in a build."));
  }

  const proposal = await loadImportProposal(importId);
  const isNew = target.kind === "new";
  const destination = isNew
    ? { kind: "new" as const, title: proposal.summary.proposed_title?.value?.trim() || UNTITLED }
    : { kind: "existing" as const, buildId: target.buildId };

  const { buildId } = await claimImport(
    importId,
    proposal,
    { eventOrdinals: [], nodeLocalIds: [], title: isNew, outcome: false },
    destination,
  );

  await refreshMakingStats(buildId);
  return buildId;
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
      new Error(`The model name can be at most ${MODEL_MAX} characters.`),
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
