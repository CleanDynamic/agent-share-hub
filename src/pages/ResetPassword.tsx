import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { AuthButton } from "@/components/auth/AuthButton";
import { t } from "@/lib/theme/tokens";
import { cardTitle, FIGTREE } from "@/lib/theme/type";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordRequestCard } from "@/components/auth/ResetPasswordRequestCard";
import { ResetPasswordConfirmCard } from "@/components/auth/ResetPasswordConfirmCard";
import {
  calculatePasswordStrength,
  type PasswordStrength,
} from "@/components/auth/PasswordStrengthMeter";

const EMAIL_REGEX = /^[^@]+@[^@]+\.[^@]+$/;

type Mode = "request" | "sent" | "verifying" | "confirm" | "error";

/**
 * Serves two routes:
 *  - /reset-password           → request form ("enter your email")
 *  - /reset-password/:token    → confirm form ("set a new password")
 *
 * It is also resilient to however Supabase delivers the recovery link
 * (path token, ?token_hash=, ?code=, or an implicit-flow hash session
 * that triggers a PASSWORD_RECOVERY auth event).
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const tokenHash =
    params.token || searchParams.get("token_hash") || searchParams.get("token") || "";
  const code = searchParams.get("code") || "";
  const urlError =
    searchParams.get("error_description") || searchParams.get("error") || "";
  const hashHasAuth = /access_token|error/.test(window.location.hash);
  const isFromLink = Boolean(tokenHash || code || urlError || hashHasAuth);

  const [mode, setMode] = useState<Mode>(isFromLink ? "verifying" : "request");

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
    const t = setTimeout(() => {
      setPasswordStrength(calculatePasswordStrength(password));
    }, 200);
    return () => clearTimeout(t);
  }, [password]);

  // --- Verify recovery token on mount when arriving from an email link ---
  const verificationStarted = useRef(false);
  useEffect(() => {
    if (!isFromLink || verificationStarted.current) return;
    verificationStarted.current = true;

    let cancelled = false;

    // Supabase auto-detects sessions in the URL hash and fires
    // PASSWORD_RECOVERY. Listen for it as a belt-and-braces alongside
    // the explicit verifyOtp / exchangeCodeForSession paths below.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") setMode("confirm");
    });

    async function runVerification() {
      if (urlError || window.location.hash.includes("error")) {
        if (!cancelled) setMode("error");
        return;
      }
      try {
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery" as EmailOtpType,
          });
          if (error) throw error;
          if (!cancelled) setMode("confirm");
          return;
        }

        // PKCE code or implicit-flow hash — Supabase may already have
        // established the session via detectSessionInUrl. Poll for it.
        for (let i = 0; i < 20 && !cancelled; i++) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            if (!cancelled) setMode("confirm");
            return;
          }
          if (code && i === 0) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
              if (!cancelled) setMode("confirm");
              return;
            }
          }
          await new Promise((r) => setTimeout(r, 200));
        }
        if (!cancelled) setMode("error");
      } catch {
        if (!cancelled) setMode("error");
      }
    }

    runVerification();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
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
      // Supabase deliberately doesn't surface "email not found" here, so a
      // null error means the request was accepted — show the same generic
      // confirmation either way to avoid leaking which emails are registered.
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Sign out the recovery session so the user has to re-authenticate
      // with the new password.
      await supabase.auth.signOut();

      toast.success("Password updated. Sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Please try again.";
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

  const seoHead = (
    <SeoHead
      title="Reset your password — buildgallery"
      description="Reset your buildgallery account password."
      path="/reset-password"
      noIndex
    />
  );

  if (mode === "verifying") {
    return (
      <>
        {seoHead}
        <AuthShell>
          /* Pending is `--text2`: nothing has succeeded and nothing has failed. */
          <div className="flex flex-col items-center text-center">
            <Loader2
              className="animate-spin"
              style={{ width: "56px", height: "56px", color: t.text2 }}
            />
            <h2 style={{ ...cardTitle, marginTop: "20px", color: t.text }}>
              Checking your reset link…
            </h2>
            <p
              style={{
                marginTop: "6px",
                fontFamily: FIGTREE,
                fontSize: "13px",
                lineHeight: 1.55,
                color: t.text2,
              }}
            >
              We&apos;re confirming the link is still valid. The form for your
              new password appears here in a moment.
            </p>
          </div>
        </AuthShell>
      </>
    );
  }

  if (mode === "sent") {
    return (
      <>
        {seoHead}
        <AuthShell>
          <SentConfirmation
            email={submittedEmail}
            onBackToSignIn={() => navigate("/login")}
          />
        </AuthShell>
      </>
    );
  }

  if (mode === "error") {
    return (
      <>
        {seoHead}
        <AuthShell>
          <ResetLinkError
            onRequestNew={handleRequestNewLink}
            onBackToSignIn={() => navigate("/login")}
          />
        </AuthShell>
      </>
    );
  }

  if (mode === "confirm") {
    return (
      <>
        {seoHead}
        <ResetPasswordConfirmCard
          password={password}
          confirmPassword={confirmPassword}
          passwordStrength={passwordStrength}
          onPasswordChange={(v) => {
            setPassword(v);
            setConfirmError("");
            setMismatchError("");
          }}
          onConfirmPasswordChange={(v) => {
            setConfirmPassword(v);
            setMismatchError("");
          }}
          onSubmit={handleConfirmSubmit}
          isSubmitting={confirmSubmitting}
          mismatchError={mismatchError}
          error={confirmError}
        />
      </>
    );
  }

  // mode === "request"
  return (
    <>
      {seoHead}
      <ResetPasswordRequestCard
        email={email}
        onEmailChange={(v) => {
          setEmail(v);
          setRequestError("");
        }}
        onSubmit={handleRequestSubmit}
        isSubmitting={requestSubmitting}
        error={requestError}
      />
    </>
  );
}

/* ───────────────────────── Inline state cards ───────────────────────── */

interface SentConfirmationProps {
  email: string;
  onBackToSignIn: () => void;
}

function SentConfirmation({ email, onBackToSignIn }: SentConfirmationProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 style={{ ...cardTitle, margin: 0, color: t.text }}>Check your inbox</h2>
      <p
        style={{
          marginTop: "8px",
          fontFamily: FIGTREE,
          fontSize: "13px",
          fontWeight: 400,
          lineHeight: 1.55,
          color: t.text2,
        }}
      >
        If an account exists with <span style={{ color: t.text }}>{email}</span>,
        we sent a reset link. Open it and you can set a new password — it works
        once and expires after an hour.
      </p>
      <button
        type="button"
        onClick={onBackToSignIn}
        style={{
          marginTop: "18px",
          background: "none",
          border: "none",
          padding: "6px 0",
          fontFamily: FIGTREE,
          fontSize: "13px",
          fontWeight: 500,
          color: t.action,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: "4px",
          textDecorationThickness: "1px",
        }}
      >
        Back to sign in
      </button>
    </div>
  );
}

interface ResetLinkErrorProps {
  onRequestNew: () => void;
  onBackToSignIn: () => void;
}

function ResetLinkError({ onRequestNew, onBackToSignIn }: ResetLinkErrorProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <AlertCircle
        style={{
          width: "56px",
          height: "56px",
          color: t.catBreakage,
          strokeWidth: 1.5,
        }}
      />
      <h2 style={{ ...cardTitle, marginTop: "20px", color: t.text }}>
        This reset link doesn&apos;t work
      </h2>
      <p
        style={{
          marginTop: "8px",
          fontFamily: FIGTREE,
          fontSize: "13px",
          fontWeight: 400,
          lineHeight: 1.55,
          color: t.text2,
        }}
      >
        It may have expired or already been used. Request a new one and
        we&apos;ll email a fresh link — your password has not changed.
      </p>
      <div style={{ width: "100%", marginTop: "16px" }}>
        <AuthButton type="button" onClick={onRequestNew}>
          Request a new one
        </AuthButton>
      </div>
      <button
        type="button"
        onClick={onBackToSignIn}
        style={{
          marginTop: "6px",
          background: "none",
          border: "none",
          padding: "6px 0",
          fontFamily: FIGTREE,
          fontSize: "13px",
          fontWeight: 500,
          color: t.action,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: "4px",
          textDecorationThickness: "1px",
        }}
      >
        Back to sign in
      </button>
    </div>
  );
}
