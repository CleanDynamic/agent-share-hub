// =============================================================================
// buildgallery — mcp (EX-P02 the door, EX-P04 the lock, EX-P06 the pipe, EX-P08 the parse,
//                     EX-P10 the destination, EX-P11 the honest fallback)
// =============================================================================
// The MCP door, locked, with a pipe behind it. Every request that is not OAuth
// discovery must carry a valid user JWT, and every database and storage call
// this function makes goes through the caller's own client, under the
// caller's own RLS and the bucket's own object policies.
//
// THE PRINCIPLE. The connector is a pipe, not an editor. It carries a whole
// conversation verbatim so a human can choose from it later, on the upload
// page, in their own browser. No tool here summarises, selects, reorders or
// publishes, and no eighth tool will be added to do so.
//
// THE PIPELINE, in order:
//
//   withOAuthProtectedResource()  runs first, ahead of the gate. It answers
//     GET  .../mcp/.well-known/oauth-protected-resource  with RFC 9728
//     metadata, answers the OPTIONS preflight, and adds
//     `WWW-Authenticate: Bearer resource_metadata="..."` to every 401 the
//     stack produces. On edge functions it derives the resource server and
//     authorization server itself, from the gateway headers and the function
//     slug, so neither is configured here — hand-writing either would pin a
//     URL that the platform already knows and that a custom domain will move.
//
//   withSupabase<Database>({ auth: 'user' })  is the gate. No token, or a
//     token that does not verify, is a 401 and the handler below never runs.
//     A token that verifies gives the handler ctx.supabase, scoped to that
//     user.
//
// NO SERVICE-ROLE KEY. Not a literal, not an env read, not indirectly. Note
// that the middleware also offers `ctx.supabaseAdmin`, a client that bypasses
// RLS; this function must never touch it. It is constructed lazily on first
// access, so leaving it alone means the service-role key is never even read.
// Every read and write here goes through ctx.supabase and nothing else.
//
// OWNERSHIP IS THE DATABASE'S JOB. No tool below checks that a row belongs to
// the caller. import_sessions is owner-only in all four directions under RLS,
// and the imports bucket's object policies read the owner off the first path
// segment. A row the caller does not own is a row that does not exist to
// them, and every tool answers accordingly.
//
// THE PIPE (EX-P06). Five tools move text and list things. Nothing here
// parses, scans or assembles: a chunk is stored verbatim as its own numbered
// object at {user_id}/{import_id}/{seq}.txt and the row is recounted from the
// bucket, so the counts a caller sees are what is actually stored.
//
// THE PARSE (EX-P08). buildgallery_finish_import is the one tool that reads
// what the pipe carried. It claims the row (open -> assembling), lists the
// chunks and refuses a partial import, reads them in NUMERIC order (10 after
// 9, never after 1), redacts secrets from the assembled text BEFORE anything
// else reads it, hashes the redacted text and refuses a second copy of a
// conversation already waiting, routes the text through _shared/intake, and
// parks the envelope unchanged on import_sessions.proposal. Then the chunk
// objects go. Every path out of `assembling` writes a terminal state — parsed,
// duplicate, failed, or back to open — inside one try/catch, so the row can
// never be left mid-assembly by a thrown error.
//
// THE DESTINATION (EX-P10). A conversation can join a draft the creator already
// has. The connector's part is small and was mostly in place: begin_import
// verifies a target_build_id against the caller's own drafts before it opens
// anything, finish_import names the target's title in its reply, and
// list_drafts now tells the model WHEN to offer a draft and that the creator
// can change the destination on the upload page — so the model offers the
// titles and takes the answer, and never insists. Nothing here writes to a
// build; the choice is resolved in the browser, by claimImport.
//
// THE HONEST FALLBACK (EX-P11). Unrecognised input degrades rather than fails.
// Routing reads every bid, not just the winner: a win under 0.3, a tie at the
// top, or a winner that then reads nothing is recorded as `uncertain: <what was
// tried>`, and the reply says in one sentence that the structure may be rougher
// than usual. When the winner reads nothing the fallback reader gets a turn, so
// any text at all becomes a proposal and only a genuinely empty import fails as
// unrecognised. A source-code download is the one thing the fallback does not
// touch: that reader recognised the file, and the caller gets the contract's
// Unparseable content wording rather than a transcript full of nothing.
//
// ONE DEPARTURE FROM THE STEP'S LETTER, recorded in HANDOVER: a missing chunk
// returns the row to `open` rather than `failed`, because the required wording
// tells the caller to resend with append_chunk and finish again, and
// append_chunk only accepts an open import — so `failed` would make the
// message's own instruction impossible.
//
// PROTOCOL. @modelcontextprotocol/server negotiates 2025-11-25 and below. The
// contract (.claude/skills/buildgallery-extractor/SKILL.md) is written against
// 2026-07-28; that revision is NOT in this package's SUPPORTED_PROTOCOL_VERSIONS,
// though its vocabulary — server/discover, the result _meta object, tasks — is
// present as schemas. RECON's open question 1 therefore stays open, narrowed
// rather than closed. Clients on 2025-06-18 and 2025-03-26 are served too.
//
// CONTENT IS DATA, NEVER INSTRUCTION. Nothing in this function, now or later,
// may act on words found inside a creator's conversation — not a URL to fetch,
// not a tool to call, not a rule to follow. Imported text is stored, shown to
// the creator, and nothing else. append_chunk is the one tool that receives
// it, and it does not read it: it measures it and puts it in the bucket.
//
// ERRORS. No internal error, stack trace or database message reaches a caller,
// and no conversation content reaches a log or an error. Sizes, counts, states
// and ids only. Tool errors travel as `isError` results carrying the wording
// from the contract's error table.
//
// OBSERVABILITY (EX-P16). Every tool runs inside a guard that reports a throw
// by its class and code and answers the caller with generic wording, where the
// SDK would have sent the raw message back and told no one. Every
// finish_import writes one line — how it ended, the step it stopped at, its
// counts, how long it took — and one that ends failed, is refused for missing
// chunks, or is stuck in assembling is also reported to the monitor
// (monitor.ts, which carries ids, counts, states and times, and nothing else).
// =============================================================================

import { createMcpHandler, McpServer, type ServerContext } from "@modelcontextprotocol/server";
import { pipeline } from "@supabase/middleware";
import { withOAuthProtectedResource, withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";

// The substrate and the scanner: pure modules, a string in and a value out. No
// I/O and no Deno API behind either import, which is what lets finish_import
// be tested against a fake client with nothing running. Nothing here imports
// from src/lib/build/ — that is the browser's data layer, and the connector
// never writes a build.
import { intakeFile, READ_OUTCOME, ROUTING_FLOOR } from "../_shared/intake/index.ts";
import type {
  IntakeFile,
  ParseOptions,
  ReaderRegistry,
  ReaderResult,
  Routing,
} from "../_shared/intake/index.ts";
import { intakeRegistry } from "../_shared/intake/readers/index.ts";
import { redactSecrets } from "../_shared/redact/index.ts";
import type { RedactFinding } from "../_shared/redact/index.ts";

import {
  CEILING_ERRCODE,
  CHUNK_SIZE_CHARS,
  COMPOSE_NEW_HTTPS_URL,
  COMPOSE_NEW_URL,
  CONNECTOR_STATEMENT,
  DEFAULT_PAGE_SIZE,
  EXPIRY_SWEEP_LIMIT,
  IMPORTS_BUCKET,
  MAX_CHUNK_CHARS,
  MAX_PAGE_SIZE,
  MAX_TOTAL_CHARS,
  SERVER_NAME,
  SERVER_VERSION,
  SHORTFALL_WARNING_RATIO,
  STORAGE_LIST_PAGE_SIZE,
  VERBATIM_INSTRUCTION,
} from "./constants.ts";
import type { Database } from "./database.types.ts";
import { createMonitor, errorFacts, FinishCall, traceFrom } from "./monitor.ts";
import type { ErrorFacts, FinishReason, Monitor, TraceFacts } from "./monitor.ts";

type ImportSessionPatch = Database["public"]["Tables"]["import_sessions"]["Update"];

/** The caller's own client. Every database and storage call here uses this. */
export type CallerClient = SupabaseClient<Database>;

/** Identity taken from the verified JWT, before any database read. */
export interface CallerIdentity {
  id: string;
  email: string | null;
}

// -----------------------------------------------------------------------------
// Shared shapes and helpers
// -----------------------------------------------------------------------------

/** The six clients the import_sessions CHECK admits. Anything else is unknown. */
const KNOWN_CLIENTS = ["claude", "claude-code", "chatgpt", "cursor", "web", "unknown"] as const;

/** Statuses under which a fingerprint still points at a live, reusable import. */
const LIVE_STATUSES = ["open", "assembling", "parsed"] as const;

/** Postgres unique_violation: the partial fingerprint index caught a race. */
const UNIQUE_VIOLATION = "23505";

const ResponseFormat = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe('Output format: "markdown" for a human-readable page, "json" for the structured object as text.');

const Pagination = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`How many rows to return, 1 to ${MAX_PAGE_SIZE}, e.g. 20.`),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("How many rows to skip, e.g. 20 for the second page."),
  response_format: ResponseFormat,
};

const PageFields = {
  total_count: z.number().int().describe("How many rows the caller has in total, e.g. 12."),
  has_more: z.boolean().describe("Whether another page follows this one."),
  next_offset: z
    .number()
    .int()
    .nullable()
    .describe("The offset to pass for the next page, e.g. 20, or null when there is none."),
};

type ToolText = { type: "text"; text: string };

/** A successful result: the markdown face and the structured face together. */
function ok<T extends Record<string, unknown>>(
  text: string,
  structuredContent: T,
): { content: ToolText[]; structuredContent: T } {
  return { content: [{ type: "text", text }], structuredContent };
}

/** A tool error. Wording from the error table; never an internal message. */
function fail(text: string): { isError: true; content: ToolText[] } {
  return { isError: true, content: [{ type: "text", text }] };
}

/** Either of the two above: what every tool answers with. */
type ToolReply = { content: ToolText[]; structuredContent?: Record<string, unknown>; isError?: true };

/** 61204 -> "61,204", the way the error table writes numbers. */
function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** Bytes of the UTF-8 encoding — what the bucket measures an object by. */
function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "just now", "3 minutes ago", "3 hours ago", "yesterday", "12 Sep",
 * "12 Sep 2025" — the human-readable timestamp the contract asks for in
 * markdown. `now` is a parameter so a test can pin it.
 */
export function humanTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "unknown";

  const seconds = Math.round((now - then) / 1000);
  if (seconds >= 0 && seconds < 60) return "just now";
  if (seconds >= 60 && seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (seconds >= 3600 && seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (seconds >= 86400 && seconds < 172800) return "yesterday";

  const d = new Date(then);
  const day = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === new Date(now).getUTCFullYear() ? day : `${day} ${d.getUTCFullYear()}`;
}

/** total_count, has_more, next_offset from one page and the exact count. */
function page(offset: number, returned: number, total: number | null) {
  const total_count = total ?? offset + returned;
  const has_more = offset + returned < total_count;
  return { total_count, has_more, next_offset: has_more ? offset + returned : null };
}

/** A client name outside the six the CHECK admits is a value to normalise. */
function normaliseClient(client: string | undefined): string | null {
  if (client === undefined) return null;
  return (KNOWN_CLIENTS as readonly string[]).includes(client) ? client : "unknown";
}

/** The one path convention. The first segment is the owner; the policies read it. */
function chunkFolder(userId: string, importId: string): string {
  return `${userId}/${importId}`;
}

function chunkPath(userId: string, importId: string, seq: number): string {
  return `${chunkFolder(userId, importId)}/${seq}.txt`;
}

const CHUNK_NAME = /^(\d+)\.txt$/;

interface StoredChunk {
  seq: number;
  size: number;
}

/**
 * What the bucket actually holds for one import: each numbered object and its
 * size in bytes. Paged until a page comes back short, so no page size caps
 * how many chunks an import may have. Folders and stray names are ignored.
 * Throws on a storage error; callers turn that into table wording.
 */
async function listChunks(
  supabase: CallerClient,
  userId: string,
  importId: string,
): Promise<StoredChunk[]> {
  const folder = chunkFolder(userId, importId);
  const chunks: StoredChunk[] = [];

  for (let offset = 0; ; offset += STORAGE_LIST_PAGE_SIZE) {
    const { data, error } = await supabase.storage.from(IMPORTS_BUCKET).list(folder, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;

    for (const object of data ?? []) {
      const match = CHUNK_NAME.exec(object.name);
      if (!match || object.id === null) continue;
      const size = Number(object.metadata?.size ?? 0);
      chunks.push({ seq: Number(match[1]), size: Number.isFinite(size) ? size : 0 });
    }

    if ((data ?? []).length < STORAGE_LIST_PAGE_SIZE) break;
  }

  return chunks.sort((a, b) => a.seq - b.seq);
}

function sumSizes(chunks: StoredChunk[]): number {
  return chunks.reduce((total, chunk) => total + chunk.size, 0);
}

/** Sequence numbers absent below `upTo`. `upTo` is declared or the highest stored. */
function missingSeqs(chunks: StoredChunk[], upTo: number | null): number[] {
  const present = new Set(chunks.map((c) => c.seq));
  const ceiling = upTo ?? (chunks.length ? chunks[chunks.length - 1].seq : 0);
  const missing: number[] = [];
  for (let seq = 1; seq <= ceiling; seq++) if (!present.has(seq)) missing.push(seq);
  return missing;
}

/**
 * The text of each numbered object, in the order of `seqs`. The reads run in
 * parallel; the ORDER is the caller's, and the caller passes numeric order.
 * Throws on any failed read — a partial conversation is not one to parse.
 */
async function readChunks(
  supabase: CallerClient,
  userId: string,
  importId: string,
  seqs: number[],
): Promise<string[]> {
  return await Promise.all(
    seqs.map(async (seq) => {
      const { data, error } = await supabase.storage
        .from(IMPORTS_BUCKET)
        .download(chunkPath(userId, importId, seq));
      if (error || !data) throw error ?? new Error("empty download");
      return await data.text();
    }),
  );
}

/**
 * Removes the numbered objects once the text has landed elsewhere. False on a
 * storage error, logged by code: the parse stands either way, and a leftover
 * object expires with its import rather than undoing a proposal.
 */
async function removeChunks(
  supabase: CallerClient,
  userId: string,
  importId: string,
  seqs: number[],
): Promise<boolean> {
  if (seqs.length === 0) return true;
  const { error } = await supabase.storage
    .from(IMPORTS_BUCKET)
    .remove(seqs.map((seq) => chunkPath(userId, importId, seq)));
  if (error) {
    logFailure("finish_import: remove chunks", error);
    return false;
  }
  return true;
}

/**
 * Expires the CALLER'S OWN overdue imports and bins their chunk objects.
 *
 * EX-P13, sweep one of two. The nightly pg_cron job
 * (20260921120100_import_expiry_cron.sql) is the other, and the two are not
 * redundant: the job runs for everyone but has no session, so it can only flip
 * status; this one has the caller's session, so it can also reach storage. A
 * creator who never returns is handled by the job; a creator who does return
 * gets their objects collected here.
 *
 * WHY IT RUNS AT THE TOP OF begin_import. The open-imports ceiling is counted
 * by a BEFORE INSERT trigger on the very next statement. Expiring first is what
 * stops five abandoned imports from locking a creator out for ever: by the time
 * the trigger counts, the overdue ones are no longer 'open'.
 *
 * ONE STATEMENT MARKS THEM. The UPDATE returns the rows it changed, so there is
 * no read-then-write window in which a row could be claimed between being seen
 * and being expired. There is deliberately no .limit() on it: this is an UPDATE
 * against one caller's already-overdue rows, not a list query, and PostgREST's
 * limited-update needs an explicit order it would otherwise be given for no
 * reason. What IS bounded is the storage work below.
 *
 * IT ASKS FOR chunk_count, NOT status. UPDATE ... RETURNING hands back the row
 * AFTER the update, so every row in `data` reads status = 'expired' and a
 * filter on the status these rows USED to have would match nothing and delete
 * nothing. chunk_count is untouched by this statement — and by finish_import's
 * own cleanup, which removes the objects and leaves the count as the record of
 * what arrived — so it is the stable fact to work from. chunk_count = 0 means
 * no object was ever stored under this import, which is the common case for an
 * abandoned one: opened, never fed, never finished.
 *
 * MARK FIRST, DELETE SECOND, and never the other way round. If the delete fails
 * after the mark, the row is correctly expired and some objects linger in a
 * private bucket until the creator bins the import — harmless. If the mark
 * failed after a delete, a still-'open' import would have had its chunks
 * stripped out from under it, and finish_import would report missing chunks for
 * a conversation the caller sent correctly.
 *
 * IT NEVER FAILS THE OPEN. A sweep that cannot run leaves the ceiling stricter
 * than it should be, and the ceiling's own error already tells the creator what
 * to do about that. Failing begin_import instead would turn a housekeeping
 * problem into a refusal to accept a conversation. The failure is logged by
 * code, never returned.
 *
 * Returns how many rows it expired, for the caller's log line only.
 */
async function expireOverdueImports(
  supabase: CallerClient,
  userId: string,
  stamp: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("import_sessions")
      .update({ status: "expired", updated_at: stamp })
      .eq("user_id", userId)
      .in("status", [...LIVE_STATUSES])
      .lt("expires_at", stamp)
      .select("id, chunk_count");

    if (error) throw error;

    const expired = data ?? [];
    if (expired.length === 0) return 0;

    // An import that never stored a chunk has no folder to list. Capped so one
    // open cannot turn into an unbounded run of storage round trips; whatever
    // is left is already 'expired', so it is out of the ceiling's way and only
    // its objects wait for the next sweep.
    const withChunks = expired
      .filter((row) => (row.chunk_count ?? 0) > 0)
      .slice(0, EXPIRY_SWEEP_LIMIT);

    for (const row of withChunks) {
      try {
        const chunks = await listChunks(supabase, userId, row.id);
        if (chunks.length > 0) {
          await removeChunks(supabase, userId, row.id, chunks.map((c) => c.seq));
        }
      } catch (error) {
        // One import's objects failing is not the next import's problem.
        logFailure("begin_import: expire sweep objects", error);
      }
    }

    return expired.length;
  } catch (error) {
    logFailure("begin_import: expire sweep", error);
    return 0;
  }
}

/** Lowercase hex SHA-256 of the UTF-8 text, through Web Crypto. */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const SMALL_NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** 2 -> "two", 14 -> "14": the way the error table counts things to resend. */
function countWord(n: number): string {
  return SMALL_NUMBERS[n] ?? String(n);
}

/** [3, 9] -> "3 and 9"; [2, 5, 8] -> "2, 5 and 8". */
function listNumbers(ns: number[]): string {
  if (ns.length <= 1) return ns.join("");
  return `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;
}

/**
 * The ceiling trigger's own message, when this error is a ceiling refusal.
 *
 * EX-P13. Matched on SQLSTATE BGCAP, which
 * 20260921120000_import_ceilings.sql raises with and nothing else does. The
 * message is returned EXACTLY as the trigger wrote it: it is already the
 * contract's error-table wording, with the creator's real counts in it, and
 * re-composing it here would put a second copy of that wording in a second
 * language. Null for anything else, so every other error takes the generic
 * path.
 */
function ceilingMessage(error: unknown): string | null {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code !== CEILING_ERRCODE) return null;
  const message = e.message?.trim();
  return message ? message : null;
}

/** One line per failure, code only. Never a message, never content. */
function logFailure(where: string, error: unknown): void {
  const code = (error as { code?: string; name?: string } | null)?.code ??
    (error as { name?: string } | null)?.name ??
    "unknown";
  console.error(`mcp ${where} failed`, code);
}

// -----------------------------------------------------------------------------
// The error table. Wording is required, not illustrative.
// -----------------------------------------------------------------------------

function errChunkTooLarge(seq: number, chars: number): string {
  return `Chunk ${seq} is ${fmt(chars)} characters. The limit is ${fmt(MAX_CHUNK_CHARS)}. ` +
    `Split it at a message boundary and resend as chunks ${seq} and ${seq + 1}, renumbering the rest.`;
}

function errTotalExceeded(projected: number): string {
  return `This import would reach ${fmt(projected)} characters; the limit is ${fmt(MAX_TOTAL_CHARS)}. ` +
    "Send the remainder as a second import, or ask the creator to export the conversation as a " +
    `file and drop it on ${COMPOSE_NEW_URL}, which has no such limit.`;
}

function errChunksMissing(missing: number[], declared: number): string {
  const one = missing.length === 1;
  return `Chunk${one ? "" : "s"} ${listNumbers(missing)} ${one ? "is" : "are"} missing; ` +
    `${declared} ${declared === 1 ? "was" : "were"} declared. ` +
    `Resend ${one ? "it" : `those ${countWord(missing.length)}`} with append_chunk, then call ` +
    "finish_import again. Nothing has been parsed and nothing was lost.";
}

function errDuplicate(twinId: string, twinCreatedAt: string, now: number): string {
  return `This conversation is already waiting for review as import ${twinId}, created ` +
    `${humanTime(twinCreatedAt, now)}. Nothing new was created. Open ${COMPOSE_NEW_URL} to review it.`;
}

const ERR_UNPARSEABLE =
  "That content parsed as a source-code download rather than a conversation, so there are no " +
  "turns to propose. If it is a conversation, send the chat transcript rather than the repository.";

const ERR_DRAFT_NOT_FOUND =
  "No draft with that id belongs to this account. Call buildgallery_list_drafts to see the " +
  "available drafts, or omit target_build_id to create a new build.";

const ERR_TARGET_PUBLISHED =
  "That build is published, and the connector only adds to drafts. Choose a draft, or omit " +
  "target_build_id to create a new build.";

// The three cases below have no row in the contract's table. Each is written
// in the table's shape — the problem, the limit, the next action — and never
// carries an internal message.

const ERR_IMPORT_NOT_FOUND =
  "No import with that id belongs to this account. Call buildgallery_list_imports to find it, " +
  "or buildgallery_begin_import to open a new one.";

function errImportClosed(importId: string, status: string): string {
  return `Import ${importId} is ${status}, so it no longer accepts chunks. ` +
    "Call buildgallery_begin_import to open a new one.";
}

const ERR_IMPORT_NOT_OPENED =
  "The import could not be opened. Nothing was created; call buildgallery_begin_import again.";

function errChunkNotStored(seq: number): string {
  return `Chunk ${seq} could not be stored. Nothing was changed; resend chunk ${seq}.`;
}

function errCountsNotUpdated(seq: number): string {
  return `Chunk ${seq} is stored but the running total could not be updated. ` +
    `Resend chunk ${seq}; the retry lands in the same slot.`;
}

const ERR_LIST_FAILED = "The list could not be read. Nothing was changed; call the tool again.";

// EX-P08's cases without a table row, in the table's shape.

function errChunksExtra(stored: number, declared: number): string {
  return `${stored} chunks are stored but ${declared} ${declared === 1 ? "was" : "were"} declared. ` +
    `If all ${stored} belong to this conversation, call finish_import again with expected_chunks ` +
    `${stored}; if not, open a new import with begin_import and resend it. ` +
    "Nothing has been parsed and nothing was lost.";
}

const ERR_UNRECOGNISED =
  "Nothing in that content could be read as a conversation, so there are no turns to propose. " +
  "Send the chat transcript as text, every turn in order, as a new import.";

const ERR_FINISH_NOT_STARTED =
  "The import could not be read. Nothing was changed; call buildgallery_finish_import again.";

const ERR_FINISH_FAILED =
  "The import could not be assembled, and it is now failed. Nothing was parsed; open a new import " +
  "with buildgallery_begin_import and resend the conversation.";

function errImportBeingAssembled(importId: string): string {
  return `Import ${importId} is already being assembled by another call. Wait for it, then call ` +
    "buildgallery_get_import_status.";
}

function errImportNotFinishable(importId: string, status: string): string {
  return `Import ${importId} is ${status}, so it cannot be finished. ` +
    "Call buildgallery_begin_import to open a new one.";
}

// EX-P16. A tool that threw: the one case no other line here anticipated. The
// next action is safe because every tool is idempotent — a retry lands in the
// same slot, returns the same import, or repeats the same summary.

function errUnexpected(tool: string): string {
  return "That call could not be completed because of an unexpected error on buildgallery's side, " +
    `and it has been logged. Calling ${tool} again is safe: no buildgallery tool makes a second ` +
    "copy when it is retried.";
}

// -----------------------------------------------------------------------------
// buildgallery_whoami
// -----------------------------------------------------------------------------

const WhoamiInput = z.object({}).strict();

const WhoamiOutput = z.object({
  user_id: z
    .string()
    .describe('The signed-in account id, e.g. "3f6c1e02-9b1a-4f7d-8d02-1c2f5a9e77b4".'),
  email: z
    .string()
    .nullable()
    .describe('The account\'s email address, e.g. "mel@example.com", or null if the token carries none.'),
  display_name: z
    .string()
    .nullable()
    .describe('The name shown to other people, e.g. "Mel Okafor", or null if the account has not set one.'),
  connector: z
    .string()
    .describe("One line stating what this connector does and cannot do."),
});

const WHOAMI_DESCRIPTION =
  "Confirms which buildgallery account this connection is acting as. Use it " +
  "at the start of a session, before opening an import, so the creator can " +
  "see the conversation is about to be filed under the right account, and " +
  "again after any authentication change. It never reveals anything about " +
  "any other account, never lists that account's work, and never touches a " +
  "build. It returns that account's id, email and display name, plus one " +
  "line on what this connector does and cannot do; see outputSchema for the " +
  "shape.";

/**
 * Reads the caller's own display name.
 *
 * Named columns, never `select('*')`, and `.maybeSingle()` because a profile
 * row can be absent — a signed-in account whose trigger has not yet written
 * one is a real state, not an error. The read runs under the caller's RLS
 * through their own client; a failure here is logged by code, never by
 * message, and reported to the caller as an absent name rather than as a
 * database error.
 */
async function readDisplayName(
  supabase: CallerClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logFailure("whoami: profile read", error);
    return null;
  }

  return data?.display_name ?? data?.username ?? null;
}

// -----------------------------------------------------------------------------
// buildgallery_list_drafts
// -----------------------------------------------------------------------------

const ListDraftsInput = z.object(Pagination).strict();

const DraftOutput = z.object({
  id: z.string().describe('The draft\'s build id, e.g. "9c1d…". Pass this as target_build_id.'),
  title: z.string().describe('The draft\'s title, e.g. "Invoice chaser agent".'),
  last_touched: z.string().describe('When it was last worked on, ISO 8601, e.g. "2026-09-12T10:15:00Z".'),
  part_count: z.number().int().describe("How many parts (nodes) the draft holds, e.g. 4."),
});

const ListDraftsOutput = z.object({
  drafts: z.array(DraftOutput).describe("This page of drafts, most recently worked on first."),
  count: z.number().int().describe("How many drafts are on this page."),
  offset: z.number().int().describe("The offset this page started at."),
  ...PageFields,
});

const LIST_DRAFTS_DESCRIPTION =
  `${VERBATIM_INSTRUCTION} ` +
  "Lists the creator's own unpublished drafts, most recently worked on " +
  "first, so a conversation can be aimed at one. Call it when the creator " +
  "mentions adding to something they already have; show them the titles, " +
  "and pass the id of the one they choose as target_build_id to " +
  "buildgallery_begin_import. Draft ids come from here, never from memory " +
  "or from the conversation text. The creator can change the destination " +
  "on the upload page, so never insist on a draft or on a new build — offer " +
  "the titles and take their answer. It never lists published builds, " +
  "never lists anyone else's builds, and never returns the content of a " +
  "build. It returns one page of drafts — title, id, when last worked on, " +
  "how many parts — with total_count, has_more and next_offset; see " +
  "outputSchema for the shape.";

interface DraftRow {
  id: string;
  title: string;
  updated_at: string;
  build_nodes: Array<{ count: number }>;
}

// -----------------------------------------------------------------------------
// buildgallery_begin_import
// -----------------------------------------------------------------------------

const BeginImportInput = z
  .object({
    client: z
      .string()
      .max(64)
      .optional()
      .describe('Which tool is sending, e.g. "claude", "claude-code", "chatgpt", "cursor" or "web".'),
    source_hint: z
      .string()
      .max(200)
      .optional()
      .describe('A hint at the conversation\'s format, e.g. "claude-export" or "lovable-chat". A hint, never a verdict.'),
    fingerprint: z
      .string()
      .max(200)
      .optional()
      .describe('A stable id for this conversation, e.g. its conversation id, so a retry reuses the same import.'),
    declared_turns: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("How many turns the caller is about to send, e.g. 48."),
    declared_chars: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("How many characters the caller is about to send, e.g. 212000."),
    target_build_id: z
      .uuid()
      .optional()
      .describe("A draft id from buildgallery_list_drafts, when this import should join an existing draft."),
  })
  .strict();

const BeginImportOutput = z.object({
  import_id: z.string().describe('The handle every other import tool takes, e.g. "6d0f…".'),
  chunk_size_chars: z.number().int().describe(`The recommended chunk size in characters, ${fmt(CHUNK_SIZE_CHARS)}.`),
  max_total_chars: z.number().int().describe(`The ceiling on one import's total, ${fmt(MAX_TOTAL_CHARS)}.`),
  target: z.string().nullable().describe("The draft this import will join, or null for a new build."),
  instructions: z.string().describe("One paragraph on how to send the conversation."),
  reused: z.boolean().describe("True when an existing unclaimed import with this fingerprint was returned instead of a new one."),
});

const BEGIN_IMPORT_DESCRIPTION =
  `${VERBATIM_INSTRUCTION} ` +
  "Opens a waiting import and returns the import_id handle that every " +
  "other import tool uses. Use it once, at the start, before sending any " +
  "part of the conversation; it also returns the recommended chunk size so " +
  "the caller can split correctly on the first attempt rather than after a " +
  "rejection. It never sends, receives or inspects any conversation " +
  "content, and it never creates a build. It returns the import_id, the " +
  "recommended chunk size in characters, and the ceilings that apply to " +
  "this import; see outputSchema for the shape.";

function beginInstructions(target: string | null): string {
  return "Send every turn of the conversation verbatim and in order, user and assistant " +
    "alike, including code blocks and errors, with nothing summarised, tidied or left out. " +
    `Split it into chunks of about ${fmt(CHUNK_SIZE_CHARS)} characters, breaking at message ` +
    `boundaries where possible and never above ${fmt(MAX_CHUNK_CHARS)}; number the chunks ` +
    "from 1 and send each one with buildgallery_append_chunk against this import_id. When " +
    "the last chunk is acknowledged, call buildgallery_finish_import with the total number " +
    "of chunks sent." +
    (target ? ` This import will join draft ${target}.` : "");
}

interface OpenedImport {
  id: string;
  target_build_id: string | null;
  created_at: string;
}

/** The existing live import for this fingerprint, if there is one. RLS scopes it. */
async function findLiveImport(
  supabase: CallerClient,
  fingerprint: string,
): Promise<OpenedImport | null> {
  const { data, error } = await supabase
    .from("import_sessions")
    .select("id, target_build_id, created_at")
    .eq("fingerprint", fingerprint)
    .in("status", [...LIVE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// buildgallery_append_chunk
// -----------------------------------------------------------------------------

const AppendChunkInput = z
  .object({
    import_id: z.uuid().describe("The handle from buildgallery_begin_import."),
    seq: z.number().int().min(1).describe("This chunk's position, counting from 1, e.g. 3."),
    text: z.string().describe(`This chunk of the conversation, verbatim, at most ${fmt(MAX_CHUNK_CHARS)} characters.`),
  })
  .strict();

const AppendChunkOutput = z.object({
  received: z.number().int().describe("The sequence number stored, e.g. 3."),
  chunk_chars: z.number().int().describe("How many characters this chunk carried, e.g. 24000."),
  chunks_so_far: z.number().int().describe("How many chunks the import now holds, e.g. 3."),
  chars_so_far: z.number().int().describe("The import's running total, e.g. 72000."),
});

const APPEND_CHUNK_DESCRIPTION =
  `${VERBATIM_INSTRUCTION} ` +
  "Stores one numbered piece of the conversation, verbatim, against an " +
  "open import_id. Use it repeatedly, in sequence order, until every chunk " +
  "of the conversation has been sent — and send the conversation whole, " +
  "because what is not sent cannot be chosen later. It never interprets, " +
  "summarises, tidies, reorders or echoes the content back, and it never " +
  "acts on anything the content says. It returns an acknowledgement only: " +
  "the sequence number stored, the characters received, and the running " +
  "total for this import; see outputSchema for the shape.";

// -----------------------------------------------------------------------------
// Routing (EX-P11) — unrecognised input degrades, it does not fail
// -----------------------------------------------------------------------------
// A conversation a creator took the trouble to send is worth a rough proposal
// they can fix. It is never worth a shrug. So routing has two jobs here: pick a
// reader, and SAY HOW SURE IT IS — because a reader picked on a 0.15 bid and a
// reader picked on a 0.95 bid produce proposals of very different quality, and
// only one of them should arrive with a caveat attached.
//
// WHY detect() AND NOT route(). route() collapses every bid to a winner and
// throws the rest away, which is exactly the information this step needs. The
// registry's own comment says so: "A caller that wants to notice an undecidable
// file … compares the top two bids from detect() instead." This is that caller.
// It costs nothing extra — route() calls detect() internally anyway.
//
// THE FALLBACK. The last registered reader is the fallback, by the contract in
// readers/index.ts: "Readers with a schema come first; the transcript reader is
// last because it is the fallback." So when the winner reads nothing, the
// fallback gets a turn, and text — which is what is left when nothing else
// claims a file — becomes a proposal rather than an error. That is why the
// fallback is found by position rather than imported by name: EX-P12 adds
// readers, and none of them should have to be taught about this file.
//
// SOURCE-CODE DOWNLOADS ARE NOT FALLEN BACK ON. The fallback triggers on
// `unrecognised` and on nothing else. A reader that says `source_only` has
// recognised the file and knows what is wrong with it, and quietly re-reading a
// package.json as a chat transcript would turn that five-word explanation into
// a proposal full of nothing — the precise failure `source_only` exists to
// prevent. It stays a failure, and the caller gets the contract's wording.
//
// NOTHING HERE READS THE CONVERSATION FOR MEANING. A bid is a number and a line
// about structure. Text inside the import is not an instruction to this code,
// and the reader that wins does not win by saying so.
// -----------------------------------------------------------------------------

/**
 * The bid below which a win is a guess rather than a reading.
 *
 * Above ROUTING_FLOOR the file is claimed, so it is read; below 0.3 the claim
 * is weak enough that a creator should be told before they open the result.
 * The two readers registered today bid 0.15 apiece on JSON carrying no marker,
 * which is under this and a tie besides — the substrate's own way of saying
 * "undecidable".
 */
export const UNCERTAIN_BELOW = 0.3;

/** The prefix the row carries, and the one the upload page tests for (EX-P09). */
const UNCERTAIN_PREFIX = "uncertain:";

/** True when a stored detection_reason was written by an uncertain routing. */
export function isUncertainReason(reason: string | null): boolean {
  return (reason ?? "").trimStart().toLowerCase().startsWith(UNCERTAIN_PREFIX);
}

/** "transcript bid 0.15 (Valid JSON. …)" — a reader's id, its number, its own words. */
function bidLine(routing: Routing): string {
  return `${routing.reader.id} bid ${routing.detection.confidence.toFixed(2)} ` +
    `(${routing.detection.reason})`;
}

/**
 * What was tried, from the top two bids, and who ended up reading it.
 *
 * The reasons are the readers' own lines, quoted rather than summarised: this
 * ends up in front of a creator, and "what was seen" is the only thing that
 * lets them judge whether the routing was reasonable.
 */
function uncertainReason(best: Routing, runnerUp: Routing | undefined, readBy: string): string {
  const tried = runnerUp ? `${bidLine(best)}, ${bidLine(runnerUp)}` : bidLine(best);
  return `${UNCERTAIN_PREFIX} ${tried}; read with ${readBy}.`;
}

/** A parse, the line that goes on the row, and whether it came with a caveat. */
export interface ImportRouting {
  result: ReaderResult;
  /** The winner's own line, or "uncertain: <what was tried>". Never conversation text. */
  reason: string;
  uncertain: boolean;
}

/**
 * Route one import: every reader bids, the best one reads, and the fallback
 * catches what it could not read.
 *
 * Returns null only for an empty registry, which `intakeRegistry()` never is.
 * An outcome of `unrecognised` on the way out means every reader including the
 * fallback found nothing — a genuinely empty import, and the one case that
 * still fails as unrecognised.
 */
export function routeImport(
  registry: ReaderRegistry,
  file: IntakeFile,
  options: ParseOptions,
): ImportRouting | null {
  const bids = registry.detect(file);
  const [best, runnerUp] = bids;
  if (!best) return null;

  // Below the floor nothing claimed the file at all. That is a refusal rather
  // than an uncertainty, so it is not dressed up as one — but it is still read,
  // because the fallback below may yet make something of it.
  const claimed = best.detection.confidence >= ROUTING_FLOOR;
  const tied = runnerUp !== undefined &&
    runnerUp.detection.confidence === best.detection.confidence;
  let uncertain = claimed && (best.detection.confidence < UNCERTAIN_BELOW || tied);

  let result = best.reader.parse(file, options);

  // THE FALLBACK, on `unrecognised` and nothing else. `source_only` is a
  // recognised file with a known problem and is returned as it stands.
  if (result.outcome === READ_OUTCOME.UNRECOGNISED) {
    const readers = registry.readers();
    const fallback = readers[readers.length - 1];
    if (fallback && fallback.id !== best.reader.id) {
      const second = fallback.parse(file, options);
      if (second.outcome !== READ_OUTCOME.UNRECOGNISED) {
        result = second;
        // The winner bid highest and then read nothing. Whatever the numbers
        // said, that routing was uncertain.
        uncertain = true;
      }
    }
  }

  return {
    result,
    reason: uncertain
      ? uncertainReason(best, runnerUp, result.reader.id)
      : best.detection.reason,
    uncertain,
  };
}

// -----------------------------------------------------------------------------
// buildgallery_finish_import
// -----------------------------------------------------------------------------

const FinishImportInput = z
  .object({
    import_id: z.uuid().describe("The handle from buildgallery_begin_import."),
    expected_chunks: z
      .number()
      .int()
      .min(1)
      .describe("How many chunks were sent in total, numbered from 1, e.g. 9."),
  })
  .strict();

const SecretFindingOutput = z.object({
  kind: z.string().describe('The kind of secret redacted, e.g. "openai_key". Never the value.'),
  count: z.number().int().describe("How many of that kind were redacted, e.g. 1."),
});

const FinishImportOutput = z.object({
  import_id: z.string().describe("The import's id."),
  status: z.string().describe('The import\'s state after this call: "parsed".'),
  reused: z
    .boolean()
    .describe("True when the import was already parsed and this call changed nothing."),
  reader: z.object({
    id: z.string().describe('The intake reader that handled it, e.g. "transcript".'),
    label: z.string().describe('That reader\'s label, e.g. "Pasted chat transcript".'),
    reason: z
      .string()
      .describe('One line on what the reader saw, e.g. "Split as markdown_bold into 48 turns." Begins "uncertain:" when routing could not decide, and then names the top two bids.'),
    outcome: z.string().describe('What the reader made of the text: "session".'),
    uncertain: z
      .boolean()
      .describe("True when routing could not decide which reader the text belonged to, so the structure may be rougher than usual."),
  }),
  turn_count: z.number().int().describe("Turns the parse found, e.g. 48."),
  event_count: z.number().int().describe("Events the parse proposed, e.g. 31."),
  node_count: z.number().int().describe("Parts the parse proposed, e.g. 6."),
  secret_findings: z
    .array(SecretFindingOutput)
    .describe("Kinds and counts of secrets redacted, e.g. [{kind: \"openai_key\", count: 1}]. Empty when none. Never a value."),
  total_chars: z.number().int().describe("Characters assembled from the chunks, e.g. 212000."),
  declared_chars: z.number().int().nullable().describe("Characters the caller declared at begin_import, or null."),
  declared_turns: z.number().int().nullable().describe("Turns the caller declared at begin_import, or null."),
  warnings: z
    .array(z.string())
    .describe("Plain warnings, e.g. that fewer characters arrived than were declared, or that routing was uncertain so the structure may be rougher than usual. Empty when none."),
  target: z
    .object({
      id: z.string().describe("The draft this import will join."),
      title: z.string().nullable().describe("That draft's title, or null if it could not be read."),
    })
    .nullable()
    .describe("The draft named at begin_import, or null for a new build."),
  review_url: z.string().describe(`Where the import is waiting: ${COMPOSE_NEW_HTTPS_URL}.`),
  chunks_removed: z
    .boolean()
    .describe("Whether the chunk objects were removed from storage after the parse."),
});

const FINISH_IMPORT_DESCRIPTION =
  `${VERBATIM_INSTRUCTION} ` +
  "Assembles the numbered chunks of an open import, redacts secrets, parses " +
  "the result, and parks it for the creator to review on the upload page. " +
  "Use it once, after the last chunk is acknowledged, with expected_chunks " +
  "set to the total number of chunks sent; the draft it joins, if any, was " +
  "named at buildgallery_begin_import. It never creates a build, never " +
  "publishes, never edits anything the creator already has, and never " +
  "decides what matters — selection is the creator's act, later, in their " +
  "browser. It returns the import's id, its state, which reader handled it " +
  "and why, counts of what the parse proposed (events, parts, turns), the " +
  "kinds and counts of any secrets redacted, and the address where the " +
  "import is waiting; it never returns the conversation text. See " +
  "outputSchema for the shape.";

interface FinishRow {
  id: string;
  status: string;
  source_hint: string | null;
  chunk_count: number;
  total_chars: number;
  declared_turns: number | null;
  declared_chars: number | null;
  reader_id: string | null;
  detection_reason: string | null;
  secret_findings: RedactFinding[] | null;
  error: string | null;
  target_build_id: string | null;
  turn_count: number | null;
  event_count: number | null;
  node_count: number | null;
}

/**
 * What finish_import reads before it decides anything. As with the status
 * tool, three counts are lifted out of the proposal by JSON path so that a
 * retry on an already-parsed import can repeat its summary without the
 * envelope leaving the database.
 */
const FINISH_COLUMNS =
  "id, status, source_hint, chunk_count, total_chars, declared_turns, declared_chars, " +
  "reader_id, detection_reason, secret_findings, error, target_build_id, " +
  "turn_count:proposal->summary->turn_count, " +
  "event_count:proposal->summary->event_count, " +
  "node_count:proposal->summary->node_count";

/** Everything the finish summary is built from. Counts, kinds and ids; never text. */
interface FinishFacts {
  import_id: string;
  reused: boolean;
  reader: { id: string; label: string; reason: string; outcome: string; uncertain: boolean };
  turn_count: number;
  event_count: number;
  node_count: number;
  secret_findings: RedactFinding[];
  total_chars: number;
  declared_chars: number | null;
  declared_turns: number | null;
  target: { id: string; title: string | null } | null;
  chunks_removed: boolean;
}

/**
 * The plain warning the step asks for when what arrived is more than the
 * ratio short of what the caller declared. Null when nothing was declared or
 * the shortfall is within the ratio.
 */
function shortfallWarning(what: string, got: number, declared: number | null): string | null {
  if (declared === null || declared <= 0) return null;
  if (got >= declared * (1 - SHORTFALL_WARNING_RATIO)) return null;
  const percent = Math.round((1 - got / declared) * 100);
  return `Warning: ${fmt(got)} ${what} arrived but ${fmt(declared)} were declared, ${percent}% short. ` +
    "The calling tool may have shortened the conversation; if so, send it again from the file as a new import.";
}

/**
 * The one sentence an uncertain routing adds (EX-P11).
 *
 * It says what the creator will actually notice — rougher structure — rather
 * than what the registry noticed, and it is the same promise the upload page
 * makes about the same import, so the two surfaces do not contradict each
 * other. It rides in `warnings` so both faces of the reply carry it from one
 * place; the shortfalls come first, because a short import has lost text and
 * this one has only lost tidiness.
 */
const UNCERTAIN_NOTE =
  "It was hard to tell what kind of conversation this is, so the structure may be rougher than usual.";

/** The markdown face and the structured face of a finished import, together. */
function finishSummary(facts: FinishFacts) {
  const warnings = [
    shortfallWarning("characters", facts.total_chars, facts.declared_chars),
    shortfallWarning("turns", facts.turn_count, facts.declared_turns),
    facts.reader.uncertain ? UNCERTAIN_NOTE : null,
  ].filter((w): w is string => w !== null);

  const output = {
    import_id: facts.import_id,
    status: "parsed",
    reused: facts.reused,
    reader: facts.reader,
    turn_count: facts.turn_count,
    event_count: facts.event_count,
    node_count: facts.node_count,
    secret_findings: facts.secret_findings,
    total_chars: facts.total_chars,
    declared_chars: facts.declared_chars,
    declared_turns: facts.declared_turns,
    warnings,
    target: facts.target,
    review_url: COMPOSE_NEW_HTTPS_URL,
    chunks_removed: facts.chunks_removed,
  };

  const findings = facts.secret_findings.length
    ? facts.secret_findings.map((f) => `${f.kind} ×${f.count}`).join(", ")
    : "none";
  const declaredChars = facts.declared_chars === null ? "not declared" : `${fmt(facts.declared_chars)} declared`;
  const declaredTurns = facts.declared_turns === null ? "not declared" : `${facts.declared_turns} declared`;
  const parts = `${facts.node_count} part${facts.node_count === 1 ? "" : "s"}`;
  const lines = [
    facts.reused
      ? `# Import ${facts.import_id} was already parsed and is waiting for review; nothing was changed`
      : `# Import ${facts.import_id} is parsed and waiting for review`,
    "",
    `- **Reader**: ${facts.reader.label} (${facts.reader.id}) — ${facts.reader.reason}`,
    `- **Proposed**: ${facts.event_count} events, ${parts} from ${facts.turn_count} turns`,
    `- **Secrets redacted**: ${findings}`,
    `- **Characters**: ${fmt(facts.total_chars)} assembled, ${declaredChars}`,
    `- **Turns**: ${facts.turn_count} found, ${declaredTurns}`,
    `- **Target**: ${
      facts.target
        ? `draft ${facts.target.title === null ? "" : `"${facts.target.title}" `}(${facts.target.id})`
        : "a new build"
    }`,
  ];
  for (const warning of warnings) lines.push("", warning);
  if (!facts.chunks_removed) {
    lines.push("", "The chunk objects could not be removed from storage; they expire with the import.");
  }
  lines.push("", `Review it at ${COMPOSE_NEW_HTTPS_URL}`);

  return ok(lines.join("\n"), output);
}

/** The target draft's title, through the caller's own client; null when it cannot be read. */
async function readTargetTitle(supabase: CallerClient, targetId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("builds")
    .select("id, title")
    .eq("id", targetId)
    .maybeSingle();
  if (error) {
    logFailure("finish_import: target read", error);
    return null;
  }
  return data?.title ?? null;
}

interface WaitingTwin {
  id: string;
  created_at: string;
}

/**
 * IDEMPOTENCY, MECHANISM THREE. Another of the caller's imports with the same
 * content hash that is still waiting for review. RLS scopes the read to the
 * caller; the status filter is what "waiting" means, and it matches the
 * partial unique index that backs this check under a race.
 */
async function findWaitingTwin(
  supabase: CallerClient,
  contentHash: string,
  importId: string,
): Promise<WaitingTwin | null> {
  const { data, error } = await supabase
    .from("import_sessions")
    .select("id, created_at")
    .eq("content_hash", contentHash)
    .eq("status", "parsed")
    .neq("id", importId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// buildgallery_get_import_status
// -----------------------------------------------------------------------------

const GetImportStatusInput = z
  .object({
    import_id: z.uuid().describe("The handle from buildgallery_begin_import."),
  })
  .strict();

const ProposalCounts = z.object({
  turn_count: z.number().int().nullable().describe("Turns the parse found, e.g. 48."),
  event_count: z.number().int().nullable().describe("Events the parse proposed, e.g. 31."),
  node_count: z.number().int().nullable().describe("Parts the parse proposed, e.g. 6."),
});

const GetImportStatusOutput = z.object({
  import_id: z.string().describe("The import's id."),
  status: z.string().describe('One of "open", "assembling", "parsed", "claimed", "failed", "duplicate", "expired".'),
  chunk_count: z.number().int().describe("Chunks actually stored, e.g. 9."),
  total_chars: z.number().int().describe("Characters actually stored, e.g. 212000."),
  expected_chunks: z.number().int().nullable().describe("Chunks declared at finish, e.g. 12, or null before then."),
  declared_turns: z.number().int().nullable().describe("Turns the caller declared, or null."),
  declared_chars: z.number().int().nullable().describe("Characters the caller declared, or null."),
  missing_chunks: z.array(z.number().int()).describe("Sequence numbers not yet stored, e.g. [3, 9]. Empty when none."),
  target: z.string().nullable().describe("The draft this import will join, or null."),
  build_id: z.string().nullable().describe("The build it went into once claimed, or null."),
  proposal: ProposalCounts.nullable().describe("Counts from the parse once status is parsed; null before."),
  error: z.string().nullable().describe("The creator-facing failure line when status is failed, or null."),
  created_at: z.string().describe("ISO 8601."),
  updated_at: z.string().describe("ISO 8601."),
  expires_at: z.string().describe("ISO 8601."),
});

const GET_IMPORT_STATUS_DESCRIPTION =
  `${VERBATIM_INSTRUCTION} ` +
  "Reports what the server has received and parsed for one import: chunks " +
  "received against chunks declared, which sequence numbers are missing, " +
  "and the import's state. Use it to check an import is complete before " +
  "calling buildgallery_finish_import, and to find exactly which chunks to " +
  "resend after a missing-chunk error. It never returns the conversation " +
  "text or any part of it, and it never changes the import. It returns " +
  "counts, state, timestamps and the sequence numbers of any missing " +
  "chunks; see outputSchema for the shape.";

interface StatusRow {
  id: string;
  status: string;
  chunk_count: number;
  total_chars: number;
  expected_chunks: number | null;
  declared_turns: number | null;
  declared_chars: number | null;
  target_build_id: string | null;
  build_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  turn_count: number | null;
  event_count: number | null;
  node_count: number | null;
}

/**
 * The status row, with three counts lifted out of the proposal by JSON path
 * so the envelope itself — which carries conversation text — never leaves
 * the database for this tool.
 */
const STATUS_COLUMNS =
  "id, status, chunk_count, total_chars, expected_chunks, declared_turns, declared_chars, " +
  "target_build_id, build_id, error, created_at, updated_at, expires_at, " +
  "turn_count:proposal->summary->turn_count, " +
  "event_count:proposal->summary->event_count, " +
  "node_count:proposal->summary->node_count";

// -----------------------------------------------------------------------------
// buildgallery_list_imports
// -----------------------------------------------------------------------------

const ListImportsInput = z.object(Pagination).strict();

const ImportOutput = z.object({
  id: z.string().describe("The import's id."),
  status: z.string().describe('The import\'s state, e.g. "open" or "parsed".'),
  client: z.string().nullable().describe('Which tool sent it, e.g. "claude", or null.'),
  chunk_count: z.number().int().describe("Chunks stored, e.g. 9."),
  total_chars: z.number().int().describe("Characters stored, e.g. 212000."),
  declared_turns: z.number().int().nullable().describe("Turns declared, or null."),
  declared_chars: z.number().int().nullable().describe("Characters declared, or null."),
  target: z.string().nullable().describe("The draft it will join, or null."),
  created_at: z.string().describe("ISO 8601."),
  expires_at: z.string().describe("ISO 8601."),
});

const ListImportsOutput = z.object({
  imports: z.array(ImportOutput).describe("This page of imports, newest first."),
  count: z.number().int().describe("How many imports are on this page."),
  offset: z.number().int().describe("The offset this page started at."),
  ...PageFields,
});

const LIST_IMPORTS_DESCRIPTION =
  `${VERBATIM_INSTRUCTION} ` +
  "Lists the creator's recent imports and their states, newest first. Use " +
  "it to recover an import_id the caller has lost, to see whether a " +
  "conversation was already sent, and to check how many imports are still " +
  "open before starting another. It never returns the conversation text, " +
  "never lists another account's imports, and never deletes or expires " +
  "anything. It returns one page of imports — id, state, when created, " +
  "counts — with total_count, has_more and next_offset; see outputSchema " +
  "for the shape.";

interface ImportRow {
  id: string;
  status: string;
  client: string | null;
  chunk_count: number;
  total_chars: number;
  declared_turns: number | null;
  declared_chars: number | null;
  target_build_id: string | null;
  created_at: string;
  expires_at: string;
}

const IMPORT_LIST_COLUMNS =
  "id, status, client, chunk_count, total_chars, declared_turns, declared_chars, " +
  "target_build_id, created_at, expires_at";

// -----------------------------------------------------------------------------
// The server
// -----------------------------------------------------------------------------

/** What the guard hands a tool: the caller's trace context, and finish_import's record. */
interface CallProbe {
  trace: TraceFacts | null;
  /** Opens the record the guard emits however the call ends. finish_import calls it once. */
  finish(importId: string, expectedChunks: number): FinishCall;
}

/** The import a call's arguments name, read by that one key; the monitor drops anything but a uuid. */
function importIdOf(args: unknown): unknown {
  return typeof args === "object" && args !== null ? (args as Record<string, unknown>).import_id : undefined;
}

/**
 * Builds the server for one request, closed over that request's caller.
 *
 * One server per request is the only shape the connector uses: the protocol
 * handshake is gone and nothing is held between exchanges. The client is
 * passed in rather than reached for, so a tool cannot acquire a wider one.
 * Tools are registered in the contract's order, so tools/list is
 * deterministic. The monitor is passed in too (EX-P16); by default it is the
 * real one, configured from the environment.
 */
export function buildServer(
  supabase: CallerClient,
  caller: CallerIdentity,
  now: () => number = Date.now,
  monitor: Monitor = createMonitor(),
): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: `${CONNECTOR_STATEMENT} ${VERBATIM_INSTRUCTION}` },
  );

  const readOnly = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  const write = { ...readOnly, readOnlyHint: false };

  // THE GUARD (EX-P16). Every tool runs inside it. The SDK answers a tool that
  // throws by itself, with the raw error message as the tool's text, and passes
  // nothing to onerror — so a throw would put an internal message in front of
  // the caller and be reported nowhere. Here it is reported by class and code,
  // with the caller's id and the import the call named, and the caller gets
  // errUnexpected. The guard also reads the caller's trace context off _meta
  // once, and emits finish_import's record in `finally`, so every finish_import
  // writes its line however it ends. It never reads an argument but import_id.
  function guard<A>(tool: string, run: (args: A, probe: CallProbe) => Promise<ToolReply>) {
    return async (args: A, ctx: ServerContext): Promise<ToolReply> => {
      const trace = traceFrom(ctx?.mcpReq?._meta);
      const opened: { call?: FinishCall } = {};
      const probe: CallProbe = {
        trace,
        finish: (importId, expectedChunks) =>
          (opened.call = new FinishCall(importId, caller.id, expectedChunks, trace)),
      };

      try {
        return await run(args, probe);
      } catch (error) {
        // A finish_import that threw before it set an outcome had not claimed
        // the row — everything after the claim has its own catch — so nothing
        // was changed.
        if (opened.call && opened.call.outcome === null) opened.call.end("rejected", "internal", error);
        await monitor.unhandled({
          where: tool,
          user_id: caller.id,
          import_id: importIdOf(args),
          error: errorFacts(error),
          trace,
        });
        return fail(errUnexpected(tool));
      } finally {
        if (opened.call) await monitor.finishCall(opened.call);
      }
    };
  }

  // --- buildgallery_whoami ---------------------------------------------------
  server.registerTool(
    "buildgallery_whoami",
    {
      title: "Who am I on buildgallery",
      description: WHOAMI_DESCRIPTION,
      inputSchema: WhoamiInput,
      outputSchema: WhoamiOutput,
      annotations: readOnly,
    },
    guard("buildgallery_whoami", async () => {
      const displayName = await readDisplayName(supabase, caller.id);

      const output = {
        user_id: caller.id,
        email: caller.email,
        display_name: displayName,
        connector: CONNECTOR_STATEMENT,
      };

      const text = [
        `# ${displayName ?? "buildgallery account"}`,
        "",
        `- **Account id**: ${caller.id}`,
        `- **Email**: ${caller.email ?? "not on this token"}`,
        `- **Display name**: ${displayName ?? "not set"}`,
        "",
        CONNECTOR_STATEMENT,
      ].join("\n");

      return ok(text, output);
    }),
  );

  // --- buildgallery_list_drafts ----------------------------------------------
  server.registerTool(
    "buildgallery_list_drafts",
    {
      title: "List my drafts on buildgallery",
      description: LIST_DRAFTS_DESCRIPTION,
      inputSchema: ListDraftsInput,
      outputSchema: ListDraftsOutput,
      annotations: readOnly,
    },
    guard("buildgallery_list_drafts", async ({ limit, offset, response_format }) => {
      // Their own creator_id and status = 'draft', through their own client:
      // RLS would hide other people's drafts anyway, but the filter is what
      // keeps published work — readable by everyone — out of this list.
      const { data, error, count } = await supabase
        .from("builds")
        .select("id, title, updated_at, build_nodes(count)", { count: "exact" })
        .eq("creator_id", caller.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1)
        .limit(limit)
        .overrideTypes<DraftRow[], { merge: false }>();

      if (error) {
        logFailure("list_drafts", error);
        return fail(ERR_LIST_FAILED);
      }

      const drafts = (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        last_touched: row.updated_at,
        part_count: row.build_nodes?.[0]?.count ?? 0,
      }));
      const output = { drafts, count: drafts.length, offset, ...page(offset, drafts.length, count) };

      if (response_format === "json") return ok(JSON.stringify(output, null, 2), output);

      const at = now();
      const lines = [`# Your drafts (${drafts.length} of ${output.total_count})`, ""];
      if (!drafts.length) lines.push("No unpublished drafts. Omit target_build_id to create a new build.");
      for (const d of drafts) {
        const parts = `${d.part_count} part${d.part_count === 1 ? "" : "s"}`;
        lines.push(`- **${d.title}** (${d.id}) — last touched ${humanTime(d.last_touched, at)}, ${parts}`);
      }
      if (output.has_more) lines.push("", `More: pass offset ${output.next_offset} for the next page.`);

      return ok(lines.join("\n"), output);
    }),
  );

  // --- buildgallery_begin_import ---------------------------------------------
  server.registerTool(
    "buildgallery_begin_import",
    {
      title: "Begin an import into buildgallery",
      description: BEGIN_IMPORT_DESCRIPTION,
      inputSchema: BeginImportInput,
      outputSchema: BeginImportOutput,
      annotations: write,
    },
    guard("buildgallery_begin_import", async ({ client, source_hint, fingerprint, declared_turns, declared_chars, target_build_id }) => {
      // EX-P13. Expire the caller's own overdue imports FIRST, so the ceiling
      // trigger on the insert below counts a current picture rather than a
      // stale one. It is best-effort and never fails the open; see
      // expireOverdueImports.
      await expireOverdueImports(supabase, caller.id, new Date(now()).toISOString());

      // A target is verified before anything is written: it must exist, be
      // the caller's own, and still be a draft. Anything else is one of the
      // two draft errors, and no row is created.
      if (target_build_id) {
        const { data: build, error } = await supabase
          .from("builds")
          .select("id, status")
          .eq("id", target_build_id)
          .eq("creator_id", caller.id)
          .maybeSingle();

        if (error) {
          logFailure("begin_import: target read", error);
          return fail(ERR_IMPORT_NOT_OPENED);
        }
        if (!build) return fail(ERR_DRAFT_NOT_FOUND);
        if (build.status !== "draft") return fail(ERR_TARGET_PUBLISHED);
      }

      const respond = (opened: OpenedImport, reused: boolean) => {
        const output = {
          import_id: opened.id,
          chunk_size_chars: CHUNK_SIZE_CHARS,
          max_total_chars: MAX_TOTAL_CHARS,
          target: opened.target_build_id,
          instructions: beginInstructions(opened.target_build_id),
          reused,
        };
        const head = reused
          ? `Import ${opened.id} was already open for this conversation (created ` +
            `${humanTime(opened.created_at, now())}); nothing new was created. Continue with it.`
          : `Import ${opened.id} is open.`;
        const text = [
          head,
          "",
          `- **Chunk size**: ${fmt(CHUNK_SIZE_CHARS)} characters (hard limit ${fmt(MAX_CHUNK_CHARS)})`,
          `- **Total ceiling**: ${fmt(MAX_TOTAL_CHARS)} characters`,
          `- **Target**: ${opened.target_build_id ? `draft ${opened.target_build_id}` : "a new build"}`,
          "",
          output.instructions,
        ].join("\n");
        return ok(text, output);
      };

      // IDEMPOTENCY, MECHANISM ONE. The same fingerprint, still live, is the
      // same import. Looked up first; and if two begins race past the lookup,
      // the partial unique index refuses the second insert and it is looked
      // up again rather than reported.
      try {
        if (fingerprint) {
          const existing = await findLiveImport(supabase, fingerprint);
          if (existing) return respond(existing, true);
        }

        const { data: created, error } = await supabase
          .from("import_sessions")
          .insert({
            user_id: caller.id,
            client: normaliseClient(client),
            source_hint: source_hint ?? null,
            fingerprint: fingerprint ?? null,
            declared_turns: declared_turns ?? null,
            declared_chars: declared_chars ?? null,
            target_build_id: target_build_id ?? null,
            status: "open",
          })
          .select("id, target_build_id, created_at")
          .single();

        if (error) {
          if (error.code === UNIQUE_VIOLATION && fingerprint) {
            const existing = await findLiveImport(supabase, fingerprint);
            if (existing) return respond(existing, true);
          }
          throw error;
        }

        return respond(created, false);
      } catch (error) {
        // EX-P13. A ceiling refusal is the ONE database error whose message is
        // safe — and required — to hand back untouched, because the trigger
        // raises the contract's error-table wording itself. Recognised by its
        // SQLSTATE, never by matching the text: the text is the payload.
        //
        // This is not a hole in "no internal errors to the caller". The
        // migration owns that string; nothing of Postgres's own is in it, no
        // detail, no hint, no position, and no conversation content can reach
        // it because the trigger sees only counts. Every other error still
        // becomes the table's generic wording below.
        //
        // The insert raised, so the statement wrote nothing: no half-written
        // row, and no silent success either — the caller is told the ceiling
        // and what to do about it.
        const ceiling = ceilingMessage(error);
        if (ceiling) return fail(ceiling);

        logFailure("begin_import", error);
        return fail(ERR_IMPORT_NOT_OPENED);
      }
    }),
  );

  // --- buildgallery_append_chunk ---------------------------------------------
  server.registerTool(
    "buildgallery_append_chunk",
    {
      title: "Append a chunk to a buildgallery import",
      description: APPEND_CHUNK_DESCRIPTION,
      inputSchema: AppendChunkInput,
      outputSchema: AppendChunkOutput,
      annotations: write,
    },
    guard("buildgallery_append_chunk", async ({ import_id, seq, text }) => {
      const chars = text.length;
      if (chars > MAX_CHUNK_CHARS) return fail(errChunkTooLarge(seq, chars));

      const { data: row, error: readError } = await supabase
        .from("import_sessions")
        .select("id, status")
        .eq("id", import_id)
        .maybeSingle();

      if (readError) {
        logFailure("append_chunk: import read", readError);
        return fail(errChunkNotStored(seq));
      }
      if (!row) return fail(ERR_IMPORT_NOT_FOUND);
      if (row.status !== "open") return fail(errImportClosed(import_id, row.status));

      // The ceiling is checked against what the bucket holds, in the unit the
      // bucket measures, less the slot this chunk would replace — so a retry
      // of chunk 7 is not counted twice, and the row's CHECK constraint is
      // never the thing that says no.
      let before: StoredChunk[];
      try {
        before = await listChunks(supabase, caller.id, import_id);
      } catch (error) {
        logFailure("append_chunk: list before", error);
        return fail(errChunkNotStored(seq));
      }
      const projected = sumSizes(before.filter((c) => c.seq !== seq)) + byteLength(text);
      if (projected > MAX_TOTAL_CHARS) return fail(errTotalExceeded(projected));

      // IDEMPOTENCY, MECHANISM TWO. Upsert on the path, which is (import_id,
      // seq): a retried chunk lands in the same slot.
      const { error: uploadError } = await supabase.storage
        .from(IMPORTS_BUCKET)
        .upload(chunkPath(caller.id, import_id, seq), new Blob([text], { type: "text/plain" }), {
          contentType: "text/plain",
          upsert: true,
        });

      if (uploadError) {
        logFailure("append_chunk: upload", uploadError);
        return fail(errChunkNotStored(seq));
      }

      // Recount from the bucket, not from arithmetic: the counts on the row
      // are what is actually stored.
      let after: StoredChunk[];
      try {
        after = await listChunks(supabase, caller.id, import_id);
      } catch (error) {
        logFailure("append_chunk: list after", error);
        return fail(errCountsNotUpdated(seq));
      }
      const chunks_so_far = after.length;
      const chars_so_far = sumSizes(after);

      const { error: updateError } = await supabase
        .from("import_sessions")
        .update({
          chunk_count: chunks_so_far,
          total_chars: chars_so_far,
          updated_at: new Date(now()).toISOString(),
        })
        .eq("id", import_id);

      if (updateError) {
        logFailure("append_chunk: recount", updateError);
        return fail(errCountsNotUpdated(seq));
      }

      const output = { received: seq, chunk_chars: chars, chunks_so_far, chars_so_far };
      const text_ = `Chunk ${seq} stored (${fmt(chars)} characters). ` +
        `${chunks_so_far} chunk${chunks_so_far === 1 ? "" : "s"}, ${fmt(chars_so_far)} characters so far.`;
      return ok(text_, output);
    }),
  );

  // --- buildgallery_finish_import --------------------------------------------
  server.registerTool(
    "buildgallery_finish_import",
    {
      title: "Finish an import into buildgallery",
      description: FINISH_IMPORT_DESCRIPTION,
      inputSchema: FinishImportInput,
      outputSchema: FinishImportOutput,
      annotations: write,
    },
    guard("buildgallery_finish_import", async ({ import_id, expected_chunks }, probe) => {
      // EX-P16. This call's record: how it ended, the step it stopped at, its
      // counts and how long it took. The guard emits it however the call ends.
      const call = probe.finish(import_id, expected_chunks);

      const { data: row, error: readError } = await supabase
        .from("import_sessions")
        .select(FINISH_COLUMNS)
        .eq("id", import_id)
        .maybeSingle()
        .overrideTypes<FinishRow, { merge: false }>();

      if (readError) {
        logFailure("finish_import: import read", readError);
        call.end("rejected", "read_failed", readError);
        return fail(ERR_FINISH_NOT_STARTED);
      }
      if (!row) {
        call.end("rejected", "not_found");
        return fail(ERR_IMPORT_NOT_FOUND);
      }
      call.see(row);

      const stamp = () => new Date(now()).toISOString();
      const registry = intakeRegistry();

      // A finish retried on an import already parsed repeats its summary and
      // changes nothing: the chunks are gone and the proposal is waiting.
      if (row.status === "parsed") {
        call.end("replayed", null);
        let chunks_removed = false;
        try {
          chunks_removed = (await listChunks(supabase, caller.id, import_id)).length === 0;
        } catch (listError) {
          logFailure("finish_import: replay list", listError);
        }
        const readerId = row.reader_id ?? "unknown";
        return finishSummary({
          import_id,
          reused: true,
          reader: {
            id: readerId,
            label: registry.reader(readerId)?.label ?? readerId,
            reason: row.detection_reason ?? "",
            outcome: READ_OUTCOME.SESSION,
            // Read back off the row through the same predicate the fresh path
            // writes with, so a replay cannot disagree with the first reply.
            uncertain: isUncertainReason(row.detection_reason),
          },
          turn_count: row.turn_count ?? 0,
          event_count: row.event_count ?? 0,
          node_count: row.node_count ?? 0,
          secret_findings: row.secret_findings ?? [],
          total_chars: row.total_chars,
          declared_chars: row.declared_chars,
          declared_turns: row.declared_turns,
          target: row.target_build_id
            ? { id: row.target_build_id, title: await readTargetTitle(supabase, row.target_build_id) }
            : null,
          chunks_removed,
        });
      }
      if (row.status === "assembling") {
        call.end("rejected", "being_assembled");
        return fail(errImportBeingAssembled(import_id));
      }
      if (row.status !== "open") {
        call.end("rejected", "not_finishable");
        // A failed or duplicate row already carries its creator-facing line,
        // which names the next action; anything else gets the generic one.
        return fail(row.error ?? errImportNotFinishable(import_id, row.status));
      }

      // THE CLAIM. open -> assembling, conditioned on the row still being
      // open, so two finishes racing on one import cannot both assemble it:
      // the second sees no row come back and is told to wait.
      call.stage = "claiming";
      const { data: claimed, error: claimError } = await supabase
        .from("import_sessions")
        .update({ status: "assembling", expected_chunks, error: null, updated_at: stamp() })
        .eq("id", import_id)
        .eq("status", "open")
        .select("id")
        .maybeSingle();

      if (claimError) {
        logFailure("finish_import: claim", claimError);
        call.end("rejected", "claim_failed", claimError);
        return fail(ERR_FINISH_NOT_STARTED);
      }
      if (!claimed) {
        call.end("rejected", "being_assembled");
        return fail(errImportBeingAssembled(import_id));
      }

      // From here the row is `assembling` and this call owns it. Every exit
      // below writes a terminal state through settle(); the catch at the end
      // writes `failed` for anything that throws, so nothing leaves the row
      // mid-assembly.
      const settle = async (patch: ImportSessionPatch): Promise<void> => {
        const { error } = await supabase
          .from("import_sessions")
          .update({ ...patch, updated_at: stamp() })
          .eq("id", import_id);
        if (error) throw error;
      };
      // What was measured so far, written onto a failed or duplicate row too:
      // counts, kinds and a hash, never the text.
      let measured: ImportSessionPatch = {};
      const failWith = async (why: string, reason: FinishReason): Promise<ReturnType<typeof fail>> => {
        await settle({ ...measured, status: "failed", error: why });
        call.end("failed", reason);
        return fail(why);
      };
      const duplicateOf = async (twin: WaitingTwin, seqs: number[]) => {
        const why = errDuplicate(twin.id, twin.created_at, now());
        await settle({ ...measured, status: "duplicate", error: why });
        call.end("duplicate", null);
        await removeChunks(supabase, caller.id, import_id, seqs);
        return fail(why);
      };

      try {
        // 1. Every declared chunk, and nothing else. A gap or a surplus sends
        // the row BACK TO OPEN — not to failed — with the table's wording,
        // because that wording tells the caller to resend with append_chunk,
        // and append_chunk accepts only an open import. Nothing is parsed.
        call.stage = "checking chunks";
        const chunks = await listChunks(supabase, caller.id, import_id);
        const missing = missingSeqs(chunks, expected_chunks);
        call.see({ chunk_count: chunks.length, total_chars: sumSizes(chunks) });
        if (missing.length > 0 || chunks.length !== expected_chunks) {
          const why = missing.length > 0
            ? errChunksMissing(missing, expected_chunks)
            : errChunksExtra(chunks.length, expected_chunks);
          await settle({ status: "open", error: why });
          call.end("refused", missing.length > 0 ? "chunks_missing" : "chunks_extra");
          return fail(why);
        }

        // 2. Numeric order — listChunks sorted by seq as a number, never as a
        // string — and one string. The ceiling is enforced on characters of
        // the assembled text; the bucket measured bytes.
        call.stage = "joining chunks";
        const seqs = chunks.map((c) => c.seq);
        const assembled = (await readChunks(supabase, caller.id, import_id, seqs)).join("");
        const assembledChars = assembled.length;
        call.see({ total_chars: assembledChars });
        measured = { chunk_count: chunks.length };
        if (assembledChars > MAX_TOTAL_CHARS) return await failWith(errTotalExceeded(assembledChars), "too_large");
        measured = { ...measured, total_chars: assembledChars };

        // 3. Redact, once, before the reader, the hash or anything else reads
        // the text. From here `assembled` is not used again. Timed: this and
        // the parse are where the CPU goes.
        call.stage = "redacting";
        const { text: redacted, findings } = call.compute(() => redactSecrets(assembled));
        measured = { ...measured, secret_findings: findings };

        // 4. Hash the redacted text. The same conversation already waiting for
        // review is a duplicate: this row is marked, its chunks go, and the
        // caller is pointed at the import that is already there.
        call.stage = "hashing";
        const contentHash = await sha256Hex(redacted);
        measured = { ...measured, content_hash: contentHash };
        const twin = await findWaitingTwin(supabase, contentHash, import_id);
        if (twin) return await duplicateOf(twin, seqs);

        // 5. Route, and degrade rather than refuse (EX-P11). routeImport reads
        // every bid, parses with the winner, and hands the fallback whatever
        // the winner could not read — so the reason recorded here says how the
        // decision was reached, not just who won. No filename: detection reads
        // content only.
        call.stage = "routing";
        const file = intakeFile(redacted);
        const routed = call.compute(() =>
          routeImport(registry, file, {
            session_id: import_id,
            source_hint: row.source_hint,
          })
        );
        if (!routed) return await failWith(ERR_UNRECOGNISED, "unrecognised");
        const result = routed.result;
        call.see({ reader_id: result.reader.id });
        measured = {
          ...measured,
          reader_id: result.reader.id,
          detection_reason: routed.reason,
        };
        // A source-code download is recognised, not unreadable: the reader knows
        // what it is and says so. The caller gets the contract's wording; the
        // reader's own line stays on the row.
        if (result.outcome === READ_OUTCOME.SOURCE_ONLY) return await failWith(ERR_UNPARSEABLE, "source_only");
        // Everything, including the fallback, found nothing. Only a genuinely
        // empty import reaches this line.
        if (result.outcome === READ_OUTCOME.UNRECOGNISED) return await failWith(ERR_UNRECOGNISED, "unrecognised");

        // 6. Park the envelope unchanged. If the partial unique index refuses
        // the hash, a twin landed between the lookup and this write: that is
        // the duplicate case, found again rather than reported as an error.
        call.stage = "parking";
        const { error: parsedError } = await supabase
          .from("import_sessions")
          .update({
            ...measured,
            status: "parsed",
            proposal: result.envelope,
            error: null,
            updated_at: stamp(),
          })
          .eq("id", import_id);
        if (parsedError) {
          if (parsedError.code === UNIQUE_VIOLATION) {
            const late = await findWaitingTwin(supabase, contentHash, import_id);
            if (late) return await duplicateOf(late, seqs);
          }
          throw parsedError;
        }
        call.end("parsed", null);
        const chunks_removed = await removeChunks(supabase, caller.id, import_id, seqs);

        // 7. The summary: counts, kinds, a reason and an address. Never text.
        call.stage = "summarising";
        return finishSummary({
          import_id,
          reused: false,
          reader: {
            id: result.reader.id,
            label: result.reader.label,
            reason: routed.reason,
            outcome: result.outcome,
            uncertain: routed.uncertain,
          },
          turn_count: result.envelope.summary.turn_count,
          event_count: result.envelope.summary.event_count,
          node_count: result.envelope.summary.node_count,
          secret_findings: findings,
          total_chars: assembledChars,
          declared_chars: row.declared_chars,
          declared_turns: row.declared_turns,
          target: row.target_build_id
            ? { id: row.target_build_id, title: await readTargetTitle(supabase, row.target_build_id) }
            : null,
          chunks_removed,
        });
      } catch (error) {
        logFailure("finish_import", error);
        try {
          await settle({ ...measured, status: "failed", error: ERR_FINISH_FAILED });
          call.end("failed", "internal", error);
        } catch (settleError) {
          logFailure("finish_import: settle", settleError);
          // The row could not be moved out of assembling: the stuck import
          // Part 8 of the manual describes, reported as exactly that.
          call.end("stuck", "internal", error);
        }
        return fail(ERR_FINISH_FAILED);
      }
    }),
  );

  // --- buildgallery_get_import_status ----------------------------------------
  server.registerTool(
    "buildgallery_get_import_status",
    {
      title: "Check a buildgallery import",
      description: GET_IMPORT_STATUS_DESCRIPTION,
      inputSchema: GetImportStatusInput,
      outputSchema: GetImportStatusOutput,
      annotations: readOnly,
      _meta: { "anthropic/maxResultSizeChars": 20000 },
    },
    guard("buildgallery_get_import_status", async ({ import_id }) => {
      const { data: row, error } = await supabase
        .from("import_sessions")
        .select(STATUS_COLUMNS)
        .eq("id", import_id)
        .maybeSingle()
        .overrideTypes<StatusRow, { merge: false }>();

      if (error) {
        logFailure("get_import_status", error);
        return fail(ERR_LIST_FAILED);
      }
      if (!row) return fail(ERR_IMPORT_NOT_FOUND);

      // Gaps are only meaningful while chunks may still arrive.
      let missing_chunks: number[] = [];
      if (row.status === "open") {
        try {
          missing_chunks = missingSeqs(
            await listChunks(supabase, caller.id, import_id),
            row.expected_chunks,
          );
        } catch (listError) {
          logFailure("get_import_status: list", listError);
          return fail(ERR_LIST_FAILED);
        }
      }

      const parsed = row.status === "parsed";
      const output = {
        import_id: row.id,
        status: row.status,
        chunk_count: row.chunk_count,
        total_chars: row.total_chars,
        expected_chunks: row.expected_chunks,
        declared_turns: row.declared_turns,
        declared_chars: row.declared_chars,
        missing_chunks,
        target: row.target_build_id,
        build_id: row.build_id,
        proposal: parsed
          ? { turn_count: row.turn_count, event_count: row.event_count, node_count: row.node_count }
          : null,
        error: row.error,
        created_at: row.created_at,
        updated_at: row.updated_at,
        expires_at: row.expires_at,
      };

      const at = now();
      const lines = [
        `# Import ${row.id}`,
        "",
        `- **Status**: ${row.status}`,
        `- **Stored**: ${row.chunk_count} chunk${row.chunk_count === 1 ? "" : "s"}, ${fmt(row.total_chars)} characters`,
        `- **Declared**: ${row.declared_turns ?? "?"} turns, ${row.declared_chars === null ? "?" : fmt(row.declared_chars)} characters` +
        (row.expected_chunks === null ? "" : `, ${row.expected_chunks} chunks`),
        `- **Missing chunks**: ${missing_chunks.length ? missing_chunks.join(", ") : "none"}`,
        `- **Target**: ${row.target_build_id ? `draft ${row.target_build_id}` : "a new build"}`,
      ];
      if (parsed) {
        lines.push(
          `- **Proposed**: ${row.event_count ?? "?"} events, ${row.node_count ?? "?"} parts from ${row.turn_count ?? "?"} turns`,
        );
      }
      if (row.error) lines.push(`- **Failure**: ${row.error}`);
      lines.push(
        `- **Created**: ${humanTime(row.created_at, at)}`,
        `- **Expires**: ${humanTime(row.expires_at, at)}`,
      );

      return ok(lines.join("\n"), output);
    }),
  );

  // --- buildgallery_list_imports ---------------------------------------------
  server.registerTool(
    "buildgallery_list_imports",
    {
      title: "List my buildgallery imports",
      description: LIST_IMPORTS_DESCRIPTION,
      inputSchema: ListImportsInput,
      outputSchema: ListImportsOutput,
      annotations: readOnly,
    },
    guard("buildgallery_list_imports", async ({ limit, offset, response_format }) => {
      // No user_id filter: the SELECT policy is the filter, and the planner
      // applies it against the (user_id, status, created_at) index.
      const { data, error, count } = await supabase
        .from("import_sessions")
        .select(IMPORT_LIST_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)
        .limit(limit)
        .overrideTypes<ImportRow[], { merge: false }>();

      if (error) {
        logFailure("list_imports", error);
        return fail(ERR_LIST_FAILED);
      }

      const imports = (data ?? []).map((row) => ({
        id: row.id,
        status: row.status,
        client: row.client,
        chunk_count: row.chunk_count,
        total_chars: row.total_chars,
        declared_turns: row.declared_turns,
        declared_chars: row.declared_chars,
        target: row.target_build_id,
        created_at: row.created_at,
        expires_at: row.expires_at,
      }));
      const output = { imports, count: imports.length, offset, ...page(offset, imports.length, count) };

      if (response_format === "json") return ok(JSON.stringify(output, null, 2), output);

      const at = now();
      const lines = [`# Your imports (${imports.length} of ${output.total_count})`, ""];
      if (!imports.length) lines.push("No imports yet. Call buildgallery_begin_import to open one.");
      for (const i of imports) {
        lines.push(
          `- **${i.status}** (${i.id}) — ${i.chunk_count} chunk${i.chunk_count === 1 ? "" : "s"}, ` +
            `${fmt(i.total_chars)} characters, from ${i.client ?? "an unknown client"}, ` +
            `created ${humanTime(i.created_at, at)}, expires ${humanTime(i.expires_at, at)}` +
            (i.target ? `, into draft ${i.target}` : ""),
        );
      }
      if (output.has_more) lines.push("", `More: pass offset ${output.next_offset} for the next page.`);

      return ok(lines.join("\n"), output);
    }),
  );

  return server;
}

/**
 * One authenticated request, from the verified caller to the MCP response.
 *
 * EX-P16. Two failures land here that no tool sees: the SDK failing to handle
 * a request, which it answers itself with a 5xx after telling onerror, and
 * anything thrown out of the handler altogether. Both are reported as
 * unhandled, with the caller's id and the error's class and code. A client's
 * malformed request — a 4xx — is logged by class as before and not reported:
 * it is the client's fault, and reporting it would bury ours. This is split
 * out of the default export so the path can be tested without a real token;
 * `build` is there for the same reason.
 */
export async function serveCaller(
  req: Request,
  supabase: CallerClient,
  caller: CallerIdentity,
  monitor: Monitor = createMonitor(),
  build: typeof buildServer = buildServer,
): Promise<Response> {
  const seen: ErrorFacts[] = [];
  try {
    const handler = createMcpHandler(
      () => build(supabase, caller, Date.now, monitor),
      {
        // Sizes, counts, states and ids only. Never conversation content.
        onerror: (error: unknown) => {
          console.error(
            "mcp request failed",
            error instanceof Error ? error.name : "unknown",
          );
          seen.push(errorFacts(error));
        },
      },
    );

    const res = await handler.fetch(req);
    if (res.status >= 500) {
      await monitor.unhandled({
        where: "request",
        user_id: caller.id,
        error: seen[seen.length - 1] ?? null,
        http_status: res.status,
      });
    }
    return res;
  } catch (error) {
    await monitor.unhandled({ where: "request", user_id: caller.id, error: errorFacts(error), http_status: 500 });
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error" } },
      { status: 500 },
    );
  }
}

export default {
  fetch: pipeline(
    [withOAuthProtectedResource(), withSupabase<Database>({ auth: "user" })],
    async (req: Request, ctx): Promise<Response> => {
      // withSupabase has already rejected anything without a verified user
      // JWT, so userClaims is present by the time this runs. The guard below
      // is not redundant defence: without it a missing claim would become the
      // empty string, and an empty string is a value a query will happily run
      // with. An identity this function cannot name is a 401, never a lookup.
      const userId = ctx.userClaims?.id;
      if (!userId) {
        return Response.json(
          { error: "unauthenticated" },
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }

      const caller: CallerIdentity = {
        id: userId,
        email: ctx.userClaims?.email ?? null,
      };

      return await serveCaller(req, ctx.supabase, caller);
    },
  ),
};
