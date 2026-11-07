// UX-15 P7: the apps a person has let use their account, and taking that back.
//
// THESE ARE SUPABASE'S OWN GRANTS. The connector (`supabase/functions/mcp`) issues and stores no token of its own: it accepts the
// access token Supabase's OAuth 2.1 server minted when the person approved the app on /oauth/consent (EX-P03). So the list is
// `supabase.auth.oauth.listGrants()` and revoking is `revokeGrant({ clientId })`, which marks the consent revoked, ends that app's
// sessions and invalidates its refresh tokens. Nothing is listed that the auth server did not return.
//
// WHEN THE AUTH SERVER CANNOT LIST (OAuth server switched off, or a refusal that says so) the page shows one sentence and nothing
// else: `appsListState` is "unavailable". A network failure is not that; it is an error with Retry.

import { supabase } from "@/integrations/supabase/client";

export interface ConnectedApp {
  clientId: string;
  /** The registered name. A string from outside this system: shown as text, never acted on. */
  name: string;
  uri: string | null;
  scopes: string[];
  grantedAt: string;
}

export const APPS_COPY = {
  empty: "No apps can access your account.",
  unavailable: "Apps you've allowed to access your account will appear here.",
  revoke: "Revoke",
  confirm: (name: string) => `${name} will lose access to your account.`,
} as const;

export type AppsState = { state: "listed"; apps: ConnectedApp[] } | { state: "unavailable" };

interface AuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

/** True when the auth server says it has no OAuth server to list from, as opposed to a failure that may pass. */
export function listingIsUnavailable(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (/oauth/.test(text) && /(disabled|not.?enabled|not.?supported|unavailable)/.test(text)) return true;
  return error.status === 404 || error.status === 501;
}

export function appsOf(grants: readonly { client: { id: string; name: string; uri?: string | null }; scopes: string[]; granted_at: string }[]): ConnectedApp[] {
  return grants
    .map((grant) => ({
      clientId: grant.client.id,
      name: (grant.client.name ?? "").trim() || "An app",
      uri: grant.client.uri ? grant.client.uri : null,
      scopes: grant.scopes ?? [],
      grantedAt: grant.granted_at,
    }))
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
}

export async function listApps(): Promise<AppsState> {
  const { data, error } = await supabase.auth.oauth.listGrants();
  if (error) {
    if (listingIsUnavailable(error)) return { state: "unavailable" };
    throw error;
  }
  return { state: "listed", apps: appsOf(data ?? []) };
}

export async function revokeApp(clientId: string): Promise<void> {
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  if (error) throw error;
}

/** `2 Nov 2026`, in the reader's own locale settings but with the month in words. */
export function grantedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
