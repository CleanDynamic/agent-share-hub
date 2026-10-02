/* UI-P36 — `/login` in the entrance's frame: the container.

   A REPAINT OF THE FORM, NOT A REWRITE OF SIGN-IN. This is `pages/Login.tsx`'s
   state and handlers, in the same order and with the same words: the redirect
   honours both `redirect` and its `returnTo` alias, a signed-in visitor is sent
   on at once, an identifier without "@" is a username, a refused password says
   "Wrong email or password" whichever way it was refused, an unconfirmed email
   says so, and a successful sign-in goes to the redirect if there is one and
   otherwise to wherever `resolvePostAuthRoute` says (onboarding, or Home).

   What the Supabase calls became is only where they live: they are named
   functions in `src/lib/auth/` now, since a component may not call Supabase.
   Identity still comes from `useAuth()`. */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import type { OAuthProvider } from "@/components/auth/OAuthButtons";
import { useAuth } from "@/contexts/AuthContext";
import { startOAuthSignIn } from "@/lib/auth/oauth";
import { resolvePostAuthRoute } from "@/lib/auth/postAuthRoute";
import { signInWithEmailOrUsername } from "@/lib/auth/signInWithEmailOrUsername";

import { loginCanSubmit } from "./authModel";
import { LoginForm } from "./LoginForm";
import { SignInShell } from "./SignInShell";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoggedIn } = useAuth();
  // Honour both the existing `redirect` param and the `returnTo` alias.
  const redirectParam = searchParams.get("redirect") || searchParams.get("returnTo");

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");

  // Already signed in — bounce to the destination (or home).
  useEffect(() => {
    if (isLoggedIn) navigate(redirectParam || "/", { replace: true });
  }, [isLoggedIn, navigate, redirectParam]);

  const handleEmailLogin = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      const result = await signInWithEmailOrUsername(emailOrUsername, password);

      if (result.outcome !== "signed-in") {
        setError(
          result.outcome === "email-not-confirmed"
            ? "Please verify your email before signing in — check your inbox."
            : "Wrong email or password",
        );
        setIsSubmitting(false);
        return;
      }

      const destination = redirectParam || (result.userId ? await resolvePostAuthRoute(result.userId) : "/");
      navigate(destination, { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleProvider = async (provider: OAuthProvider) => {
    setLoadingProvider(provider);
    // OAuth — this redirects the whole page to the provider.
    const oauthError = await startOAuthSignIn(provider);
    if (oauthError) {
      setError(oauthError);
      // The page is still here, so the buttons are for trying again.
      setLoadingProvider(null);
    }
  };

  return (
    <>
      <SeoHead title="Sign in — buildgallery" description="Sign in to your buildgallery account." path="/login" noIndex />
      <SignInShell mode="login">
        <LoginForm
          emailOrUsername={emailOrUsername}
          password={password}
          rememberMe={rememberMe}
          onEmailOrUsernameChange={(value) => {
            setEmailOrUsername(value);
            setError("");
          }}
          onPasswordChange={(value) => {
            setPassword(value);
            setError("");
          }}
          onRememberMeChange={setRememberMe}
          canSubmit={loginCanSubmit(emailOrUsername, password)}
          isSubmitting={isSubmitting}
          onSubmit={handleEmailLogin}
          onProvider={handleProvider}
          loadingProvider={loadingProvider}
          error={error}
        />
      </SignInShell>
    </>
  );
}

export default LoginPage;
