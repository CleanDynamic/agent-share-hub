// my-sessions (G16): the rules, with no Deno and no network, so vitest and Deno test the same code.

/** A row as public.sessions_of_user returns it. */
export interface SessionRow {
  id: string;
  created_at: string | null;
  last_active: string | null;
  user_agent: string | null;
  aal: string | null;
}

/** What the page is sent. No address, no token. */
export interface SessionView {
  id: string;
  createdAt: string | null;
  lastActive: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface SessionDeps {
  /** From the verified token, never from the body. */
  userId: string;
  /** The session the request's own token belongs to, from its session_id claim. */
  currentSessionId: string | null;
  list: (userId: string) => Promise<SessionRow[]>;
  revoke: (userId: string, sessionId: string) => Promise<boolean>;
}

export class SessionRefused extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The session_id claim of a token the caller has ALREADY verified (auth.getUser). This only reads the payload; it is
 * never the check of who is calling.
 */
export function sessionIdOf(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as { session_id?: unknown };
    return typeof claims.session_id === "string" && UUID.test(claims.session_id) ? claims.session_id : null;
  } catch {
    return null;
  }
}

export async function listSessions(deps: SessionDeps): Promise<SessionView[]> {
  const rows = await deps.list(deps.userId);
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    lastActive: row.last_active,
    userAgent: row.user_agent,
    current: row.id === deps.currentSessionId,
  }));
}

/** Ends one of the caller's other sessions. This device signs out in the browser, not here. */
export async function endSession(deps: SessionDeps, sessionId: string): Promise<void> {
  if (!UUID.test(sessionId)) throw new SessionRefused("That isn't a session.", 400);
  if (sessionId === deps.currentSessionId) throw new SessionRefused("To sign out this device, use Sign out.", 400);
  const ended = await deps.revoke(deps.userId, sessionId);
  if (!ended) throw new SessionRefused("That device is already signed out.", 404);
}
