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

/* ── CA-10: a save the database refuses ── */

/** HTTP answers a later try can get past. */
const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504, 520]);
/** Codes PostgREST answers those with (a statement timeout, a busy or unreachable database). */
const RETRY_CODES = new Set(["57014", "40001", "40P01", "53300", "53400", "08000", "08003", "08006", "PGRST000", "PGRST001", "PGRST002", "PGRST003"]);

/** A failure that can succeed later: the network, or 408, 429, 500, 502, 503, 504 or 520. Anything else will not. */
export function canSucceedLater(error: unknown): boolean {
  const status = errorStatus(error);
  if (status !== undefined) return RETRY_STATUSES.has(status);
  const code = errorCode(error);
  if (code === undefined) return true;
  return RETRY_CODES.has(code);
}

/** What went wrong, in a few plain words, for "Not saved: {reason}. Code {code}." */
export function shortReason(error: unknown): string {
  const code = errorCode(error);
  const status = errorStatus(error);
  if (code === undefined && status === undefined) return "no connection";
  switch (code) {
    case "23514":
      return "a value isn't allowed";
    case "23502":
      return "something required is missing";
    case "23505":
      return "it clashes with another build";
    case "23503":
      return "it points at something that's gone";
    case "22001":
      return "a field is too long";
    case "42501":
    case "PGRST301":
    case "PGRST302":
      return "you don't have access to this build";
    case "PGRST116":
      return "the build wasn't found";
    case "42703":
    case "PGRST204":
      return "the site and the database disagree";
    case "57014":
      return "the database took too long";
  }
  if (status === 401 || status === 403) return "you don't have access to this build";
  if (status !== undefined && status >= 500) return "the database didn't answer";
  return "the database refused it";
}
