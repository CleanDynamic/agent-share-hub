/* The Sign in view of the sign-in dialog: the container (was UI-P36's `/login` page).

   A REPAINT OF THE FORM, NOT A REWRITE OF SIGN-IN. This is `pages/Login.tsx`'s
   state and handlers, in the same order and with the same words: the redirect
   honours both `redirect` and its `returnTo` alias, a signed-in visitor is sent
   on at once, sign-in is by email only (G4: text without "@" is answered before any request), a refused password says
   "That email or password isn't right." whichever way it was refused (G12: an unconfirmed email too), and a successful sign-in goes to the redirect if there is one and
   otherwise to wherever `resolvePostAuthRoute` says (onboarding, or Home).

   What the Supabase calls became is only where they live: they are named
   functions in `src/lib/auth/` now, since a component may not call Supabase.
   Identity still comes from `useAuth()`.

   IN THE DIALOG, the destination is unchanged: `redirect` (or `returnTo`) when the address has one, which the header
   sets to the page the dialog was opened over, and otherwise `resolvePostAuthRoute`. "Forgot password?" is the reset
   view's address on the same page, a push. */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { OAuthProvider } from "@/components/auth/OAuthButtons";
import { useAuth } from "@/contexts/AuthContext";
import { startOAuthSignIn } from "@/lib/auth/oauth";
import { resolvePostAuthRoute } from "@/lib/auth/postAuthRoute";
import { messageFor } from "@/lib/auth/authMessages";
import { resendSignupEmail } from "@/lib/auth/emailLink";
import { returnPathFrom } from "@/lib/auth/safeReturnPath";
import { signInWithEmail } from "@/lib/auth/signInWithEmail";

import { loginCanSubmit } from "./authModel";
import { useDialogCaptcha, VERIFY_FAILED } from "./dialogCaptcha";
import { LoginForm } from "./LoginForm";
import { setSigningIn } from "./signinActivity";
import { useSignInNavigation } from "./useSignInNavigation";

const RESEND_ANSWER = "If that address needs verifying, we've sent a link.";

export function LoginPanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoggedIn } = useAuth();
  // Honour both the existing `redirect` param and the `returnTo` alias, through safeReturnPath (G16): only a path here.
  const redirectParam = returnPathFrom(searchParams);

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");
  const [resendAnswer, setResendAnswer] = useState("");
  const views = useSignInNavigation();
  const captcha = useDialogCaptcha();

  // The halftone layer's signing-in ripple, while the request or a provider is out.
  useEffect(() => {
    setSigningIn(isSubmitting || loadingProvider !== null);
    return () => setSigningIn(false);
  }, [isSubmitting, loadingProvider]);

  // Already signed in — bounce to the destination (or home).
  useEffect(() => {
    if (isLoggedIn) navigate(redirectParam || "/", { replace: true });
  }, [isLoggedIn, navigate, redirectParam]);

  const handleEmailLogin = async () => {
    // G4: email only. Text with no "@" is answered here, and no request is sent.
    if (!emailOrUsername.includes("@")) {
      setError("Sign in with your email address.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    const check = await captcha.token();
    if (check.failed) {
      captcha.reset();
      setError(VERIFY_FAILED);
      setIsSubmitting(false);
      return;
    }
    try {
      const result = await signInWithEmail(emailOrUsername, password, check.token);

      if (result.outcome !== "signed-in") {
        setError(result.outcome === "not-an-email" ? "Sign in with your email address." : messageFor(result.refusal));
        setIsSubmitting(false);
        return;
      }

      const destination = redirectParam || (result.userId ? await resolvePostAuthRoute(result.userId) : "/");
      navigate(destination, { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    } finally {
      // G6: a token is good for one request; the widget makes the next one.
      captcha.reset();
    }
  };

  /* G12: "Resend verification email" always answers the same sentence, whether or not the address has an account,
     needs verifying, or the request went; only a failed bot check says otherwise. */
  const handleResendVerification = async () => {
    const email = emailOrUsername.trim();
    if (email.includes("@")) {
      const check = await captcha.token();
      if (check.failed) {
        captcha.reset();
        setResendAnswer(VERIFY_FAILED);
        return;
      }
      try {
        await resendSignupEmail(email, check.token);
      } catch {
        // The answer is the same either way.
      } finally {
        captcha.reset();
      }
    }
    setResendAnswer(RESEND_ANSWER);
  };

  const handleProvider = async (provider: OAuthProvider) => {
    setLoadingProvider(provider);
    // OAuth — this redirects the whole page to the provider.
    const oauthError = await startOAuthSignIn(provider, redirectParam);
    if (oauthError) {
      setError(oauthError);
      // The page is still here, so the buttons are for trying again.
      setLoadingProvider(null);
    }
  };

  return (
    <LoginForm
      forgotTo={views.hrefFor("reset")}
      forgotState={views.linkState}
      emailOrUsername={emailOrUsername}
      password={password}
      rememberMe={rememberMe}
      onEmailOrUsernameChange={(value) => {
        setEmailOrUsername(value);
        setError("");
        setResendAnswer("");
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
      onResendVerification={handleResendVerification}
      resendAnswer={resendAnswer}
    />
  );
}

export default LoginPanel;
