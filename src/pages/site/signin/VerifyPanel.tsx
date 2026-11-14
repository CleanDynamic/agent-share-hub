/* The verify views of the sign-in dialog: the container (was UI-P36's `/verify-email` and `/verify-email/:token` page;
   both addresses now open Home with this view, the path's token carried as `?token=`).

   A REPAINT OF THE PAGE, NOT A REWRITE OF VERIFYING. This is
   `pages/VerifyEmail.tsx`'s state and handlers, in the same order and with the
   same words. With no link it is the pending card ("Check your inbox"), after
   sign-up; from an emailed link it checks the link and shows "You're in" or the
   dead-link card. The three cards are the existing cards, drawn inside the
   entrance's card: they were never the legacy shell's, only its content.

   A TOKEN WORKS ONCE. The route holds this page back until the `site_frame` flag
   is known, so the legacy page never mounts first and
   spends it.

   Identity comes from `useAuth()`: "Continue" goes where the signed-in reader's
   profile says (onboarding, or Home), and to sign in when there is no session. */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import type { ResendState } from "@/components/auth/AuthEmailVerificationCard";
import { useAuth } from "@/contexts/AuthContext";
import { resendSignupEmail, verifyEmailLink } from "@/lib/auth/emailLink";
import { resolvePostAuthRoute } from "@/lib/auth/postAuthRoute";

import { readEmailLink } from "./authModel";
import { LinkChecking } from "./ResetForms";
import { VerifyFailed, VerifyPending, VerifySuccess } from "./VerifyForms";
import { useSignInNavigation } from "./useSignInNavigation";

const RESEND_COOLDOWN_SECONDS = 45;

export function VerifyPanel() {
  const navigate = useNavigate();
  const views = useSignInNavigation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();

  const link = readEmailLink(undefined, searchParams, window.location.hash);

  const [mode, setMode] = useState<
    "pending" | "verifying" | "success" | "error"
  >(link.present ? "verifying" : "pending");

  const email =
    (location.state as { email?: string } | null)?.email ||
    sessionStorage.getItem("pending_verification_email") ||
    "";

  /* ── Run verification when a token / code is present in the URL ── */
  useEffect(() => {
    if (!link.present) return;
    let cancelled = false;

    async function runVerification() {
      if (link.urlError || window.location.hash.includes("error")) {
        if (!cancelled) setMode("error");
        return;
      }
      const verified = await verifyEmailLink(
        { tokenHash: link.tokenHash, code: link.code, type: link.otpType },
        () => cancelled,
      );
      if (!cancelled) setMode(verified ? "success" : "error");
    }

    runVerification();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Resend handling on the pending card ── */
  const [resendState, setResendState] = useState<ResendState>("idle");
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => clearInterval(cooldownTimer.current), []);

  const startCooldown = () => {
    setResendState("cooldown");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    cooldownTimer.current = setInterval(() => {
      setCooldown((seconds) => {
        if (seconds <= 1) {
          clearInterval(cooldownTimer.current);
          setResendState("idle");
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email) {
      views.show("signup");
      return;
    }
    setResendState("sending");
    const sent = await resendSignupEmail(email);
    if (!sent) {
      setResendState("idle");
      return;
    }
    setResendState("sent");
    setTimeout(startCooldown, 2500);
  };

  const handleContinue = async () => {
    if (!session) {
      views.replaceWith("login");
      return;
    }
    navigate(await resolvePostAuthRoute(session.user.id), { replace: true });
  };

  /* ── Render ── */
  return (
    <>
      {mode === "verifying" ? (
        <LinkChecking title="Verifying your email…">
          We&apos;re checking the link you opened. This page updates on its own
          in a moment.
        </LinkChecking>
      ) : mode === "success" ? (
        <VerifySuccess onContinue={handleContinue} />
      ) : mode === "error" ? (
        <VerifyFailed
          onResend={handleResend}
          onBackToSignIn={() => views.replaceWith("login")}
        />
      ) : (
        <VerifyPending
          email={email || "your email"}
          resendState={resendState}
          cooldownSeconds={cooldown}
          onResend={handleResend}
          onChangeEmail={() => views.show("signup")}
        />
      )}
    </>
  );
}

export default VerifyPanel;
