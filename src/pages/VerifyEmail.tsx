import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthEmailVerificationCard,
  type ResendState,
} from "@/components/auth/AuthEmailVerificationCard";
import { AuthEmailSuccessCard } from "@/components/auth/AuthEmailSuccessCard";
import { AuthEmailErrorCard } from "@/components/auth/AuthEmailErrorCard";
import { resolvePostAuthRoute } from "@/lib/auth/postAuthRoute";

const RESEND_COOLDOWN_SECONDS = 45;

/**
 * Serves two routes:
 *  - /verify-email          → pending "check your inbox" card (after signup)
 *  - /verify-email/:token   → verifies the link, then success / error card
 *
 * It is also resilient to however Supabase delivers the confirmation link
 * (path token, ?token_hash=, ?code=, or an implicit-flow hash session).
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const tokenHash =
    params.token || searchParams.get("token_hash") || searchParams.get("token") || "";
  const code = searchParams.get("code") || "";
  const urlError =
    searchParams.get("error_description") || searchParams.get("error") || "";
  const otpType = (searchParams.get("type") || "email") as EmailOtpType;
  const hashHasAuth = /access_token|error/.test(window.location.hash);
  const isVerification = Boolean(tokenHash || code || urlError || hashHasAuth);

  const [mode, setMode] = useState<"pending" | "verifying" | "success" | "error">(
    isVerification ? "verifying" : "pending",
  );

  const email =
    (location.state as { email?: string } | null)?.email ||
    sessionStorage.getItem("pending_verification_email") ||
    "";

  /* ── Run verification when a token / code is present in the URL ── */
  useEffect(() => {
    if (!isVerification) return;
    let cancelled = false;

    async function runVerification() {
      if (urlError || window.location.hash.includes("error")) {
        if (!cancelled) setMode("error");
        return;
      }
      try {
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (error) throw error;
          if (!cancelled) setMode("success");
          return;
        }

        // PKCE code or implicit-flow hash — Supabase may already have
        // established the session via detectSessionInUrl. Poll for it.
        for (let i = 0; i < 20 && !cancelled; i++) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            if (!cancelled) setMode("success");
            return;
          }
          if (code && i === 0) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
              if (!cancelled) setMode("success");
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
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownTimer.current);
          setResendState("idle");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email) {
      navigate("/signup");
      return;
    }
    setResendState("sending");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      setResendState("idle");
      return;
    }
    setResendState("sent");
    setTimeout(startCooldown, 2500);
  };

  const handleContinue = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const route = session ? await resolvePostAuthRoute(session.user.id) : "/login";
    navigate(route, { replace: true });
  };

  /* ── Render ── */
  let content: ReactNode;

  if (mode === "verifying") {
    content = (
      <div className="flex flex-col items-center text-center">
        <Loader2
          className="animate-spin"
          style={{ width: "56px", height: "56px", color: "#E8571A" }}
        />
        <h2
          style={{
            marginTop: "20px",
            fontFamily: "Inter, sans-serif",
            fontSize: "16px",
            fontWeight: 600,
            color: "rgba(255, 255, 255, 0.92)",
          }}
        >
          Verifying your email…
        </h2>
        <p
          style={{
            marginTop: "6px",
            fontFamily: "Inter, sans-serif",
            fontSize: "13px",
            color: "rgba(255, 255, 255, 0.60)",
          }}
        >
          Just a moment.
        </p>
      </div>
    );
  } else if (mode === "success") {
    content = <AuthEmailSuccessCard onContinue={handleContinue} />;
  } else if (mode === "error") {
    content = (
      <AuthEmailErrorCard
        onResend={handleResend}
        onBackToSignIn={() => navigate("/login", { replace: true })}
      />
    );
  } else {
    content = (
      <AuthEmailVerificationCard
        email={email || "your email"}
        resendState={resendState}
        cooldownSeconds={cooldown}
        onResend={handleResend}
        onChangeEmail={() => navigate("/signup")}
      />
    );
  }

  return (
    <>
      <SeoHead
        title="Verify your email — NeoScale"
        description="Verify your NeoScale account email."
        path="/verify-email"
        noIndex
      />
      <AuthShell>{content}</AuthShell>
    </>
  );
}
