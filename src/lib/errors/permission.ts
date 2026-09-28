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

const PERMISSION_CODES = new Set(["42501", "PGRST301", "PGRST302"]);

/** "code 42501", the form the search functions keep a code in. */
const QUOTED_CODE = /\bcode (42501|PGRST30[12])\b/;

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
