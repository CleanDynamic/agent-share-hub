// =============================================================================
// buildgallery — mcp monitor (EX-P16 observability)
// =============================================================================
// When something breaks, the connector says so, rather than a creator finding
// out. One rule outranks the rest: a creator's conversation never leaves the
// database. Not into a log line, not into an error report, not into a trace.
//
// AN ALLOW-LIST, NOT A SCRUBBER. Nothing here takes an object and strips the
// dangerous parts out of it. Every log line this file writes and every event it
// sends is built field by field from named values, and every value is checked
// against the one shape it may have — a uuid, a count, a state from a closed
// list, a reader id, an error's class name — before it is used. A value that
// does not fit is dropped, never truncated. So there is no way to hand this
// file a conversation, a chunk, a proposal, a secret finding or an error
// message and have it go anywhere: no field exists that would carry it.
//
// That is the stricter of two rules, chosen on purpose. The error-monitoring
// skill says to deny-list the platform's keys by name; the contract forbids
// those names appearing in this folder at all, and a test scans for them. An
// allow-list needs no names: what is not listed cannot leave.
//
// WHAT IS REPORTED. A finish_import that ends failed, or is left stuck in
// assembling (errors); a finish_import refused for missing or extra chunks,
// which puts the import back to open for a resend (a warning); a tool that
// throws; and a request the SDK could not handle at all. Every finish_import
// also writes one line to the log, whatever happened, with how long it took.
//
// WHERE IT GOES. Every report is written to the function's own log first,
// always, so it can be read by asking Lovable. When the SENTRY_DSN secret is
// set, the same facts go to Sentry as one event, posted in Sentry's envelope
// format with fetch: no SDK and no dependency, so no global scope, no automatic
// breadcrumbs, no request bodies and no stack traces — nothing leaves that this
// file did not build. The address comes from the secret and from nowhere else.
// On the edge the post rides EdgeRuntime.waitUntil, so no caller waits on it;
// a post that fails is logged by status and dropped.
//
// CPU TIME. The runtime does not tell a function its own CPU time: in
// Supabase's edge runtime process.cpuUsage() is a stub that returns zeros, and
// the EdgeRuntime object a function sees carries waitUntil and nothing else.
// The platform records CPU per worker itself, as cpu_time_used on the worker's
// shutdown log event. What this file records for each finish_import is
// duration_ms, the wall clock from the call to its reply, and compute_ms, the
// wall clock spent inside the two CPU-bound steps, redacting and parsing. Those
// run synchronously on the isolate's one thread, so their wall time is CPU time
// in all but name — and they are the part of the 2-second CPU budget the
// 400,000-character ceiling exists to protect.
//
// TRACE CONTEXT. The 2026-07-28 revision carries W3C trace context in a
// request's _meta: traceparent, tracestate, baggage. The SDK hands _meta to a
// tool as ctx.mcpReq._meta, raw and unvalidated; it exports the three key names
// and does nothing else with them. traceparent is checked against the W3C
// format and, when valid, its trace id and parent span id ride on every report,
// so an event joins the caller's trace. tracestate and baggage are free-form
// values the calling client chose, and the contract allows sizes, counts,
// states and ids only, so they are counted and never forwarded.
// =============================================================================

import {
  BAGGAGE_META_KEY,
  TRACEPARENT_META_KEY,
  TRACESTATE_META_KEY,
} from "@modelcontextprotocol/server";

import { MONITOR_SEND_TIMEOUT_MS, SENTRY_DSN_ENV, SERVER_NAME, SERVER_VERSION } from "./constants.ts";

// -----------------------------------------------------------------------------
// The vocabulary. Every value a report may carry is on a closed list or has a
// fixed shape.
// -----------------------------------------------------------------------------

/** The seven states the import_sessions CHECK admits. */
export const IMPORT_STATUSES = [
  "open",
  "assembling",
  "parsed",
  "claimed",
  "failed",
  "duplicate",
  "expired",
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** How one finish_import call ended. */
export const FINISH_OUTCOMES = [
  "parsed", // parked for the creator to review
  "replayed", // it was already parsed; the summary was repeated and nothing changed
  "duplicate", // the same conversation is already waiting; this import was marked duplicate
  "refused", // chunks missing or extra; the import went back to open for a resend
  "failed", // the import ended failed
  "stuck", // the import could not be moved out of assembling
  "rejected", // nothing was changed: not found, not finishable, busy, or unreadable
] as const;
export type FinishOutcome = (typeof FINISH_OUTCOMES)[number];

/** Why a call did not end parsed. One per wording a caller can be given. */
export const FINISH_REASONS = [
  "chunks_missing",
  "chunks_extra",
  "too_large",
  "unrecognised",
  "source_only",
  "internal",
  "not_found",
  "not_finishable",
  "being_assembled",
  "read_failed",
  "claim_failed",
] as const;
export type FinishReason = (typeof FINISH_REASONS)[number];

/** finish_import's steps, in order. A call that stops names the step it stopped at. */
export const FINISH_STAGES = [
  "reading",
  "claiming",
  "checking chunks",
  "joining chunks",
  "redacting",
  "hashing",
  "routing",
  "parking",
  "summarising",
] as const;
export type FinishStage = (typeof FINISH_STAGES)[number];

/** Where each outcome leaves the import. `rejected` changed nothing, so it keeps what was read. */
const OUTCOME_STATUS: Partial<Record<FinishOutcome, ImportStatus>> = {
  parsed: "parsed",
  replayed: "parsed",
  duplicate: "duplicate",
  refused: "open",
  failed: "failed",
  stuck: "assembling",
};

/** The outcomes that are reported, and how loudly. Every other outcome is logged only. */
const REPORTED: Partial<Record<FinishOutcome, "error" | "warning">> = {
  failed: "error",
  stuck: "error",
  refused: "warning",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRACE_ID = /^[0-9a-f]{32}$/;
const SPAN_ID = /^[0-9a-f]{16}$/;
/** A registered reader's id: "transcript", "lovable", "claude". */
const READER_ID = /^[a-z][a-z0-9_-]{0,31}$/;
/** An error's class name: "TypeError", "StorageApiError". One capitalised word. */
const ERROR_NAME = /^[A-Z][A-Za-z0-9_]{0,63}$/;
/** An error's code: a SQLSTATE ("23505"), a PostgREST code ("PGRST116"), "BGCAP", a JSON-RPC number. */
const ERROR_CODE = /^-?[A-Z0-9_]{1,40}$/;
/** Where an unhandled error happened: a tool's name, or the request itself. */
const WHERE = /^(?:buildgallery_[a-z_]{1,40}|request)$/;
/** What the platform puts in SB_REGION, SB_EXECUTION_ID, DENO_DEPLOYMENT_ID. No dots, so never a JWT. */
const PLATFORM_VALUE = /^[A-Za-z0-9_-]{1,128}$/;

function oneOf<T extends string>(value: unknown, list: readonly T[]): T | null {
  return typeof value === "string" && (list as readonly string[]).includes(value) ? value as T : null;
}

function shaped(value: unknown, shape: RegExp): string | null {
  return typeof value === "string" && shape.test(value) ? value : null;
}

function uuidOrNull(value: unknown): string | null {
  return shaped(value, UUID)?.toLowerCase() ?? null;
}

function countOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function httpStatusOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

/** A duration, as whole milliseconds. */
function ms(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

// -----------------------------------------------------------------------------
// Errors: a class name, a code and a status. Never a message.
// -----------------------------------------------------------------------------

/** What may be said about an error. */
export interface ErrorFacts {
  name: string | null;
  code: string | null;
  status: number | null;
}

const NO_ERROR: ErrorFacts = { name: null, code: null, status: null };

/**
 * The facts of an error, read by name from the three fields that carry no
 * text. `message`, `stack`, `details`, `hint` and `cause` are never read: a
 * database message can quote a value, and a value here can be conversation.
 * A thrown string or number has no facts at all.
 */
export function errorFacts(error: unknown): ErrorFacts {
  if (typeof error !== "object" || error === null) return NO_ERROR;
  const e = error as { name?: unknown; code?: unknown; status?: unknown };
  return {
    name: shaped(e.name, ERROR_NAME),
    code: shaped(typeof e.code === "number" ? String(e.code) : e.code, ERROR_CODE),
    status: httpStatusOrNull(e.status),
  };
}

// -----------------------------------------------------------------------------
// Trace context: W3C traceparent is read; tracestate and baggage are counted.
// -----------------------------------------------------------------------------

/** The trace context a request carried, as ids and counts. */
export interface TraceFacts {
  trace_id: string | null;
  parent_span_id: string | null;
  sampled: boolean | null;
  /** How many tracestate entries arrived. Their values are never forwarded. */
  tracestate_members: number;
  /** How many baggage entries arrived. Their values are never forwarded. */
  baggage_members: number;
}

// The shapes below are the W3C Trace Context and Baggage grammars, with their
// own limits: 32 tracestate entries in 512 characters, 180 baggage entries in
// 8,192 bytes. A value outside the grammar is not trace context and counts 0.
const TRACEPARENT = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(-[\x21-\x7e]*)?$/;
const TRACESTATE_KEY = /^(?:[a-z][_0-9a-z*/-]{0,255}|[a-z0-9][_0-9a-z*/-]{0,240}@[a-z][_0-9a-z*/-]{0,13})$/;
const TRACESTATE_VALUE = /^[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,255}[\x21-\x2b\x2d-\x3c\x3e-\x7e]$/;
const BAGGAGE_KEY = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const BAGGAGE_VALUE = /^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]*$/;

function parseTraceparent(
  value: unknown,
): { trace_id: string; parent_span_id: string; sampled: boolean } | null {
  if (typeof value !== "string" || value.length > 512) return null;
  const match = TRACEPARENT.exec(value);
  if (!match) return null;
  const [, version, traceId, parentId, flags, rest] = match;
  // ff is forbidden, and version 00 is exactly four fields; a later version
  // may add fields, and its first four are read the same way.
  if (version === "ff" || (version === "00" && rest !== undefined)) return null;
  if (/^0+$/.test(traceId) || /^0+$/.test(parentId)) return null;
  return { trace_id: traceId, parent_span_id: parentId, sampled: (parseInt(flags, 16) & 1) === 1 };
}

function countTracestate(value: unknown): number {
  if (typeof value !== "string" || value.length > 512) return 0;
  const members = value.split(",").map((m) => m.replace(/^[ \t]+|[ \t]+$/g, "")).filter((m) => m !== "");
  if (members.length > 32) return 0;
  for (const member of members) {
    const eq = member.indexOf("=");
    if (eq <= 0 || !TRACESTATE_KEY.test(member.slice(0, eq)) || !TRACESTATE_VALUE.test(member.slice(eq + 1))) {
      return 0;
    }
  }
  return members.length;
}

function countBaggage(value: unknown): number {
  if (typeof value !== "string" || new TextEncoder().encode(value).byteLength > 8192) return 0;
  const members = value.split(",");
  if (members.length > 180) return 0;
  for (const raw of members) {
    // Properties after the first ";" belong to the entry and are not counted.
    const entry = raw.split(";")[0].trim();
    const eq = entry.indexOf("=");
    if (eq <= 0) return 0;
    if (!BAGGAGE_KEY.test(entry.slice(0, eq).trim()) || !BAGGAGE_VALUE.test(entry.slice(eq + 1).trim())) return 0;
  }
  return members.length;
}

/**
 * The trace context in a request's _meta, or null when it carried none.
 *
 * tracestate is counted only beside a valid traceparent, because W3C gives it
 * no meaning without one; baggage stands on its own.
 */
export function traceFrom(meta: unknown): TraceFacts | null {
  if (typeof meta !== "object" || meta === null) return null;
  const m = meta as Record<string, unknown>;
  const carried = [TRACEPARENT_META_KEY, TRACESTATE_META_KEY, BAGGAGE_META_KEY].some((key) => Object.hasOwn(m, key));
  if (!carried) return null;

  const parent = parseTraceparent(m[TRACEPARENT_META_KEY]);
  return {
    trace_id: parent?.trace_id ?? null,
    parent_span_id: parent?.parent_span_id ?? null,
    sampled: parent?.sampled ?? null,
    tracestate_members: parent ? countTracestate(m[TRACESTATE_META_KEY]) : 0,
    baggage_members: countBaggage(m[BAGGAGE_META_KEY]),
  };
}

// -----------------------------------------------------------------------------
// One finish_import call
// -----------------------------------------------------------------------------

/** The facts a finish_import call may record. Whatever else the object carries is not read. */
export interface FinishFacts {
  chunk_count?: number | null;
  total_chars?: number | null;
  reader_id?: string | null;
  status?: string | null;
}

/**
 * One finish_import call, from its first line to its reply.
 *
 * The tool fills it in as it goes — the step it has reached, the counts it has
 * measured, how it ended — and the guard in index.ts hands it to the monitor
 * however the call ends, so every call writes exactly one line. It holds ids,
 * counts, states and times, and nothing it is given can make it hold more.
 */
export class FinishCall {
  readonly import_id: string;
  readonly user_id: string;
  readonly expected_chunks: number;
  readonly trace: TraceFacts | null;
  outcome: FinishOutcome | null = null;
  reason: FinishReason | null = null;
  stage: FinishStage = "reading";
  status: string | null = null;
  reader_id: string | null = null;
  chunk_count: number | null = null;
  total_chars: number | null = null;
  error: ErrorFacts | null = null;
  private readonly started = performance.now();
  private computing = 0;

  constructor(importId: string, userId: string, expectedChunks: number, trace: TraceFacts | null) {
    this.import_id = importId;
    this.user_id = userId;
    this.expected_chunks = expectedChunks;
    this.trace = trace;
  }

  /** Runs one synchronous, CPU-bound step and adds its time to compute_ms. */
  compute<T>(step: () => T): T {
    const started = performance.now();
    try {
      return step();
    } finally {
      this.computing += performance.now() - started;
    }
  }

  /** Records what was measured. Takes the four facts by name; nothing else on `facts` is read. */
  see(facts: FinishFacts): void {
    if (facts.chunk_count !== undefined) this.chunk_count = facts.chunk_count;
    if (facts.total_chars !== undefined) this.total_chars = facts.total_chars;
    if (facts.reader_id !== undefined) this.reader_id = facts.reader_id;
    if (facts.status !== undefined) this.status = facts.status;
  }

  /** How the call ended, and why when it did not end parsed. An error is kept as its facts only. */
  end(outcome: FinishOutcome, reason: FinishReason | null, error?: unknown): void {
    this.outcome = outcome;
    this.reason = reason;
    this.status = OUTCOME_STATUS[outcome] ?? this.status;
    this.error = error === undefined ? null : errorFacts(error);
  }

  /** From the call to now: when the guard emits the record, the call's whole duration. */
  get duration_ms(): number {
    return ms(performance.now() - this.started);
  }

  /** Time spent inside compute(): redacting and parsing. */
  get compute_ms(): number {
    return ms(this.computing);
  }
}

// -----------------------------------------------------------------------------
// The monitor
// -----------------------------------------------------------------------------

/** An error nothing else caught: in a tool, or in handling the request itself. */
export interface UnhandledReport {
  /** The tool's name, or "request". */
  where: string;
  user_id: string;
  /** The import the call named, if it named one. Anything but a uuid is dropped. */
  import_id?: unknown;
  error: ErrorFacts | null;
  http_status?: number | null;
  trace?: TraceFacts | null;
}

export interface Monitor {
  /** One log line for every finish_import call, and a report when it failed, was refused, or is stuck. */
  finishCall(call: FinishCall): Promise<void>;
  /** An error nothing else caught: always logged, always reported. */
  unhandled(report: UnhandledReport): Promise<void>;
}

/** What the monitor reads from the environment: the secret and three platform labels. */
export interface MonitorEnv {
  dsn: string | null;
  region: string | null;
  execution_id: string | null;
  deployment_id: string | null;
}

/** Posts one envelope and answers with the HTTP status. */
export type Transport = (url: string, body: string) => Promise<number>;

export type LogLevel = "info" | "warn" | "error";
export type LogSink = (level: LogLevel, line: string) => void;

export interface MonitorOptions {
  env?: MonitorEnv;
  transport?: Transport;
  log?: LogSink;
  /** Epoch milliseconds, for event timestamps. */
  now?: () => number;
  /** Keeps a delivery alive past the reply: on the edge, EdgeRuntime.waitUntil. */
  background?: (delivery: Promise<void>) => Promise<void>;
}

/**
 * The only environment this file reads: the DSN secret and three labels the
 * platform sets. Each label is shape-checked, and the DSN is never written
 * anywhere. Nothing else in the environment is looked at, by name or by list.
 */
export function readMonitorEnv(get: (name: string) => string | undefined = readEnv): MonitorEnv {
  return {
    dsn: get(SENTRY_DSN_ENV)?.trim() || null,
    region: shaped(get("SB_REGION"), PLATFORM_VALUE),
    execution_id: shaped(get("SB_EXECUTION_ID"), PLATFORM_VALUE),
    deployment_id: shaped(get("DENO_DEPLOYMENT_ID"), PLATFORM_VALUE),
  };
}

function readEnv(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

/** Sentry's envelope endpoint for a DSN, with the DSN's public key as auth. */
export interface SentryTarget {
  url: string;
}

const DSN = /^https:\/\/(\w+)(?::\w*)?@([\w.-]+|\[[:.%\w]+\])(?::(\d+))?\/(.+)$/;

/**
 * The address a DSN names, the way Sentry's own SDK derives it. HTTPS only, so
 * a report never travels in the clear; null for anything that is not a DSN.
 */
export function sentryTarget(dsn: string | null): SentryTarget | null {
  if (!dsn) return null;
  const match = DSN.exec(dsn);
  if (!match) return null;
  const [, publicKey, host, port, rest] = match;
  const segments = rest.replace(/\/+$/, "").split("/");
  const projectId = segments.pop() ?? "";
  if (!/^\d+$/.test(projectId)) return null;
  const path = segments.filter((s) => s !== "").join("/");
  const auth = new URLSearchParams({
    sentry_version: "7",
    sentry_key: publicKey,
    sentry_client: `${SERVER_NAME}/${SERVER_VERSION}`,
  });
  return {
    url: `https://${host}${port ? `:${port}` : ""}${path ? `/${path}` : ""}/api/${projectId}/envelope/?${auth}`,
  };
}

/**
 * The real transport: one POST, bounded by MONITOR_SEND_TIMEOUT_MS, its reply
 * discarded. The timer is cleared as soon as the post settles, so a report
 * never keeps the worker alive for longer than the post itself took.
 */
export const fetchTransport: Transport = async (url, body) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MONITOR_SEND_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body,
      signal: controller.signal,
    });
    await res.body?.cancel();
    return res.status;
  } finally {
    clearTimeout(timer);
  }
};

const consoleLog: LogSink = (level, line) => {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

/** On the edge a delivery outlives the reply through EdgeRuntime.waitUntil; anywhere else it is awaited. */
function edgeBackground(delivery: Promise<void>): Promise<void> {
  const edge = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof edge?.waitUntil === "function") {
    edge.waitUntil(delivery);
    return Promise.resolve();
  }
  return delivery;
}

type Line = Record<string, string | number | null>;

/** finish_import's one line. Every field is checked against its shape here, whatever the call holds. */
function finishLine(call: FinishCall, env: MonitorEnv): Line {
  const outcome = oneOf(call.outcome, FINISH_OUTCOMES) ?? "unknown";
  const stopped = outcome !== "parsed" && outcome !== "replayed" && outcome !== "duplicate";
  const error = call.error ?? NO_ERROR;
  return {
    mcp: "finish_import",
    outcome,
    reason: oneOf(call.reason, FINISH_REASONS),
    failed_at: stopped ? oneOf(call.stage, FINISH_STAGES) : null,
    status: oneOf(call.status, IMPORT_STATUSES),
    import_id: uuidOrNull(call.import_id),
    user_id: uuidOrNull(call.user_id),
    reader_id: shaped(call.reader_id, READER_ID),
    chunk_count: countOrNull(call.chunk_count),
    total_chars: countOrNull(call.total_chars),
    expected_chunks: countOrNull(call.expected_chunks),
    duration_ms: call.duration_ms,
    compute_ms: call.compute_ms,
    error_name: shaped(error.name, ERROR_NAME),
    error_code: shaped(error.code, ERROR_CODE),
    error_status: httpStatusOrNull(error.status),
    trace_id: shaped(call.trace?.trace_id, TRACE_ID),
    execution_id: env.execution_id,
  };
}

function unhandledLine(report: UnhandledReport, env: MonitorEnv): Line {
  const error = report.error ?? NO_ERROR;
  return {
    mcp: "unhandled",
    where: shaped(report.where, WHERE) ?? "unknown",
    user_id: uuidOrNull(report.user_id),
    import_id: uuidOrNull(report.import_id),
    error_name: shaped(error.name, ERROR_NAME),
    error_code: shaped(error.code, ERROR_CODE),
    error_status: httpStatusOrNull(error.status),
    http_status: httpStatusOrNull(report.http_status),
    trace_id: shaped(report.trace?.trace_id, TRACE_ID),
    execution_id: env.execution_id,
  };
}

function hexId(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

interface EventParts {
  level: "error" | "warning";
  message: string;
  user_id: string | number | null;
  tags: Line;
  extra: Line;
  trace: TraceFacts | null | undefined;
  fingerprint: string[];
}

/**
 * One Sentry event, from values that have already passed their shape checks.
 * The message is composed from those same values, so it says nothing a field
 * could not. The trace context joins the caller's trace when it sent one.
 */
function sentryEvent(parts: EventParts, env: MonitorEnv, at: number): Record<string, unknown> {
  const tags: Record<string, string> = {};
  const labelled = {
    ...parts.tags,
    region: env.region,
    execution_id: env.execution_id,
    server_version: SERVER_VERSION,
  };
  for (const [key, value] of Object.entries(labelled)) if (value !== null) tags[key] = String(value);

  const extra = Object.fromEntries(Object.entries({
    ...parts.extra,
    tracestate_members: countOrNull(parts.trace?.tracestate_members),
    baggage_members: countOrNull(parts.trace?.baggage_members),
  }).filter(([, value]) => value !== null));

  const traceId = shaped(parts.trace?.trace_id, TRACE_ID);
  const parentSpanId = shaped(parts.trace?.parent_span_id, SPAN_ID);
  return {
    event_id: hexId(16),
    timestamp: at / 1000,
    platform: "javascript",
    level: parts.level,
    logger: SERVER_NAME,
    release: env.deployment_id ?? `${SERVER_NAME}@${SERVER_VERSION}`,
    message: parts.message,
    tags,
    extra,
    ...(typeof parts.user_id === "string" ? { user: { id: parts.user_id } } : {}),
    ...(traceId
      ? {
        contexts: {
          trace: {
            trace_id: traceId,
            span_id: hexId(8),
            op: "mcp.tool",
            ...(parentSpanId ? { parent_span_id: parentSpanId } : {}),
          },
        },
      }
      : {}),
    fingerprint: parts.fingerprint,
  };
}

function finishEvent(line: Line, level: "error" | "warning", trace: TraceFacts | null, env: MonitorEnv, at: number) {
  const where = line.failed_at ?? "an unknown step";
  const why = line.reason ?? "unknown";
  const message = line.outcome === "refused"
    ? `finish_import refused at ${where}: ${why}; the import is open again for a resend`
    : line.outcome === "stuck"
    ? `finish_import stuck in assembling after failing at ${where}: ${why}`
    : `finish_import failed at ${where}: ${why}`;
  return sentryEvent({
    level,
    message,
    user_id: line.user_id,
    tags: {
      event: "finish_import",
      outcome: line.outcome,
      reason: line.reason,
      failed_at: line.failed_at,
      status: line.status,
      reader_id: line.reader_id,
      import_id: line.import_id,
    },
    extra: {
      chunk_count: line.chunk_count,
      total_chars: line.total_chars,
      expected_chunks: line.expected_chunks,
      duration_ms: line.duration_ms,
      compute_ms: line.compute_ms,
      error_name: line.error_name,
      error_code: line.error_code,
      error_status: line.error_status,
    },
    trace,
    fingerprint: ["finish_import", String(line.outcome), String(where), String(why)],
  }, env, at);
}

function unhandledEvent(line: Line, trace: TraceFacts | null | undefined, env: MonitorEnv, at: number) {
  const where = line.where === "request" ? "while handling the request" : `in ${line.where}`;
  return sentryEvent({
    level: "error",
    message: `Unhandled error ${where}${line.error_name ? ` (${line.error_name})` : ""}`,
    user_id: line.user_id,
    tags: { event: "unhandled", where: line.where, error_name: line.error_name, import_id: line.import_id },
    extra: { error_code: line.error_code, error_status: line.error_status, http_status: line.http_status },
    trace,
    fingerprint: ["unhandled", String(line.where), String(line.error_name ?? "unknown")],
  }, env, at);
}

/** Sentry's envelope: a header line, an item header line, and the event. */
function envelope(event: Record<string, unknown>, at: number): string {
  const header = { event_id: event.event_id, sent_at: new Date(at).toISOString() };
  return `${JSON.stringify(header)}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
}

/** Posts one envelope. Never throws: a failed post is logged by status or class and dropped. */
async function deliver(target: SentryTarget, body: string, transport: Transport, log: LogSink): Promise<void> {
  try {
    const status = await transport(target.url, body);
    if (status < 200 || status > 299) {
      log("warn", JSON.stringify({ mcp: "monitor", delivered: false, http_status: status }));
    }
  } catch (error) {
    log("warn", JSON.stringify({ mcp: "monitor", delivered: false, error_name: errorFacts(error).name }));
  }
}

/**
 * The monitor for one request.
 *
 * Neither method ever throws: a report that cannot be built or sent is a line
 * in the log, never a failure of the call it describes. Everything the options
 * replace is there for the tests; on the edge, every default is the real one.
 */
export function createMonitor(options: MonitorOptions = {}): Monitor {
  const env = options.env ?? readMonitorEnv();
  const target = sentryTarget(env.dsn);
  const transport = options.transport ?? fetchTransport;
  const log = options.log ?? consoleLog;
  const now = options.now ?? Date.now;
  const background = options.background ?? edgeBackground;

  const send = async (event: Record<string, unknown>): Promise<void> => {
    if (!target) {
      // Unset is the documented log-only mode. Set but unusable is worth a line.
      if (env.dsn) {
        const reason = `${SENTRY_DSN_ENV} is not a usable https DSN`;
        log("warn", JSON.stringify({ mcp: "monitor", delivered: false, reason }));
      }
      return;
    }
    await background(deliver(target, envelope(event, now()), transport, log));
  };

  // The last resort. It runs inside finishCall's and unhandled's catch, and
  // those run in the guard's `finally`, so it must not throw either: a throw
  // here would replace a tool's reply with the SDK's raw error message.
  const broken = (error: unknown) => {
    try {
      log("error", JSON.stringify({ mcp: "monitor", failed: true, error_name: errorFacts(error).name }));
    } catch {
      // Nothing is left to tell.
    }
  };

  return {
    async finishCall(call) {
      try {
        const line = finishLine(call, env);
        const level = REPORTED[line.outcome as FinishOutcome];
        const quiet = line.outcome === "parsed" || line.outcome === "replayed" || line.outcome === "duplicate";
        log(level === "error" ? "error" : quiet ? "info" : "warn", JSON.stringify(line));
        if (level) await send(finishEvent(line, level, call.trace, env, now()));
      } catch (error) {
        broken(error);
      }
    },

    async unhandled(report) {
      try {
        const line = unhandledLine(report, env);
        log("error", JSON.stringify(line));
        await send(unhandledEvent(line, report.trace, env, now()));
      } catch (error) {
        broken(error);
      }
    },
  };
}
