// A refused read, told apart from an empty one (RC-P10; CONTRACT §9).
//
// A read that row-level security refuses and a read that found nothing look
// alike to a page that only asks how many rows came back, and a page that
// renders the refusal as "nothing here yet" tells the reader something false
// ⟦neoscale-error-monitoring › What to instrument 5⟧. So a refusal is its own
// state, STATES.md row 21: "You don't have access to this."
//
// WHAT COUNTS AS A REFUSAL: Postgres 42501 (insufficient_privilege),
// PostgREST's PGRST301 and PGRST302 (a token it will not accept; anonymous
// access refused), and an HTTP 401 or 403. The data layer wraps the database's
// error as the `cause` of its own, and the search functions keep only the code
// ("code 42501") so that no query text survives into an error, so the chain is
// walked and a code quoted that way is read too.

const PERMISSION_CODES = new Set(["42501", "PGRST301", "PGRST302", "PGRST303"]);

/** "code 42501", the form the search functions keep a code in. */
const QUOTED_CODE = /\bcode (42501|PGRST30[123])\b/;

/** How far down a chain of causes to look. */
const MAX_DEPTH = 4;

export function isPermissionError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH && current && typeof current === "object"; depth += 1) {
    const candidate = current as {
      code?: unknown;
      status?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (typeof candidate.code === "string" && PERMISSION_CODES.has(candidate.code)) return true;
    if (candidate.status === 401 || candidate.status === 403) return true;
    if (typeof candidate.message === "string" && QUOTED_CODE.test(candidate.message)) return true;
    current = candidate.cause;
  }
  return false;
}

/* ── G13: the union, split ──
   isPermissionError (above) stays the union: the components that say "You don't have access to this." and the query
   client's retry rule read it, and neither kind is retried. Its two halves:
   - a session refusal: the server will not accept this token (401, PGRST301, PGRST302, PGRST303). On a member's token,
     that is the session ending: the session listener confirms it and asks the member to sign in again.
   - no access: the token is fine and the row is not this reader's (403, 42501). The page shows its failed state. */

const SESSION_CODES = new Set(["PGRST301", "PGRST302", "PGRST303"]);
const NO_ACCESS_CODES = new Set(["42501"]);

function walk(error: unknown, test: (candidate: { code?: unknown; status?: unknown; message?: unknown }) => boolean): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH && current && typeof current === "object"; depth += 1) {
    if (test(current as { code?: unknown; status?: unknown })) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** The server would not accept the token: a 401 or a JWT code, anywhere on the chain. Never 403 or 42501. */
export function isSessionRefusal(error: unknown): boolean {
  return walk(error, (c) => (typeof c.code === "string" && SESSION_CODES.has(c.code)) || c.status === 401);
}

/** The token is fine and the row is not this reader's: 403 or 42501. Never a session end. */
export function isNoAccess(error: unknown): boolean {
  return walk(error, (c) => (typeof c.code === "string" && NO_ACCESS_CODES.has(c.code)) || c.status === 403 || (typeof c.message === "string" && /\bcode 42501\b/.test(c.message)));
}
