// EX-P03 — /oauth/consent, the authorization screen a third-party application
// sends someone here to answer.
//
// WHY THIS PAGE EXISTS AT ALL. The backend's OAuth 2.1 authorization server is
// on, and its authorization path is set to `/oauth/consent`. That setting is a
// promise: every application that asks for access to a buildgallery account is
// redirected to this address, and until this page existed that promise led to a
// 404 in the middle of someone else's sign-in flow. This is the screen that
// keeps it.
//
// OUTSIDE THE APPLICATION FRAME, LAZY, LIKE /compose/:buildId. It is registered
// in App.tsx after `<Route element={<Layout />}>` closes, so there is no left
// rail, no right rail and no mobile bottom bar — and it is its own chunk, so a
// reader who never authorizes an application never pays for it. The reason is
// not the authoring workspace's reason. A consent screen is a decision with two
// answers, and a frame offering somewhere else to go in the middle of it is an
// invitation to abandon a half-finished OAuth exchange, which leaves the
// application that sent them here waiting for a reply that never comes.
//
// ON `AuthShell` RATHER THAN THE WORKSPACE GROUND. This is an auth card, and
// the theme is explicit that reading surfaces carry glass and working surfaces
// do not — the gallery, the build page, the feed AND the auth cards. It is also
// the surface a visitor is most likely to be seeing for the first time, arriving
// from somebody else's product, so the wordmark above the card is doing real
// work: it is the only thing on screen that says whose account is being asked
// about. `AuthShell` is reused exactly as `/login` and `/signup` use it, with
// nothing added to it and nothing changed in it.
//
// THE APPLICATION'S NAME IS DATA. A client registers its own name with the auth
// service, so `applicationName` is a string from outside this system. It is
// rendered as a text node and nothing more: never as markup, never as a URL this
// page follows, and never as an instruction. The same holds for the scopes and
// the redirect host.
//
// WHAT IT CANNOT DO IS AS IMPORTANT AS WHAT IT CAN. The body copy names the
// limits of the grant in the same breath as the grant itself, because a consent
// screen that only says what an application gains is asking for a decision with
// half the facts. The words are fixed by the brief and are not this page's to
// improvise.

import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AuthShell } from "@/components/auth/AuthShell";
import { AuthButton } from "@/components/auth/AuthButton";
import { SeoHead } from "@/components/SeoHead";
import { useAuth } from "@/contexts/AuthContext";
import {
  approveAuthorizationRequest,
  denyAuthorizationRequest,
  readAuthorizationRequest,
  type AuthorizationRead,
} from "@/lib/auth/oauthConsent";
import { buttonStyle, chipStyle, fieldMessageStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import {
  body as bodyType,
  cardTitle,
  data as dataType,
  FIGTREE,
  measure,
} from "@/lib/theme/type";

/** The chip's own padding, matching `CategoryChip`: a label, not a target. */
const CHIP_PAD = "2px 8px";

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * A heading, a sentence and a way out. Every state that is not the consent
 * question itself renders through this, which is what stops any of them being
 * a blank page.
 */
function Notice({
  title,
  detail,
  children,
}: {
  title: string;
  /**
   * What the sign-in service actually said, when it said anything.
   *
   * SEPARATE FROM THE SENTENCE ABOVE IT, and quieter, because the two answer
   * different questions. The body says what to do about it, which is what a
   * visitor needs; this says what went wrong, which is what the maintainer
   * needs when they are sent a screenshot. Folding the service's own wording
   * into the body instead would repeat the heading back at the reader.
   */
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h1 style={{ ...cardTitle, margin: 0, color: t.text }}>{title}</h1>
      <p style={{ ...bodyType, ...measure, margin: 0, color: t.text2 }}>{children}</p>
      {detail ? (
        <p style={{ ...dataType, margin: 0, color: t.text2, overflowWrap: "anywhere" }}>
          {detail}
        </p>
      ) : null}
      <Link
        to="/gallery"
        style={{
          ...bodyType,
          color: t.action,
          textDecoration: "underline",
          textUnderlineOffset: "3px",
        }}
      >
        Go to buildgallery
      </Link>
    </div>
  );
}

/**
 * Deny, as a secondary control.
 *
 * WRITTEN HERE RATHER THAN BY WIDENING `AuthButton`. That component is a
 * reserved primary button surface, and a primary surface is not this prompt's to
 * reshape. It is also the right answer for the page: the theme allows one
 * primary action per view, Allow is it, and a denial that looked identical to an
 * approval would be a consent screen with no recommended answer at all. So
 * `outline` — glass over a `--text2` hairline — which is the kit's secondary,
 * spelled out because this is the one place that needs it.
 */
function DenyButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-visual-slot="btn-secondary"
      {...handlers}
      style={{
        ...buttonStyle("outline", state),
        height: "48px",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FIGTREE,
        fontSize: "14px",
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default function OAuthConsent() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, profile, isLoggedIn, loading: authLoading } = useAuth();

  const authorizationId = searchParams.get("authorization_id") ?? "";

  const [decision, setDecision] = useState<"allow" | "deny" | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const load = useQuery<AuthorizationRead>({
    queryKey: ["oauth-authorization", authorizationId],
    enabled: Boolean(authorizationId) && isLoggedIn,
    /* An authorization request is answered once. Refetching it behind the
       visitor would change the question under the button they are reaching
       for, and a request that expired mid-read should surface when they
       answer, not as the card rewriting itself. */
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: () => readAuthorizationRequest(authorizationId),
  });

  const read = load.data;

  /* The already-consented branch. The auth service answers a repeat request
     with a finished redirect instead of the details, and the only correct
     response is to follow it — asking a second time for a grant that already
     exists is a question with no answer that changes anything.

     `window.location.assign` rather than the router, for the same reason the
     two decisions below use it: the destination belongs to the application
     that sent the visitor here and is not a route in this app. */
  useEffect(() => {
    if (read?.kind === "redirect") window.location.assign(read.url);
  }, [read]);

  const decide = useCallback(
    async (choice: "allow" | "deny") => {
      if (decision) return;
      setDecision(choice);
      setDecisionError(null);
      try {
        const url =
          choice === "allow"
            ? await approveAuthorizationRequest(authorizationId)
            : await denyAuthorizationRequest(authorizationId);
        window.location.assign(url);
      } catch (cause) {
        setDecisionError(messageOf(cause));
        setDecision(null);
      }
    },
    [authorizationId, decision],
  );

  /* `noIndex` because a consent URL is one visitor's pending request, not a
     page: indexing it would publish an address that means nothing to anyone
     else and expires for the person it does mean something to. */
  const head = (
    <SeoHead
      title="Authorize an application — buildgallery"
      description="Approve or deny an application asking for access to your buildgallery account."
      path="/oauth/consent"
      noIndex
    />
  );

  /* No authorization_id, and this is checked BEFORE the sign-in gate.

     THE ORDER IS THE POINT. This state does not depend on who is asking: there
     is no request here for anyone, signed in or out. Gating it behind login
     would send a visitor away to authenticate and then hand them "nothing to
     authorize" for their trouble — a round trip whose answer was already known
     before it started. So the identity-independent refusal comes first.

     It is a tidy sentence and a way out, not a blank card and not a stack
     trace. */
  if (!authorizationId) {
    return (
      <AuthShell>
        {head}
        <Notice title="Nothing to authorize">
          This page answers a request from an application that wants access to
          your buildgallery account. It was opened without one, so there is
          nothing here to allow or deny.
        </Notice>
      </AuthShell>
    );
  }

  /* Signed out, with a real request waiting. The whole query string travels, so
     the authorization_id survives the round trip and the visitor lands back on
     this exact request rather than on an empty consent page. `ProtectedRoute`
     is deliberately not used here: it forwards `location.pathname` only, which
     would drop the one parameter this page cannot work without. */
  if (!authLoading && !isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (authLoading) {
    return (
      <AuthShell>
        {head}
        <p style={{ ...bodyType, margin: 0, color: t.text2 }}>Checking your account…</p>
      </AuthShell>
    );
  }

  if (load.isPending) {
    return (
      <AuthShell>
        {head}
        <p style={{ ...bodyType, margin: 0, color: t.text2 }}>Reading the request…</p>
      </AuthShell>
    );
  }

  if (load.isError || !read) {
    return (
      <AuthShell>
        {head}
        <Notice
          title="That request could not be read"
          detail={load.error ? messageOf(load.error) : undefined}
        >
          It may have already been answered, or it may have expired. Ask the
          application to try again.
        </Notice>
      </AuthShell>
    );
  }

  if (read.kind === "redirect") {
    return (
      <AuthShell>
        {head}
        <p style={{ ...bodyType, margin: 0, color: t.text2 }}>
          You have already authorized this application. Taking you back…
        </p>
      </AuthShell>
    );
  }

  const { applicationName, applicationUri, scopes, redirectUri } = read.request;
  /* The email is the account, and it is what a visitor recognises when they are
     deciding on behalf of one of several. The handle is the fallback rather
     than the first choice because two accounts can look alike by display name
     and never by address — and there is a last fallback because "Acting as "
     with nothing after it is worse than a vaguer sentence. */
  const account = user?.email || (profile?.username ? `@${profile.username}` : "your account");
  const busy = decision !== null;

  return (
    <AuthShell>
      {head}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ ...cardTitle, margin: 0, color: t.text }}>
          {applicationName} wants access to your account
        </h1>

        {/* The account the grant will act as. From `useAuth()` — the session is
            already in context and a second auth query here would be a second
            source of truth for the one fact this screen must not get wrong. */}
        <p style={{ ...dataType, margin: 0, color: t.text2, overflowWrap: "anywhere" }}>
          Acting as {account}
        </p>

        <p style={{ ...bodyType, ...measure, margin: 0, color: t.text }}>
          This will let {applicationName} upload conversations to your
          buildgallery account as waiting imports for you to review. It cannot
          publish anything, and it cannot change or delete anything you have
          already made.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ ...dataType, color: t.text2 }}>
            {scopes.length === 1 ? "Scope requested" : "Scopes requested"}
          </span>
          {/* A LIST, NOT A ROW OF SPANS. The scopes are the substance of the
              decision, so a screen reader should hear how many there are and
              move through them; a flex row of bare spans announces one
              undifferentiated run of words. The list markers and default
              indent are cleared inline — these are new elements, not an
              existing layout element's box. */}
          {scopes.length > 0 ? (
            <ul
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              {scopes.map((scope) => (
                <li key={scope} style={{ ...chipStyle("neutral"), padding: CHIP_PAD }}>
                  {scope}
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ ...bodyType, color: t.text2 }}>None requested.</span>
          )}
        </div>

        {/* Where the answer goes back to. A visitor deciding whether to trust an
            application is entitled to see which address the grant returns to,
            and a registered name alone does not tell them that. */}
        <p style={{ ...dataType, margin: 0, color: t.text2, overflowWrap: "anywhere" }}>
          Returns to {redirectUri}
          {applicationUri ? ` · ${applicationUri}` : ""}
        </p>

        {/* `role="alert"` because this appears AFTER a click, in response to it:
            a sighted visitor sees the sentence arrive under the buttons, and
            without the live region a screen-reader user gets nothing at all and
            is left to guess why the page did not move. `fieldMessageStyle` is
            the kit's own inline-error treatment, the same one LoginCard uses —
            reused rather than re-derived, so breakage red is spent in one
            place. */}
        {decisionError ? (
          <p role="alert" style={{ ...fieldMessageStyle, margin: 0 }}>
            {decisionError}
          </p>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <AuthButton
            type="button"
            onClick={() => decide("allow")}
            disabled={busy}
            isLoading={decision === "allow"}
            loadingText="Allowing…"
          >
            Allow
          </AuthButton>
          <DenyButton onClick={() => decide("deny")} disabled={busy}>
            {decision === "deny" ? "Denying…" : "Deny"}
          </DenyButton>
        </div>
      </div>
    </AuthShell>
  );
}
