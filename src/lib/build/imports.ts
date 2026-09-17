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

import { supabase } from "@/integrations/supabase/client";
import { createBuild } from "./builds";
import {
  materialiseProposal,
  type IntakeSelections,
  type TranscriptProposal,
} from "./intake";
import { buildLayerError } from "./types";

/** A build is never asked to name itself before it exists. Same as the paste path. */
const DRAFT_TITLE = "Untitled build";

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

/** What an update hands back: the one column each caller asks for. */
interface UpdatedRow {
  id?: string;
  user_id?: string;
}

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

// -----------------------------------------------------------------------------
// Claiming and discarding
// -----------------------------------------------------------------------------

/**
 * Take a waiting import into a NEW build.
 *
 * The draft is created here, at the moment the creator confirms, then written
 * by the same materialiseProposal the paste path uses, then the import row is
 * marked claimed with the build it went to. The claim is CONDITIONAL on the row
 * still being parsed: a second tab, or a second click that got past the
 * button's disabled state, finds zero rows and is told so rather than writing
 * the conversation twice.
 *
 * The order matters. The build is written before the row is marked, so a
 * failure between the two leaves a waiting import and a draft the creator can
 * see, rather than a claimed import pointing at nothing.
 */
export async function claimImport(
  importId: string,
  proposal: TranscriptProposal,
  selections: IntakeSelections,
): Promise<string> {
  const build = await createBuild({ title: DRAFT_TITLE });
  await materialiseProposal(build.id, proposal, selections);

  const { data, error } = await importSessions()
    .update({ status: STATUS_CLAIMED, build_id: build.id, updated_at: stamp() })
    .eq("id", importId)
    .eq("status", STATUS_PARSED)
    .select("id");
  if (error) throw buildLayerError("claimImport", error);
  if (!data || data.length === 0) {
    throw buildLayerError(
      "claimImport",
      new Error(
        "This import was already claimed, so it was not marked again. " +
          `The draft it was written to is ${build.id}.`,
      ),
    );
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
