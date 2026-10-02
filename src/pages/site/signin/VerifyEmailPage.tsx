/* UI-P36 — `/verify-email` and `/verify-email/:token` in the entrance's frame:
   the container.

   A REPAINT OF THE PAGE, NOT A REWRITE OF VERIFYING. This is
   `pages/VerifyEmail.tsx`'s state and handlers, in the same order and with the
   same words. With no link it is the pending card ("Check your inbox"), after
   sign-up; from an emailed link it checks the link and shows "You're in" or the
   dead-link card. The three cards are the existing cards, drawn inside the
   entrance's card: they were never the legacy shell's, only its content.

   A TOKEN WORKS ONCE. The route holds this page back until the `site_frame` flag
   is known (see `LinkFrameRoute`), so the legacy page never mounts first and
   spends it.

   Identity comes from `useAuth()`: "Continue" goes where the signed-in reader's
   profile says (onboarding, or Home), and to sign in when there is no session. */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { AuthEmailErrorCard } from "@/components/auth/AuthEmailErrorCard";
import { AuthEmailSuccessCard } from "@/components/auth/AuthEmailSuccessCard";
import { AuthEmailVerificationCard, type ResendState } from "@/components/auth/AuthEmailVerificationCard";
import { useAuth } from "@/contexts/AuthContext";
import { resendSignupEmail, verifyEmailLink } from "@/lib/auth/emailLink";
import { resolvePostAuthRoute } from "@/lib/auth/postAuthRoute";

import { readEmailLink } from "./authModel";
import { LinkChecking } from "./ResetForms";
import { SignInShell } from "./SignInShell";

const RESEND_COOLDOWN_SECONDS = 45;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();

  const link = readEmailLink(params.token, searchParams, window.location.hash);

  const [mode, setMode] = useState<"pending" | "verifying" | "success" | "error">(
    link.present ? "verifying" : "pending",
  );

  const email =
    (location.state as { email?: string } | null)?.email || sessionStorage.getItem("pending_verification_email") || "";

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
      navigate("/signup");
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
    const route = session ? await resolvePostAuthRoute(session.user.id) : "/login";
    navigate(route, { replace: true });
  };

  /* ── Render ── */
  return (
    <>
      <SeoHead
        title="Verify your email — buildgallery"
        description="Verify your buildgallery account email."
        path="/verify-email"
        noIndex
      />
      <SignInShell mode="verify">
        {mode === "verifying" ? (
          <LinkChecking title="Verifying your email…">
            We&apos;re checking the link you opened. This page updates on its own in a moment.
          </LinkChecking>
        ) : mode === "success" ? (
          <AuthEmailSuccessCard onContinue={handleContinue} />
        ) : mode === "error" ? (
          <AuthEmailErrorCard onResend={handleResend} onBackToSignIn={() => navigate("/login", { replace: true })} />
        ) : (
          <AuthEmailVerificationCard
            email={email || "your email"}
            resendState={resendState}
            cooldownSeconds={cooldown}
            onResend={handleResend}
            onChangeEmail={() => navigate("/signup")}
          />
        )}
      </SignInShell>
    </>
  );
}

export default VerifyEmailPage;
