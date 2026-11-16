// G1: a read that never answers becomes a failed read after READ_TIMEOUT_MS, everywhere.
//
// WHERE. `createSiteFetch` is the fetch the Supabase client is created with (src/integrations/supabase/client.ts), so
// every request the client makes passes through it: tables, database functions, Edge Functions, storage and auth. Only
// reads are cut (`isRead`, below); a write, an upload, a token refresh and any Edge Function but the one named read are
// passed through untouched (G2). Realtime is a websocket and never comes here.
//
// WHAT IS TIMED. The whole answer: the response and its body. A body that arrives slowly is as unanswered, to the
// person waiting, as a response that never starts, so the body is read here, inside the limit, and handed on whole.
//
// A TIMEOUT IS TOLD APART FROM A CANCEL. A read cut by the limit rejects with ReadTimeoutError, which the client turns
// into an ordinary failed request (PostgREST keeps its name in the message: "ReadTimeoutError: …"); `isReadTimeout`
// recognises it either way, and the query client does not retry it (D3). A read the caller cancels (the page went, the
// query was cancelled) rejects with the caller's own AbortError, exactly as before, and stays silent.

import { READ_RPCS } from "./readRpcs";

/** How long a read may take, response and body, before it is a failed read. */
export const READ_TIMEOUT_MS = 10_000;

export const READ_TIMEOUT_NAME = "ReadTimeoutError";

/** A read the limit cut. Not an AbortError: a deliberate cancel is one, and is silent; this is a failure. */
export class ReadTimeoutError extends Error {
  readonly readTimeout = true;
  constructor(ms: number) {
    super(`no answer after ${ms} ms`);
    this.name = READ_TIMEOUT_NAME;
  }
}

const MAX_DEPTH = 5;

/** Whether `error`, or anything it wraps (a cause, an Edge Function error's context), is a read the limit cut. */
export function isReadTimeout(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH && current && typeof current === "object"; depth += 1) {
    const candidate = current as { name?: unknown; message?: unknown; readTimeout?: unknown; cause?: unknown; context?: unknown };
    if (candidate.readTimeout === true || candidate.name === READ_TIMEOUT_NAME) return true;
    // PostgREST's form: the thrown error survives as "<name>: <message>", and a wrapper may put its own words in front
    // ("listHandles failed: ReadTimeoutError: …").
    if (typeof candidate.message === "string" && candidate.message.includes(`${READ_TIMEOUT_NAME}:`)) return true;
    current = candidate.cause ?? candidate.context;
  }
  return false;
}

/**
 * For a wrapper that makes its own error from the client's (socialError, postLayerError, SettingsError …): the cause to
 * give it. A read the limit cut gets a fresh ReadTimeoutError, so it is still known as one and is not retried; anything
 * else gets nothing. Never the database's own error: its details and hint can quote what a person wrote.
 */
export function timeoutCause(error: unknown): { cause?: ReadTimeoutError } {
  return isReadTimeout(error) ? { cause: new ReadTimeoutError(READ_TIMEOUT_MS) } : {};
}

/** Edge Functions that are reads, by name, and how to tell the read call from the others. */
const READ_FUNCTIONS: Record<string, (body: Record<string, unknown> | null) => boolean> = {
  // Settings › Account › devices. The same function also signs a device out, which is not a read.
  "my-sessions": (body) => body?.action === "list",
};

function bodyObject(body: unknown): Record<string, unknown> | null {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Whether a request is a read, and so gets the limit. Everything else goes through untouched (G2). */
export function isRead(url: string, method: string, body?: unknown): boolean {
  let path: string;
  try {
    path = new URL(url, "http://local.invalid").pathname;
  } catch {
    return false;
  }
  const verb = method.toUpperCase();
  if (path.startsWith("/rest/v1/rpc/")) {
    if (verb === "GET" || verb === "HEAD") return true;
    return READ_RPCS.has(decodeURIComponent(path.slice("/rest/v1/rpc/".length)));
  }
  if (path.startsWith("/rest/v1/")) return verb === "GET" || verb === "HEAD";
  if (path.startsWith("/functions/v1/")) {
    const test = READ_FUNCTIONS[decodeURIComponent(path.slice("/functions/v1/".length))];
    return test ? test(bodyObject(body)) : false;
  }
  if (path.startsWith("/storage/v1/")) {
    // Signing and listing are reads. Uploads are not, and nor is a download: a file's size is the maker's, not ours.
    return verb === "POST" && /^\/storage\/v1\/object\/(sign|list)\//.test(path);
  }
  // The member and what hangs off them (the connected apps' grants): reads. A token refresh or a sign-out is not.
  if (path.startsWith("/auth/v1/")) return verb === "GET" && (path === "/auth/v1/user" || path.startsWith("/auth/v1/user/"));
  return false;
}

/** The fetch the Supabase client is created with: reads are cut at `limit`, everything else is the base fetch. */
export function createSiteFetch(base: () => typeof fetch = () => globalThis.fetch, limit: number = READ_TIMEOUT_MS): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
    if (!isRead(url, method, init?.body)) return base()(input, init);

    const controller = new AbortController();
    const outer = init?.signal ?? (typeof input === "object" && "signal" in input ? input.signal : undefined) ?? undefined;
    const cancel = () => controller.abort(outer?.reason);
    if (outer?.aborted) cancel();
    else outer?.addEventListener("abort", cancel, { once: true });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const limitReached = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new ReadTimeoutError(limit);
        controller.abort(error);
        reject(error);
      }, limit);
    });
    const answer = (async () => {
      const response = await base()(input, { ...init, signal: controller.signal });
      // The body is read inside the limit, then handed on whole.
      const bytes = method.toUpperCase() === "HEAD" || response.status === 204 ? null : await response.arrayBuffer();
      return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
    })();
    try {
      return await Promise.race([answer, limitReached]);
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", cancel);
      // The loser of the race must not surface as an unhandled rejection.
      answer.catch(() => undefined);
      limitReached.catch(() => undefined);
    }
  };
}
