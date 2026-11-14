/* The Join free view of the sign-in dialog: the container (was UI-P36's `/signup` page).

   A REPAINT OF THE FORM, NOT A REWRITE OF JOINING. This is `pages/Signup.tsx`'s
   state and handlers, in the same order and with the same words: the username is
   lower-cased as it is typed, checked for length and characters at once and for
   availability 400ms after the last key (a newer key supersedes an older check),
   the email is checked when it is left, the password's strength is worked out
   200ms after the last key, a signed-in visitor is sent Home, and a successful
   sign-up goes to onboarding when the project returned a session and otherwise
   to the pending-verification view with the address remembered (in the dialog, the verify view replaces this one).

   What the Supabase call became is only where it lives: a named function in
   `src/lib/auth/`, since a component may not call Supabase. */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { InputValidation } from "@/components/auth/AuthInput";
import type { OAuthProvider } from "@/components/auth/OAuthButtons";
import { calculatePasswordStrength, type PasswordStrength } from "@/components/auth/PasswordStrengthMeter";
import { useAuth } from "@/contexts/AuthContext";
import { checkUsernameAvailability } from "@/lib/auth/checkUsernameAvailability";
import { startOAuthSignIn } from "@/lib/auth/oauth";
import { signUpWithEmail } from "@/lib/auth/signUpWithEmail";
import { PRIVACY_REVIEWED, TERMS_REVIEWED } from "@/content/legal/reviewed";

import { signupCanSubmit } from "./authModel";
import { SignupForm } from "./SignupForm";
import { useSignInNavigation } from "./useSignInNavigation";

const EMAIL_REGEX = /^[^@]+@[^@]+\.[^@]+$/;

/* UX-12 P4: the Terms and Privacy policy open in the same tab, so what has been typed is kept for the way back. Name, username
   and email only (never the password, never the tick), in this tab's session storage, put there when a legal link is followed
   and taken out again as soon as the form is back. */
const DRAFT_KEY = "signup_draft";
interface SavedDraft { displayName: string; username: string; email: string }
function readSavedDraft(): SavedDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedDraft>;
    return { displayName: String(value.displayName ?? ""), username: String(value.username ?? ""), email: String(value.email ?? "") };
  } catch {
    return null;
  }
}

export function SignupPanel() {
  const navigate = useNavigate();
  const views = useSignInNavigation();
  const { isLoggedIn } = useAuth();

  const [saved] = useState(readSavedDraft);
  const [displayName, setDisplayName] = useState(saved?.displayName ?? "");
  const [username, setUsername] = useState(saved?.username ?? "");
  const [email, setEmail] = useState(saved?.email ?? "");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");

  const [usernameValidation, setUsernameValidation] = useState<InputValidation>({ state: "idle" });
  const [emailValidation, setEmailValidation] = useState<InputValidation>({ state: "idle" });
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>("weak");

  // Back from reading the Terms or Privacy policy: check what was kept, then let it go.
  useEffect(() => {
    if (!saved) return;
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* storage is not available: nothing was kept either */
    }
    if (saved.username) handleUsernameChange(saved.username);
    if (saved.email) handleEmailBlur();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keepForLegal = () => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ displayName, username, email }));
    } catch {
      /* the form is simply empty on the way back */
    }
  };

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
        views.replaceWith("verify", { email: cleanEmail });
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
      showLegalLine={TERMS_REVIEWED && PRIVACY_REVIEWED}
      onLeaveForLegal={keepForLegal}
    />
  );
}

export default SignupPanel;
