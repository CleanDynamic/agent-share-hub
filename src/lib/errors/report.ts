// Where an error is told about. SV-01 Part 7.
//
// `reportError(error, context)` is the one door. It keeps the last 50 in memory
// (so a support person can read them from the console in a bad session), prints
// the real error in development, and sends to Sentry only when VITE_SENTRY_DSN is
// set. With no DSN nothing leaves the browser and Sentry's code is never
// downloaded: it is a dynamic import, so it is its own chunk.
//
// WHAT IS NEVER KEPT OR SENT: the error's message, its cause chain's messages,
// any request or response body, and anything a maker wrote. An error message can
// quote what the page was drawing (a prompt, a search, a draft), and
// user-authored text stays out of every log (CONTRACT section 9, and the
// neoscale-error-monitoring skill). What is kept is identifiers and kinds: the
// error's name and code, the route, a source label, ids and node types.

import { errorCode } from "./code";

/** The only keys a report may carry. Anything else a caller passes is dropped. */
const CONTEXT_KEYS = ["source", "route", "context", "buildId", "nodeId", "nodeType", "shape", "userId", "authenticated"] as const;

export interface ReportContext {
  /** Where it was caught: "route-boundary", "query", "window" ... */
  source: string;
  /** The pathname, never the query string. */
  route?: string;
  /** A short label: a panel's name, a query's first key. Never content. */
  context?: string;
  buildId?: string;
  nodeId?: string;
  nodeType?: string;
  shape?: string;
  userId?: string;
  authenticated?: boolean;
}

export interface RecordedError extends ReportContext {
  at: number;
  /** The error's class name: TypeError, PostgrestError ... Not its message. */
  name: string;
  /** A Postgres or PostgREST code, or an HTTP status, when the error carries one. */
  code?: string;
}

const KEEP = 50;
let recent: RecordedError[] = [];

/** Identifiers only: a key outside the list, or a value that is not a short string or boolean, is dropped. */
export function sanitise(context: ReportContext): ReportContext {
  const out: Record<string, string | boolean> = {};
  for (const key of CONTEXT_KEYS) {
    const value = (context as unknown as Record<string, unknown>)[key];
    if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "string" && value.length > 0) out[key] = value.slice(0, 200);
  }
  return out as unknown as ReportContext;
}

function nameOf(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  if (error && typeof error === "object") {
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string" && name) return name;
    return "Object";
  }
  return typeof error;
}

export function recentErrors(): readonly RecordedError[] {
  return recent;
}

export function clearRecentErrors(): void {
  recent = [];
}

export function reportError(error: unknown, context: ReportContext): void {
  const safe = sanitise(context);
  const record: RecordedError = { at: Date.now(), name: nameOf(error), ...safe };
  const code = errorCode(error);
  if (code) record.code = code;
  recent = [...recent, record].slice(-KEEP);

  if (import.meta.env.DEV) console.error("[reportError]", safe.source, error);

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (dsn) void send(dsn, error, record);
}

type SentryModule = typeof import("@sentry/react");
let sentry: Promise<SentryModule> | undefined;

function load(dsn: string): Promise<SentryModule> {
  sentry ??= import("@sentry/react").then((S) => {
    S.init({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      // Console lines and clicks can carry text; the report has what it needs.
      beforeBreadcrumb: () => null,
      beforeSend(event) {
        delete event.request;
        delete event.user;
        delete event.extra;
        return event;
      },
    });
    return S;
  });
  return sentry;
}

async function send(dsn: string, error: unknown, record: RecordedError): Promise<void> {
  try {
    const S = await load(dsn);
    // A new error, so the original's message never travels: its name, its code
    // and its stack frames (file and function names, no text).
    const safe = new Error(record.code ? `${record.name} ${record.code}` : record.name);
    safe.name = record.name;
    const frames = error instanceof Error && error.stack ? error.stack.split("\n").filter((line) => /^\s+at\s|@/.test(line)) : [];
    if (frames.length) safe.stack = `${safe.name}\n${frames.join("\n")}`;
    S.withScope((scope) => {
      const { at: _at, name: _name, code, ...tags } = record;
      scope.setTags({ ...Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, String(v)])), ...(code ? { code } : {}) });
      S.captureException(safe);
    });
  } catch {
    // Reporting must never be the thing that fails.
  }
}
