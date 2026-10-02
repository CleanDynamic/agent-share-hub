/* UI-P36 — `/reset-password` and `/reset-password/:token` in the entrance's
   frame: the container.

   A REPAINT OF THE FORMS, NOT A REWRITE OF RECOVERY. This is
   `pages/ResetPassword.tsx`'s state and handlers, in the same order and with the
   same words. One page serves both routes: with no link it is the request form
   ("enter your email"), and from an emailed link it checks the link and becomes
   the new-password form. It is as resilient as the legacy page to however the
   project delivers the link — a token in the path or the query, a PKCE code, an
   implicit-flow hash that raises a PASSWORD_RECOVERY event — and an error in the
   URL goes straight to the dead-link state.

   A TOKEN WORKS ONCE. The route holds this page back until the `site_frame` flag
   is known (see `LinkFrameRoute`), so the legacy page never mounts first and
   spends it.

   What the Supabase calls became is only where they live: named functions in
   `src/lib/auth/`, since a component may not call Supabase. */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { calculatePasswordStrength, type PasswordStrength } from "@/components/auth/PasswordStrengthMeter";
import { verifyEmailLink } from "@/lib/auth/emailLink";
import { onPasswordRecovery, requestPasswordReset, setNewPassword } from "@/lib/auth/passwordReset";

import { readEmailLink, resetConfirmCanSubmit, resetRequestCanSubmit } from "./authModel";
import { LinkChecking, ResetConfirmForm, ResetLinkError, ResetRequestForm, ResetSent } from "./ResetForms";
import { SignInShell } from "./SignInShell";

const EMAIL_REGEX = /^[^@]+@[^@]+\.[^@]+$/;

type Mode = "request" | "sent" | "verifying" | "confirm" | "error";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const link = readEmailLink(params.token, searchParams, window.location.hash);

  const [mode, setMode] = useState<Mode>(link.present ? "verifying" : "request");

  // --- Request form state ---
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");

  // --- Confirm form state ---
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>("weak");
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [mismatchError, setMismatchError] = useState("");

  // Recalculate password strength on each keystroke (debounced 200ms).
  useEffect(() => {
    const timer = setTimeout(() => {
      setPasswordStrength(calculatePasswordStrength(password));
    }, 200);
    return () => clearTimeout(timer);
  }, [password]);

  // --- Verify recovery token on mount when arriving from an email link ---
  const verificationStarted = useRef(false);
  useEffect(() => {
    if (!link.present || verificationStarted.current) return;
    verificationStarted.current = true;

    let cancelled = false;

    // The client auto-detects a session in the URL hash and raises
    // PASSWORD_RECOVERY. Listen for it as a belt-and-braces alongside the
    // explicit verification below.
    const stopListening = onPasswordRecovery(() => {
      if (!cancelled) setMode("confirm");
    });

    async function runVerification() {
      if (link.urlError || window.location.hash.includes("error")) {
        if (!cancelled) setMode("error");
        return;
      }
      const verified = await verifyEmailLink(
        { tokenHash: link.tokenHash, code: link.code, type: "recovery" },
        () => cancelled,
      );
      if (!cancelled) setMode(verified ? "confirm" : "error");
    }

    runVerification();
    return () => {
      cancelled = true;
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Handlers ---

  const handleRequestSubmit = async () => {
    const cleanEmail = email.trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setRequestError("Please enter a valid email.");
      return;
    }

    setRequestSubmitting(true);
    setRequestError("");

    try {
      // The project deliberately doesn't surface "email not found" here, so an
      // accepted request shows the same generic confirmation either way, to avoid
      // leaking which emails are registered.
      const accepted = await requestPasswordReset(cleanEmail, `${window.location.origin}/reset-password`);
      if (!accepted) {
        setRequestError("Something went wrong. Please try again.");
        setRequestSubmitting(false);
        return;
      }
      setSubmittedEmail(cleanEmail);
      setMode("sent");
    } catch {
      setRequestError("Something went wrong. Please try again.");
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setConfirmError("");
    setMismatchError("");

    if (password.length < 8) {
      setConfirmError("Password must be at least 8 characters.");
      return;
    }
    if (passwordStrength === "weak") {
      setConfirmError("Please choose a stronger password.");
      return;
    }
    if (password !== confirmPassword) {
      setMismatchError("Passwords don't match");
      return;
    }

    setConfirmSubmitting(true);
    try {
      // Updates the password and signs the recovery session out, so the reader
      // has to re-authenticate with the new one.
      await setNewPassword(password);

      toast.success("Password updated. Sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.";
      setConfirmError(message);
      setConfirmSubmitting(false);
    }
  };

  const handleRequestNewLink = () => {
    // Clear the URL of any failed token params so a refresh doesn't loop us
    // back into the error state.
    window.history.replaceState({}, "", "/reset-password");
    setEmail("");
    setRequestError("");
    setMode("request");
  };

  // --- Render ---

  return (
    <>
      <SeoHead
        title="Reset your password — buildgallery"
        description="Reset your buildgallery account password."
        path="/reset-password"
        noIndex
      />
      <SignInShell mode="reset">
        {mode === "verifying" ? (
          <LinkChecking title="Checking your reset link…">
            We&apos;re confirming the link is still valid. The form for your new password appears here in a moment.
          </LinkChecking>
        ) : mode === "sent" ? (
          <ResetSent email={submittedEmail} />
        ) : mode === "error" ? (
          <ResetLinkError onRequestNew={handleRequestNewLink} />
        ) : mode === "confirm" ? (
          <ResetConfirmForm
            password={password}
            confirmPassword={confirmPassword}
            passwordStrength={passwordStrength}
            onPasswordChange={(value) => {
              setPassword(value);
              setConfirmError("");
              setMismatchError("");
            }}
            onConfirmPasswordChange={(value) => {
              setConfirmPassword(value);
              setMismatchError("");
            }}
            canSubmit={resetConfirmCanSubmit(password, confirmPassword)}
            isSubmitting={confirmSubmitting}
            onSubmit={handleConfirmSubmit}
            mismatchError={mismatchError}
            error={confirmError}
          />
        ) : (
          <ResetRequestForm
            email={email}
            onEmailChange={(value) => {
              setEmail(value);
              setRequestError("");
            }}
            canSubmit={resetRequestCanSubmit(email)}
            isSubmitting={requestSubmitting}
            onSubmit={handleRequestSubmit}
            error={requestError}
          />
        )}
      </SignInShell>
    </>
  );
}

export default ResetPasswordPage;
