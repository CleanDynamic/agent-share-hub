// The one place an error is reported (CA-29 Part 7).
//
// WHAT IT DOES. `reportError(error, context)` keeps the last 50 errors in memory
// (`recentErrors`), prints each in development, and sends each to Sentry when
// VITE_SENTRY_DSN is set. With no DSN nothing is sent and Sentry's code is never
// requested: it is a dynamic import, made on the first report that has a DSN.
//
// WHAT IT KEEPS AND SENDS. The kind of error (its name), its code (a Postgres,
// PostgREST or HTTP code, `errorCode`) and the context the caller gives: where it
// happened, as identifiers. Never the error's message or its request: a message
// can quote what the page was drawing (a prompt's text, a post, a search), and
// user-authored text stays out of every log (CONTRACT §9; neoscale-error-monitoring
// › Privacy). Sentry gets a copy whose message is the kind and code, with the
// stack frames and nothing else, and `beforeSend` strips whatever the SDK adds.
//
// IT NEVER THROWS. It is called from error handlers; a failure here would hide
// the failure it was told about.

import { errorCode } from "@/lib/errors/code";

/** Where the error happened, as identifiers. Nothing a user wrote. */
export interface ErrorContext {
  /** "boundary", "query", "mutation", "window.error", "unhandledrejection", or a feature's own name. */
  source: string;
  /** Which boundary caught it: "app", "route" or a panel name. */
  boundary?: string;
  /** The page's path. */
  route?: string;
  /** A query or mutation key's first two segments, which name the domain and the function. */
  key?: string;
}

export interface ReportedError {
  at: number;
  name: string;
  code?: string;
  context: ErrorContext;
}

const KEEP = 50;
const recent: ReportedError[] = [];

/** The last 50 errors, oldest first. */
export function recentErrors(): readonly ReportedError[] {
  return [...recent];
}

/** For tests. */
export function resetReportedErrors(): void {
  recent.length = 0;
}

function kindOf(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return typeof error;
}

// ─── Sentry, only when there is a DSN ───────────────────────────────────────

type SentryModule = typeof import("@sentry/react");
let sentry: Promise<SentryModule | null> | null = null;

/** The parts of a Sentry event this module reads; anything else passes through. */
interface EventLike {
  message?: unknown;
  request?: unknown;
  breadcrumbs?: unknown;
  extra?: unknown;
  contexts?: unknown;
  user?: { id?: unknown } | null;
  exception?: { values?: Record<string, unknown>[] } | null;
  [key: string]: unknown;
}

/** The event with everything a user could have written taken out; identifiers stay. */
export function scrubEvent<T extends EventLike>(event: T): T {
  const { message: _message, request: _request, breadcrumbs: _breadcrumbs, extra: _extra, contexts: _contexts, user, exception, ...rest } = event;
  const scrubbed: EventLike = { ...rest };
  if (user && typeof user === "object" && "id" in user) scrubbed.user = { id: user.id };
  if (exception?.values) scrubbed.exception = { ...exception, values: exception.values.map((value) => ({ ...value, value: undefined })) };
  return scrubbed as T;
}

function loadSentry(dsn: string): Promise<SentryModule | null> {
  if (!sentry) {
    sentry = import("@sentry/react")
      .then((module) => {
        module.init({
          dsn,
          environment: import.meta.env.MODE,
          // Nothing about the person or their requests: identifiers come from the tags reportError sets.
          dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
          // No performance tracing, no replay, no breadcrumbs: only errors, and only identifiers.
          tracesSampleRate: 0,
          beforeSend: (event) => scrubEvent(event as unknown as EventLike) as never,
          beforeBreadcrumb: () => null,
        });
        return module;
      })
      .catch(() => null);
  }
  return sentry;
}

function copyForSentry(name: string, code: string | undefined, original: unknown): Error {
  const copy = new Error(code ? `${name} ${code}` : name);
  copy.name = name;
  // The frames, without the first line, which is where an Error's message sits.
  const stack = original instanceof Error && typeof original.stack === "string" ? original.stack : "";
  const frames = stack.split("\n").filter((line) => /^\s+at\s/.test(line) || /@/.test(line));
  copy.stack = [`${name}${code ? ` ${code}` : ""}`, ...frames].join("\n");
  return copy;
}

export function reportError(error: unknown, context: ErrorContext): void {
  try {
    const name = kindOf(error);
    const code = errorCode(error);
    recent.push({ at: Date.now(), name, ...(code ? { code } : {}), context });
    if (recent.length > KEEP) recent.splice(0, recent.length - KEEP);

    if (import.meta.env.DEV) {
      console.error(`[error] ${name}${code ? ` ${code}` : ""} (${context.source})`, context, error);
    }

    const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
    if (!dsn) return;
    void loadSentry(dsn).then((module) => {
      if (!module) return;
      const tags: Record<string, string> = { source: context.source };
      if (context.boundary) tags.boundary = context.boundary;
      if (context.route) tags.route = context.route;
      if (context.key) tags.key = context.key;
      if (code) tags.code = code;
      module.captureException(copyForSentry(name, code, error), { tags });
    });
  } catch {
    // Reporting must never be the failure.
  }
}
