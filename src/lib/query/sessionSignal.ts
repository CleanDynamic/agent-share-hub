// G13: the one signal that the server may have ended this member's session.
//
// WHERE IT COMES FROM. The Supabase client's fetch (readLimit.ts, createSiteFetch) sees every request's token and every
// answer's status. A data request (a table, a database function, an Edge Function, storage) sent with a member's token and
// answered 401 is reported here, once per token. The auth server's own answers never are: the listener asks it to confirm.
// A refusal for lack of permission (403, 42501) is not a session end, and a request sent with no member's token (the
// publishable key) never reports anything.
//
// WHAT LISTENS. src/components/pagestate/SessionListener.tsx, mounted once. It moves the phase:
//   live      nothing wrong, or the server confirmed the session is fine;
//   checking  a refusal came in and the auth server is being asked;
//   ended     the auth server confirmed it: the local session is cleared and the member is asked to sign in again.
// PageState reads the phase: while it is not live, a region whose read was refused that way shows its skeleton, not a
// failure with a Try again that cannot succeed (G18).

export type SessionPhase = "live" | "checking" | "ended";

let phase: SessionPhase = "live";
const watchers = new Set<() => void>();
let onRefused: ((token: string) => void) | null = null;

export const sessionPhase = (): SessionPhase => phase;

export function setSessionPhase(next: SessionPhase): void {
  if (next === phase) return;
  phase = next;
  for (const watch of watchers) watch();
}

export function subscribeSession(watch: () => void): () => void {
  watchers.add(watch);
  return () => watchers.delete(watch);
}

/** The listener's ear. Only one: a second call replaces the first. */
export function listenForRefusals(listener: ((token: string) => void) | null): void {
  onRefused = listener;
}

function claimsOf(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const claims = JSON.parse(json) as unknown;
    return claims && typeof claims === "object" ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** A signed-in member's token: a JWT for the `authenticated` role with a subject. The publishable key is role `anon`. */
export function isMemberToken(token: string): boolean {
  const claims = claimsOf(token);
  return Boolean(claims && claims.role === "authenticated" && typeof claims.sub === "string" && claims.sub);
}

const DATA_PATHS = ["/rest/v1/", "/functions/v1/", "/storage/v1/"];

function bearerOf(headers: HeadersInit | undefined): string | null {
  if (!headers) return null;
  const value = headers instanceof Headers ? headers.get("Authorization") : Array.isArray(headers) ? (headers.find(([key]) => key.toLowerCase() === "authorization")?.[1] ?? null) : (Object.entries(headers).find(([key]) => key.toLowerCase() === "authorization")?.[1] ?? null);
  const match = typeof value === "string" ? /^Bearer\s+(.+)$/i.exec(value) : null;
  return match ? match[1] : null;
}

/** The member's token when a data request sent with it was answered 401, else null. */
export function refusedMemberRequest(url: string, headers: HeadersInit | undefined, status: number): string | null {
  if (status !== 401) return null;
  let path: string;
  try {
    path = new URL(url, "http://local.invalid").pathname;
  } catch {
    return null;
  }
  if (!DATA_PATHS.some((prefix) => path.startsWith(prefix))) return null;
  const token = bearerOf(headers);
  return token && isMemberToken(token) ? token : null;
}

/** Called by the client's fetch with every answer. */
export function noteAnswer(url: string, headers: HeadersInit | undefined, status: number): void {
  const token = refusedMemberRequest(url, headers, status);
  if (token && onRefused) onRefused(token);
}

/** A failure that is the server refusing the session (lib/errors/permission.ts holds the one definition). */
export { isSessionRefusal } from "@/lib/errors/permission";
