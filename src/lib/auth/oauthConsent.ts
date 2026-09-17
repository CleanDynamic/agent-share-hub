// EX-P03 — the OAuth 2.1 authorization server's consent decisions.
//
// WHAT THIS IS, AND WHAT IT IS NOT. `oauth.ts` beside this file is the other
// direction: buildgallery asking Google or GitHub to vouch for a visitor. This
// is buildgallery being asked — a third-party application has sent someone here
// to approve it, and these three calls are how that request is read and
// answered. The two never meet, which is why they are separate files under one
// domain rather than one file with six exports.
//
// THE HELPERS ARE SUPABASE'S, NOT OURS. `supabase.auth.oauth` is the OAuth 2.1
// server API documented under "Build your authorization UI", shipped in
// @supabase/auth-js. Nothing here implements an authorization endpoint: the
// codes, the grants and the state parameter are the auth service's, and this
// module only names the three moves a consent screen makes.
//
// EVERY CALL RUNS ON THE VISITOR'S OWN SESSION. Each helper reads the current
// session and sends its access token; there is no service-role key in this file
// and there must never be one. A consent decision is the account holder's to
// make, so the request that records it has to carry their identity and no more
// authority than they have.
//
// WHY THIS IS NOT INLINE IN THE PAGE. Data access in this codebase lives in
// `src/lib/<domain>/` as named, typed functions — the page decides what to show,
// this decides what to ask for. It also puts the two `skipBrowserRedirect`
// flags in one place; see `approveAuthorizationRequest` for why they matter.

import { supabase } from "@/integrations/supabase/client";

/** One pending authorization request, as a consent screen needs to show it. */
export interface AuthorizationRequest {
  /** The id the approve and deny calls are made against. */
  authorizationId: string;
  /**
   * The requesting application's registered name.
   *
   * IT IS A STRING FROM OUTSIDE THIS SYSTEM. A client registers its own name,
   * so this is shown to the visitor and never acted on — rendered as a text
   * node, never as markup and never as an instruction.
   */
  applicationName: string;
  /** The application's registered website, shown under its name when it has one. */
  applicationUri: string;
  /** The requested scopes, already split off the space-separated list. */
  scopes: string[];
  /** Where the visitor goes back to, without the code or the state. */
  redirectUri: string;
}

/**
 * What reading an authorization request can turn out to be.
 *
 * TWO OUTCOMES, NOT ONE, and the page has to handle both. A visitor who has
 * already granted these scopes to this application is not asked a second time:
 * the auth service answers with a finished redirect instead of the details, and
 * the only correct response is to follow it. Collapsing that into a "details"
 * shape with empty fields would put an empty consent card on screen for a
 * decision that has already been made.
 */
export type AuthorizationRead =
  | { kind: "consent"; request: AuthorizationRequest }
  | { kind: "redirect"; url: string };

/** The message a caller shows when the auth service refuses or cannot answer. */
function consentError(action: string, cause: { message?: string } | null): Error {
  const detail = cause?.message?.trim();
  return new Error(
    detail && detail.length > 0
      ? `${action}: ${detail}`
      : `${action}: the sign-in service did not answer.`,
  );
}

/**
 * Read the pending authorization request named by `authorizationId`.
 *
 * Throws when the id is unknown, expired, or belongs to someone else — the auth
 * service does not distinguish those cases to the caller, and neither should the
 * page: all three mean the same thing to the person reading it.
 */
export async function readAuthorizationRequest(
  authorizationId: string,
): Promise<AuthorizationRead> {
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error) throw consentError("This request could not be read", error);
  if (!data) throw consentError("This request could not be read", null);

  // The service returns one of two shapes. `authorization_id` is what tells
  // them apart, and is the narrowing the SDK's own documentation uses.
  if (!("authorization_id" in data)) {
    return { kind: "redirect", url: data.redirect_url };
  }

  return {
    kind: "consent",
    request: {
      authorizationId: data.authorization_id,
      applicationName: data.client.name,
      applicationUri: data.client.uri,
      // A space-separated list, per the OAuth spec. Split on any run of
      // whitespace so a trailing space does not become an empty scope chip.
      scopes: data.scope.split(/\s+/).filter(Boolean),
      redirectUri: data.redirect_uri,
    },
  };
}

/**
 * Approve the request, and return where the visitor goes next.
 *
 * `skipBrowserRedirect: true` IS DELIBERATE AND IS THE WHOLE POINT OF THE
 * RETURN VALUE. Left at its default, the helper calls `window.location.assign`
 * itself, from inside the data layer, on a page that has not had a chance to
 * settle — and the navigation then happens whether or not the caller wanted it.
 * With the flag, this function does one thing and hands back the URL, so the
 * page owns the navigation and a test can observe the decision without leaving
 * the application.
 */
export async function approveAuthorizationRequest(authorizationId: string): Promise<string> {
  const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });

  if (error) throw consentError("This request could not be approved", error);
  if (!data?.redirect_url) throw consentError("This request could not be approved", null);

  return data.redirect_url;
}

/**
 * Deny the request, and return where the visitor goes next.
 *
 * A denial is still a completed OAuth exchange: the URL carries `access_denied`
 * back to the application, which is how it learns not to keep waiting. Dropping
 * the visitor somewhere else instead would leave the application hanging, so
 * this returns its URL for the same reason approval does.
 */
export async function denyAuthorizationRequest(authorizationId: string): Promise<string> {
  const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });

  if (error) throw consentError("This request could not be declined", error);
  if (!data?.redirect_url) throw consentError("This request could not be declined", null);

  return data.redirect_url;
}
