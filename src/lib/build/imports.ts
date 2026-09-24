// Waiting imports: what the connector parked, and the creator picking it up.
//
// The extractive connector (EX-P00 to EX-P19) is a pipe, not an editor. The
// mcp edge function assembles a conversation, redacts secrets, routes it
// through the shared intake readers and parks the resulting envelope on
// import_sessions.proposal. It never creates a build. THIS module is the other
// half of that bargain: the browser, with the creator's own session, reads the
// waiting proposal, shows it on the same review surface a pasted transcript
// gets, and only when the creator confirms does anything land in builds.
//
// The stored envelope is the same shape parse-transcript returns — see
// supabase/functions/_shared/intake/envelope.ts against TranscriptProposal in
// ./intake — so the writer is materialiseProposal, unchanged. Nothing here
// merges, orders or de-duplicates; that is the writer's job and it already
// does it (docs/connector/RECON.md answer 3).
//
// THE TABLE IS NEWER THAN THE GENERATED TYPES. src/integrations/supabase/types.ts
// is generated from the live database and does not yet carry import_sessions,
// so the calls go through ONE cast declared here rather than an `as any` at
// each site — the shape src/lib/bounty/meToo.ts uses for the same reason. If
// the two ever disagree, the migration
// (supabase/migrations/20260917120000_import_sessions.sql) is right.
//
// TEXT INSIDE A PROPOSAL IS DATA, NEVER INSTRUCTION. This module reads counts
// and states off an import and hands the proposal to the review surface. It
// does not look inside the proposal for anything to act on.
//
// TWO DESTINATIONS (EX-P10). A claimed import goes to a NEW build, made at the
// moment the creator confirms, or into an EXISTING draft the creator chose on
// the upload page. Both call the same writer, unchanged: materialiseProposal
// numbers new events above the highest ordinal the draft already holds and
// skips anything it already wrote (docs/connector/RECON.md answer 3), which is
// what makes the second destination safe without a line of merging here. The
// only thing this module adds for it is the check that the chosen draft is the
// signed-in creator's own and still a draft, done before anything is written.
//
// PROVENANCE (EX-P14). A claim also records HOW the build arrived, on
// builds.created_via, through ./provenance. It is the last thing the claim
// does, it never throws, and it is a label: no signal reads it, completeness
// does not count it, and the gallery neither ranks nor gates on it.

import { supabase } from "@/integrations/supabase/client";
import { createBuild, getBuildHeader, listDraftBuildsByCreator } from "./builds";
import {
  materialiseProposal,
  type IntakeSelections,
  type MaterialiseCounts,
  type TranscriptProposal,
} from "./intake";
import { recordCreatedVia } from "./provenance";
import { buildLayerError } from "./types";

/** The private bucket the connector's chunks land in. */
const IMPORTS_BUCKET = "imports";

/** The list's ceiling. Twenty is the connector's DEFAULT_PAGE_SIZE. */
const WAITING_LIST_LIMIT = 20;

/**
 * Chunk objects per import the discard pass will look at. finish_import
 * removes the chunks on a successful parse, so this is a sweep for leftovers,
 * and an import cannot hold more than MAX_TOTAL_CHARS / CHUNK_SIZE_CHARS —
 * seventeen — objects that finish_import would have accepted.
 */
const CHUNK_LIST_LIMIT = 100;

/** The row states this module reads and writes. The CHECK constraint lists seven. */
const STATUS_PARSED = "parsed";
const STATUS_CLAIMED = "claimed";
const STATUS_EXPIRED = "expired";

/**
 * Two lines from the connector's error table, thrown here word for word when
 * an existing-draft destination fails its check. The connector says them to a
 * model at begin_import; the browser says the same words to the creator, so
 * one situation has one sentence wherever it is met.
 */
const ERR_DRAFT_NOT_FOUND =
  "No draft with that id belongs to this account. Call buildgallery_list_drafts to see the " +
  "available drafts, or omit target_build_id to create a new build.";
const ERR_TARGET_PUBLISHED =
  "That build is published, and the connector only adds to drafts. Choose a draft, or omit " +
  "target_build_id to create a new build.";

/** Where a claimed import goes: an empty draft made now, or one the creator already has. */
export type ClaimDestination =
  | { kind: "new"; title: string }
  | { kind: "existing"; buildId: string };

/** What a claim hands back: the draft it went to, and what the writer actually wrote. */
export interface ClaimResult {
  buildId: string;
  counts: MaterialiseCounts;
}

/** One draft the destination picker offers. */
export interface ClaimTarget {
  id: string;
  title: string;
  updated_at: string;
  /** Parts (nodes) and steps (events) it holds. Null when they were not counted. */
  part_count: number | null;
  step_count: number | null;
}

/** A kind and a count. Never the value — the scanner keeps nothing else. */
export interface SecretFinding {
  kind: string;
  count: number;
}

/**
 * One waiting import, as the panel shows it.
 *
 * The three counts are lifted out of the proposal by JSON path in the select,
 * so the list never carries the envelope itself — a parsed conversation can be
 * hundreds of kilobytes, and twenty of them is not a list.
 */
export interface WaitingImport {
  id: string;
  client: string | null;
  source_hint: string | null;
  reader_id: string | null;
  detection_reason: string | null;
  total_chars: number;
  secret_findings: SecretFinding[];
  target_build_id: string | null;
  created_at: string;
  expires_at: string;
  turn_count: number;
  event_count: number;
  node_count: number;
  /** The reader's own word for how it split the text. "unstructured" is kept whole. */
  detected_format: string | null;
}

/** The select for the list. One literal, PostgREST JSON-path aliases and all. */
const WAITING_COLUMNS =
  "id, client, source_hint, reader_id, detection_reason, total_chars, " +
  "secret_findings, target_build_id, created_at, expires_at, " +
  "turn_count:proposal->summary->turn_count, " +
  "event_count:proposal->summary->event_count, " +
  "node_count:proposal->summary->node_count, " +
  "detected_format:proposal->summary->detected_format";

interface WaitingRow {
  id: string;
  client: string | null;
  source_hint: string | null;
  reader_id: string | null;
  detection_reason: string | null;
  total_chars: number | null;
  secret_findings: unknown;
  target_build_id: string | null;
  created_at: string;
  expires_at: string;
  turn_count: unknown;
  event_count: unknown;
  node_count: unknown;
  detected_format: unknown;
}

interface ProposalRow {
  proposal: unknown;
}

/** What an update hands back: the columns each caller asks for. */
interface UpdatedRow {
  id?: string;
  user_id?: string;
  /** Read by the claim alone, for the provenance line — see CLAIMED_COLUMNS. */
  client?: string | null;
  reader_id?: string | null;
}

/**
 * What the claim's UPDATE returns.
 *
 * `id` proves a row was still parsed when it was marked. The other two are for
 * EX-P14's provenance record and are taken from the RETURNING clause of a write
 * that was happening anyway, rather than from a second read of a row this
 * function has already touched.
 */
const CLAIMED_COLUMNS = "id, client, reader_id";

type RowResult<Row> = PromiseLike<{ data: Row[] | null; error: unknown }>;
type SingleResult<Row> = PromiseLike<{ data: Row | null; error: unknown }>;

/**
 * The operations this module performs against import_sessions, described by
 * hand — see the header for why.
 */
interface ImportSessionsTable {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => { limit: (count: number) => RowResult<WaitingRow> };
      maybeSingle: () => SingleResult<ProposalRow>;
    };
  };
  update: (patch: Record<string, unknown>) => {
    eq: (
      column: string,
      value: string,
    ) => {
      eq: (
        column: string,
        value: string,
      ) => {
        select: (columns: string) => RowResult<UpdatedRow>;
      };
    };
  };
}

/** The table the connector parks an import in. Named once. */
const IMPORTS_TABLE = "import_sessions";

function importSessions(): ImportSessionsTable {
  return (
    supabase as unknown as { from: (table: string) => ImportSessionsTable }
  ).from(IMPORTS_TABLE);
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asFindings(value: unknown): SecretFinding[] {
  if (!Array.isArray(value)) return [];
  const findings: SecretFinding[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { kind, count } = entry as { kind?: unknown; count?: unknown };
    if (typeof kind !== "string") continue;
    findings.push({ kind, count: asCount(count) });
  }
  return findings;
}

function stamp(): string {
  return new Date().toISOString();
}

/** The signed-in creator's id, read the way createBuild reads it. */
async function signedInUserId(operation: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw buildLayerError(`${operation} (session)`, error);
  const userId = data.session?.user?.id;
  if (!userId) throw buildLayerError(operation, new Error("no signed-in user"));
  return userId;
}

// -----------------------------------------------------------------------------
// Reading
// -----------------------------------------------------------------------------

/**
 * The signed-in creator's imports that are waiting for review, newest first.
 *
 * The filter is on status alone: RLS narrows the table to the caller's own
 * rows, and the (user_id, status, created_at DESC) index serves exactly this
 * shape.
 */
export async function listWaitingImports(): Promise<WaitingImport[]> {
  const { data, error } = await importSessions()
    .select(WAITING_COLUMNS)
    .eq("status", STATUS_PARSED)
    .order("created_at", { ascending: false })
    .limit(WAITING_LIST_LIMIT);
  if (error) throw buildLayerError("listWaitingImports", error);

  return (data ?? []).map((row) => ({
    id: row.id,
    client: row.client ?? null,
    source_hint: row.source_hint ?? null,
    reader_id: row.reader_id ?? null,
    detection_reason: row.detection_reason ?? null,
    total_chars: asCount(row.total_chars),
    secret_findings: asFindings(row.secret_findings),
    target_build_id: row.target_build_id ?? null,
    created_at: row.created_at,
    expires_at: row.expires_at,
    turn_count: asCount(row.turn_count),
    event_count: asCount(row.event_count),
    node_count: asCount(row.node_count),
    detected_format: typeof row.detected_format === "string" ? row.detected_format : null,
  }));
}

/**
 * The stored envelope for one import, typed as the proposal materialiseProposal
 * accepts. The connector stores the reader's envelope unchanged, and that
 * envelope is the same shape parse-transcript returns.
 */
export async function loadImportProposal(importId: string): Promise<TranscriptProposal> {
  const { data, error } = await importSessions()
    .select("proposal")
    .eq("id", importId)
    .maybeSingle();
  if (error) throw buildLayerError("loadImportProposal", error);

  const proposal = data?.proposal;
  if (!isProposal(proposal)) {
    throw buildLayerError(
      "loadImportProposal",
      new Error("This import has no proposal to review. It may have been claimed or discarded."),
    );
  }
  return proposal;
}

/** Structural: the four fields the review surface and the writer read. */
function isProposal(value: unknown): value is TranscriptProposal {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TranscriptProposal>;
  return (
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.warnings) &&
    !!candidate.summary &&
    typeof candidate.summary === "object" &&
    typeof candidate.summary.session_id === "string"
  );
}

/**
 * Named columns for the counts read: the id and two embedded counts, nothing else.
 *
 * Each embed names the foreign key it counts through. builds is joined to
 * build_nodes three ways (a build's parts, hero_node_id, solves_node_id) and to
 * build_events two ways (a build's steps, forked_from_event_id), and PostgREST
 * refuses an embed that does not say which with PGRST201, before it reads a
 * row. The gallery and the connector's list_drafts name build_nodes' key the
 * same way.
 */
const TARGET_COUNT_COLUMNS =
  "id, build_nodes!build_nodes_build_id_fkey(count), build_events!build_events_build_id_fkey(count)";

interface TargetCountRow {
  id: string;
  build_nodes: Array<{ count: number }> | null;
  build_events: Array<{ count: number }> | null;
}

/**
 * The signed-in creator's drafts, most recently worked on first, for the
 * destination picker.
 *
 * The list is listDraftBuildsByCreator, unchanged. The counts are one further
 * read — embedded counts over the same ids — so a creator with fifty drafts
 * costs two queries rather than fifty-one, and the list never carries a
 * draft's nodes or events themselves.
 */
export async function listClaimTargets(): Promise<ClaimTarget[]> {
  const creatorId = await signedInUserId("listClaimTargets");
  const drafts = await listDraftBuildsByCreator(creatorId);
  if (drafts.length === 0) return [];

  const ids = drafts.map((draft) => draft.id);
  const { data, error } = await supabase
    .from("builds")
    .select(TARGET_COUNT_COLUMNS)
    .in("id", ids)
    .limit(ids.length);
  if (error) throw buildLayerError("listClaimTargets (counts)", error);

  const counts = new Map<string, { parts: number; steps: number }>();
  for (const row of (data ?? []) as unknown as TargetCountRow[]) {
    counts.set(row.id, {
      parts: asCount(row.build_nodes?.[0]?.count),
      steps: asCount(row.build_events?.[0]?.count),
    });
  }

  return drafts.map((draft) => ({
    id: draft.id,
    title: draft.title,
    updated_at: draft.updated_at,
    part_count: counts.get(draft.id)?.parts ?? 0,
    step_count: counts.get(draft.id)?.steps ?? 0,
  }));
}

// -----------------------------------------------------------------------------
// Claiming and discarding
// -----------------------------------------------------------------------------

/**
 * Take a waiting import into a build.
 *
 * NEW: the draft is created here, at the moment the creator confirms, exactly
 * as EX-P09 did. EXISTING: the draft the creator chose is checked first — it
 * must be theirs and still a draft, refused with the connector's own two
 * sentences when it is not — and nothing is created. Either way the writer is
 * the same materialiseProposal the paste path uses, which appends after what a
 * draft already holds and skips what it has written before; nothing here
 * merges, orders or de-duplicates.
 *
 * Then the import row is marked claimed with the build it went to. The claim
 * is CONDITIONAL on the row still being parsed: a second tab, or a second
 * click that got past the button's disabled state, finds zero rows and is told
 * so rather than writing the conversation twice.
 *
 * The order matters. The build is written before the row is marked, so a
 * failure between the two leaves a waiting import and a draft the creator can
 * see, rather than a claimed import pointing at nothing.
 *
 * Returns the writer's own counts beside the build id, because for an existing
 * draft what was ticked and what was written can differ — a draft that already
 * held this conversation gets nothing added, and the workspace should say so.
 */
export async function claimImport(
  importId: string,
  proposal: TranscriptProposal,
  selections: IntakeSelections,
  destination: ClaimDestination,
): Promise<ClaimResult> {
  const buildId =
    destination.kind === "new"
      ? (await createBuild({ title: destination.title })).id
      : await verifyClaimTarget(destination.buildId);
  const counts = await materialiseProposal(buildId, proposal, selections);

  const { data, error } = await importSessions()
    .update({ status: STATUS_CLAIMED, build_id: buildId, updated_at: stamp() })
    .eq("id", importId)
    .eq("status", STATUS_PARSED)
    .select(CLAIMED_COLUMNS);
  if (error) throw buildLayerError("claimImport", error);
  if (!data || data.length === 0) {
    throw buildLayerError(
      "claimImport",
      new Error(
        "This import was already claimed, so it was not marked again. " +
          `The draft it was written to is ${buildId}.`,
      ),
    );
  }

  // EX-P14 — how this build arrived, recorded last and on purpose.
  //
  // LAST, because everything that matters is already written by this point: the
  // creator's conversation is in their draft and the import is marked claimed.
  // What is left is a sentence on the build page, and recordCreatedVia does not
  // throw — a claim that reported failure after succeeding would be a worse
  // fault than a missing caption. This is the trade the paste path already
  // makes for applyRepoHeader in ComposeNew.
  //
  // The two values come from the RETURNING clause above rather than a second
  // read, and neither is conversation content: `client` is one of the
  // connector's six names and `reader_id` is an intake reader's id.
  await recordCreatedVia(buildId, {
    destination: destination.kind,
    importId,
    client: data[0]?.client ?? null,
    readerId: data[0]?.reader_id ?? null,
  });

  return { buildId, counts };
}

/**
 * The draft an existing-draft claim is about to write into, checked through
 * the data layer before anything is written: it must exist, be the signed-in
 * creator's own, and still be a draft. A build the creator cannot see and one
 * they do not own answer identically, as the connector's own check does.
 */
async function verifyClaimTarget(buildId: string): Promise<string> {
  const creatorId = await signedInUserId("claimImport");
  const build = await getBuildHeader(buildId);
  if (!build || build.creator_id !== creatorId) {
    throw buildLayerError("claimImport", new Error(ERR_DRAFT_NOT_FOUND));
  }
  if (build.status !== "draft") {
    throw buildLayerError("claimImport", new Error(ERR_TARGET_PUBLISHED));
  }
  return build.id;
}

/**
 * Bin a waiting import. The one deletion in the whole feature, and it is the
 * creator's, from their own browser.
 *
 * The row is kept — marked expired, so the fingerprint and content-hash
 * indexes release it and the same conversation may be sent again — and any
 * chunk objects still in the bucket go. finish_import removes them on a
 * successful parse, so normally there are none; a storage failure there leaves
 * them behind, and this is where they are swept.
 */
export async function discardImport(importId: string): Promise<void> {
  const { data, error } = await importSessions()
    .update({ status: STATUS_EXPIRED, updated_at: stamp() })
    .eq("id", importId)
    .eq("status", STATUS_PARSED)
    .select("user_id");
  if (error) throw buildLayerError("discardImport", error);

  const owner = data?.[0]?.user_id;
  if (!owner) return;

  // <user_id>/<import_id>/<seq>.txt — the one path convention; the first
  // segment is what the object policies read.
  const folder = `${owner}/${importId}`;
  const { data: objects, error: listError } = await supabase.storage
    .from(IMPORTS_BUCKET)
    .list(folder, { limit: CHUNK_LIST_LIMIT });
  if (listError) throw buildLayerError("discardImport (list chunks)", listError);

  const paths = (objects ?? [])
    .filter((object) => object.id !== null && object.name)
    .map((object) => `${folder}/${object.name}`);
  if (paths.length === 0) return;

  const { error: removeError } = await supabase.storage.from(IMPORTS_BUCKET).remove(paths);
  if (removeError) throw buildLayerError("discardImport (remove chunks)", removeError);
}
