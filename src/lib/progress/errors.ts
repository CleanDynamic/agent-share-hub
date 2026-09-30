// RC-P27 — how the progress page's reads fail.
//
// IDENTIFIERS ONLY ⟦neoscale-error-monitoring › Privacy⟧ (CONTRACT §9): the
// operation, the reader's id, the Postgres or PostgREST code and the HTTP
// status. isPermissionError reads the code and the status, so a refused read
// is told apart from an empty one and drawn as "You don't have access to
// this." (STATES.md row 21), never as a level of 1 or a week at nothing.

/** The failure of a progress read: identifiers, a code and a status. */
export class ProgressReadError extends Error {
  readonly operation: string;
  readonly userId: string;
  /** The Postgres or PostgREST code, e.g. "42501"; read by isPermissionError. */
  readonly code: string | null;
  /** The HTTP status; read by isPermissionError. */
  readonly status: number | null;

  constructor(operation: string, userId: string, code: string | null = null, status: number | null = null) {
    super(`${operation} failed (user ${userId})`);
    this.name = "ProgressReadError";
    this.operation = operation;
    this.userId = userId;
    this.code = code;
    this.status = status;
  }
}

/** A supabase-js response's error as a ProgressReadError, keeping only its code and status. */
export function progressFailure(
  operation: string,
  userId: string,
  response: { error: unknown; status?: number },
): ProgressReadError {
  const { code } = (response.error ?? {}) as { code?: unknown };
  return new ProgressReadError(
    operation,
    userId,
    typeof code === "string" && code ? code : null,
    typeof response.status === "number" && response.status > 0 ? response.status : null,
  );
}
