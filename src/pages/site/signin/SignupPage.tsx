/* UI-P36 — `/signup` in the entrance's frame: the container.

   A REPAINT OF THE FORM, NOT A REWRITE OF JOINING. This is `pages/Signup.tsx`'s
   state and handlers, in the same order and with the same words: the username is
   lower-cased as it is typed, checked for length and characters at once and for
   availability 400ms after the last key (a newer key supersedes an older check),
   the email is checked when it is left, the password's strength is worked out
   200ms after the last key, a signed-in visitor is sent Home, and a successful
   sign-up goes to onboarding when the project returned a session and otherwise
   to the pending-verification page with the address remembered.

   What the Supabase call became is only where it lives: a named function in
   `src/lib/auth/`, since a component may not call Supabase. */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import type { InputValidation } from "@/components/auth/AuthInput";
import type { OAuthProvider } from "@/components/auth/OAuthButtons";
import { calculatePasswordStrength, type PasswordStrength } from "@/components/auth/PasswordStrengthMeter";
import { useAuth } from "@/contexts/AuthContext";
import { checkUsernameAvailability } from "@/lib/auth/checkUsernameAvailability";
import { startOAuthSignIn } from "@/lib/auth/oauth";
import { signUpWithEmail } from "@/lib/auth/signUpWithEmail";

import { signupCanSubmit } from "./authModel";
import { SignInShell } from "./SignInShell";
import { SignupForm } from "./SignupForm";

const EMAIL_REGEX = /^[^@]+@[^@]+\.[^@]+$/;

export function SignupPage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");

  const [usernameValidation, setUsernameValidation] = useState<InputValidation>({ state: "idle" });
  const [emailValidation, setEmailValidation] = useState<InputValidation>({ state: "idle" });
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>("weak");

  // Already signed in — auth pages aren't for you.
  useEffect(() => {
    if (isLoggedIn) navigate("/", { replace: true });
  }, [isLoggedIn, navigate]);

  // Password strength — recomputed on keystroke, debounced 200ms.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPasswordStrength(calculatePasswordStrength(password));
    }, 200);
    return () => clearTimeout(timer);
  }, [password]);

  // Username availability — debounced 400ms.
  const usernameDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const usernameSeq = useRef(0);

  const handleUsernameChange = (value: string) => {
    const next = value.toLowerCase();
    setUsername(next);
    setError("");
    clearTimeout(usernameDebounce.current);

    if (!next) {
      setUsernameValidation({ state: "idle" });
      return;
    }
    if (next.length < 3) {
      setUsernameValidation({ state: "invalid", message: "Username must be at least 3 characters" });
      return;
    }
    if (!/^[a-z0-9_]+$/.test(next)) {
      setUsernameValidation({
        state: "invalid",
        message: "Use lowercase letters, numbers and underscores only",
      });
      return;
    }

    setUsernameValidation({ state: "checking" });
    const seq = ++usernameSeq.current;
    usernameDebounce.current = setTimeout(async () => {
      const { available, suggestion } = await checkUsernameAvailability(next);
      if (seq !== usernameSeq.current) return; // a newer keystroke superseded this
      if (available) {
        setUsernameValidation({ state: "valid", message: "Username available" });
      } else {
        setUsernameValidation({
          state: "invalid",
          message: suggestion ? `Taken — try "${suggestion}"` : "That username is taken",
        });
      }
    }, 400);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setError("");
    if (emailValidation.state !== "idle") setEmailValidation({ state: "idle" });
  };

  // Email format validation on blur.
  const handleEmailBlur = () => {
    const value = email.trim();
    if (!value) {
      setEmailValidation({ state: "idle" });
      return;
    }
    setEmailValidation(
      EMAIL_REGEX.test(value) ? { state: "valid" } : { state: "invalid", message: "Please enter a valid email" },
    );
  };

  const handleEmailSignup = async () => {
    const cleanEmail = email.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      setEmailValidation({ state: "invalid", message: "Please enter a valid email" });
      return;
    }
    if (usernameValidation.state === "invalid" || cleanUsername.length < 3) {
      setError("Please choose an available username.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const result = await signUpWithEmail({
        email: cleanEmail,
        password,
        displayName: displayName.trim(),
        username: cleanUsername,
        emailRedirectTo: `${window.location.origin}/verify-email`,
      });

      if (result.outcome !== "created") {
        if (result.outcome === "already-registered") {
          setEmailValidation({ state: "invalid", message: "An account with this email already exists" });
          setError("That email is already registered — try signing in instead.");
        } else {
          setError(result.message);
        }
        setIsSubmitting(false);
        return;
      }

      // With email verification required, signUp returns no session — show the
      // pending page. If verification is disabled, a session is returned and we
      // can go straight into onboarding.
      if (result.signedIn) {
        navigate("/onboarding", { replace: true });
      } else {
        sessionStorage.setItem("pending_verification_email", cleanEmail);
        navigate("/verify-email", { state: { email: cleanEmail }, replace: true });
      }
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
      <SeoHead title="Join buildgallery" description="Create a free buildgallery account." path="/signup" noIndex />
      <SignInShell mode="signup">
        <SignupForm
          displayName={displayName}
          username={username}
          email={email}
          password={password}
          agreedToTerms={agreedToTerms}
          onDisplayNameChange={(value) => {
            setDisplayName(value);
            setError("");
          }}
          onUsernameChange={handleUsernameChange}
          onEmailChange={handleEmailChange}
          onEmailBlur={handleEmailBlur}
          onPasswordChange={(value) => {
            setPassword(value);
            setError("");
          }}
          onAgreedToTermsChange={setAgreedToTerms}
          usernameValidation={usernameValidation}
          emailValidation={emailValidation}
          passwordStrength={passwordStrength}
          canSubmit={signupCanSubmit({
            displayName,
            username,
            email,
            password,
            agreedToTerms,
            usernameValidation,
            emailValidation,
          })}
          isSubmitting={isSubmitting}
          onSubmit={handleEmailSignup}
          onProvider={handleProvider}
          loadingProvider={loadingProvider}
          error={error}
        />
      </SignInShell>
    </>
  );
}

export default SignupPage;
