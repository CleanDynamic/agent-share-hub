// =============================================================================
// buildgallery — mcp (EX-P02 the door skeleton, EX-P04 the lock, EX-P06 the pipe)
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
// =============================================================================

import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { pipeline } from "@supabase/middleware";
import { withOAuthProtectedResource, withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";

import {
  CHUNK_SIZE_CHARS,
  COMPOSE_NEW_URL,
  CONNECTOR_STATEMENT,
  DEFAULT_PAGE_SIZE,
  IMPORTS_BUCKET,
  MAX_CHUNK_CHARS,
  MAX_PAGE_SIZE,
  MAX_TOTAL_CHARS,
  SERVER_NAME,
  SERVER_VERSION,
  STORAGE_LIST_PAGE_SIZE,
  VERBATIM_INSTRUCTION,
} from "./constants.ts";
import type { Database } from "./database.types.ts";

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
  "first, so a conversation can be aimed at one. Use it when the creator " +
  "wants this import to join work they have already started, and always " +
  "before passing a target_build_id — draft ids come from here, never from " +
  "memory or from the conversation text. It never lists published builds, " +
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

/**
 * Builds the server for one request, closed over that request's caller.
 *
 * One server per request is the only shape the connector uses: the protocol
 * handshake is gone and nothing is held between exchanges. The client is
 * passed in rather than reached for, so a tool cannot acquire a wider one.
 * Tools are registered in the contract's order, so tools/list is
 * deterministic.
 */
export function buildServer(
  supabase: CallerClient,
  caller: CallerIdentity,
  now: () => number = Date.now,
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
    async () => {
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
    },
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
    async ({ limit, offset, response_format }) => {
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
    },
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
    async ({ client, source_hint, fingerprint, declared_turns, declared_chars, target_build_id }) => {
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
        logFailure("begin_import", error);
        return fail(ERR_IMPORT_NOT_OPENED);
      }
    },
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
    async ({ import_id, seq, text }) => {
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
    },
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
    async ({ import_id }) => {
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
    },
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
    async ({ limit, offset, response_format }) => {
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
    },
  );

  return server;
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

      const handler = createMcpHandler(
        () => buildServer(ctx.supabase, caller),
        {
          // Sizes, counts, states and ids only. Never conversation content.
          onerror: (error: unknown) => {
            console.error(
              "mcp request failed",
              error instanceof Error ? error.name : "unknown",
            );
          },
        },
      );

      return await handler.fetch(req);
    },
  ),
};
