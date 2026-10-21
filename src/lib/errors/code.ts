// The code a failure carries, for a log line and the small print under "That didn't load." (CA-10).
//
// PostgREST answers with `{ code, message, details, hint }` (57014, 23514, PGRST116 …); the data layer wraps that as
// the `cause` of its own error (`buildLayerError`), and the search functions keep only "code 42501" in the message.
// So the chain is walked, as `isPermissionError` walks it, and the first code found is the one. A network failure has
// no code; an HTTP status, where one is on the chain, stands in for it.

/** How far down a chain of causes to look. */
const MAX_DEPTH = 4;

/** "code 57014", the form the search functions keep a code in. */
const QUOTED_CODE = /\bcode ([0-9A-Z]{5}|PGRST\d{3})\b/;

type Candidate = { code?: unknown; status?: unknown; message?: unknown; cause?: unknown };

function chain(error: unknown): Candidate[] {
  const out: Candidate[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH && current && typeof current === "object"; depth += 1) {
    out.push(current as Candidate);
    current = (current as Candidate).cause;
  }
  return out;
}

/** The failure's code: a Postgres or PostgREST code, else an HTTP status, else undefined. */
export function errorCode(error: unknown): string | undefined {
  const links = chain(error);
  for (const link of links) if (typeof link.code === "string" && link.code.trim() !== "") return link.code.trim();
  for (const link of links) {
    const quoted = typeof link.message === "string" ? QUOTED_CODE.exec(link.message) : null;
    if (quoted) return quoted[1];
  }
  for (const link of links) if (typeof link.status === "number" && link.status > 0) return String(link.status);
  return undefined;
}

/** The HTTP status on the chain, when one is there. */
export function errorStatus(error: unknown): number | undefined {
  for (const link of chain(error)) if (typeof link.status === "number" && link.status > 0) return link.status;
  return undefined;
}

/** The outermost message, on one line. */
export function errorMessage(error: unknown): string {
  for (const link of chain(error)) {
    if (typeof link.message === "string" && link.message !== "") return link.message.replace(/\s+/g, " ").trim();
  }
  return typeof error === "string" ? error : String(error);
}

/** One log line: "[Drafts] drafts read failed 57014 canceling statement due to statement timeout". */
export function errorLine(prefix: string, error: unknown): string {
  return `${prefix} ${errorCode(error) ?? "no-code"} ${errorMessage(error)}`;
}
