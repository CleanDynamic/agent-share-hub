import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCallbackCard } from "@/components/auth/AuthCallbackCard";
import { resolvePostAuthRoute } from "@/lib/auth/postAuthRoute";
import type { OAuthProvider } from "@/components/auth/OAuthButtons";

/**
 * OAuth return target. The Supabase client (detectSessionInUrl) processes the
 * code/hash on load; this page waits for the resulting session, then routes
 * the user on (profile completion / onboarding / home).
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const provider = (searchParams.get("provider") as OAuthProvider | null) ?? undefined;
  const [state, setState] = useState<"pending" | "failed">("pending");

  useEffect(() => {
    let cancelled = false;

    const hashError = window.location.hash.includes("error");
    const queryError = searchParams.get("error") || searchParams.get("error_description");
    if (hashError || queryError) {
      setState("failed");
      return;
    }

    async function complete() {
      // Poll briefly for the session Supabase establishes from the redirect.
      for (let attempt = 0; attempt < 40 && !cancelled; attempt++) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const route = await resolvePostAuthRoute(session.user.id);
          if (!cancelled) navigate(route, { replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!cancelled) setState("failed");
    }

    complete();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  return (
    <>
      <SeoHead
        title="Signing in — NeoScale"
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
