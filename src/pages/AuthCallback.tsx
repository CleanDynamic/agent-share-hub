import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCallbackCard } from "@/components/auth/AuthCallbackCard";
import { resolvePostAuthRoute } from "@/lib/auth/postAuthRoute";
import { returnPathFrom } from "@/lib/auth/safeReturnPath";
import type { OAuthProvider } from "@/components/auth/OAuthButtons";

/**
 * OAuth return target. The Supabase client (detectSessionInUrl) processes the
 * code/hash on load; this page waits for the resulting session, then routes
 * the user on: to the return address the provider carried back (G18, checked
 * again by safeReturnPath, G16), or else profile completion / onboarding / home.
 *
 * G19: an error in the address shows the failed state at once; no session within
 * 3 seconds shows it too.
 */
const SESSION_WAIT_MS = 3_000;
const SESSION_LOOK_MS = 250;

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const provider = (searchParams.get("provider") as OAuthProvider | null) ?? undefined;
  const { hash } = useLocation();
  const [state, setState] = useState<"pending" | "failed">("pending");

  useEffect(() => {
    let cancelled = false;

    const hashError = hash.includes("error") || window.location.hash.includes("error");
    const queryError = searchParams.get("error") || searchParams.get("error_description");
    if (hashError || queryError) {
      setState("failed");
      return;
    }

    async function complete() {
      // Poll briefly for the session Supabase establishes from the redirect, for 3 seconds at most.
      const deadline = Date.now() + SESSION_WAIT_MS;
      while (!cancelled) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const route = returnPathFrom(searchParams) ?? (await resolvePostAuthRoute(session.user.id));
          if (!cancelled) navigate(route, { replace: true });
          return;
        }
        if (Date.now() + SESSION_LOOK_MS > deadline) break;
        await new Promise((r) => setTimeout(r, SESSION_LOOK_MS));
      }
      if (!cancelled) setState("failed");
    }

    complete();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams, hash]);

  return (
    <>
      <SeoHead
        title="Signing in"
        description="Completing sign-in."
        path="/auth/callback"
        noIndex
      />
      <AuthShell>
        <AuthCallbackCard
          state={state}
          provider={provider}
          onBackToSignIn={() => navigate("/login", { replace: true })}
        />
      </AuthShell>
    </>
  );
}
