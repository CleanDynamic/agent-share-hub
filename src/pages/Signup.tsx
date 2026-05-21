import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { SignupCard, type SignupMethod } from "@/components/auth/SignupCard";
import type { InputValidation } from "@/components/auth/AuthInput";
import {
  calculatePasswordStrength,
  type PasswordStrength,
} from "@/components/auth/PasswordStrengthMeter";
import { checkUsernameAvailability } from "@/lib/auth/checkUsernameAvailability";
import { startOAuthSignIn } from "@/lib/auth/oauth";

const EMAIL_REGEX = /^[^@]+@[^@]+\.[^@]+$/;

export default function Signup() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    const t = setTimeout(() => {
      setPasswordStrength(calculatePasswordStrength(password));
    }, 200);
    return () => clearTimeout(t);
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
      EMAIL_REGEX.test(value)
        ? { state: "valid" }
        : { state: "invalid", message: "Please enter a valid email" },
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          // The handle_new_user trigger reads these snake_case keys.
          data: {
            display_name: displayName.trim(),
            username: cleanUsername,
          },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes("already") && (msg.includes("registered") || msg.includes("exist"))) {
          setEmailValidation({ state: "invalid", message: "An account with this email already exists" });
          setError("That email is already registered — try signing in instead.");
        } else {
          setError(signUpError.message);
        }
        setIsSubmitting(false);
        return;
      }

      // With email verification required, signUp returns no session — show the
      // pending page. If verification is disabled, a session is returned and we
      // can go straight into onboarding.
      if (data.session) {
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

  const handleSubmit = async (method: SignupMethod) => {
    if (method === "email") {
      await handleEmailSignup();
      return;
    }
    // OAuth — this redirects the whole page to the provider.
    const oauthError = await startOAuthSignIn(method);
    if (oauthError) setError(oauthError);
  };

  return (
    <>
      <SeoHead
        title="Join NeoScale"
        description="Create a free NeoScale account."
        path="/signup"
        noIndex
      />
      <SignupCard
        displayName={displayName}
        username={username}
        email={email}
        password={password}
        agreedToTerms={agreedToTerms}
        onDisplayNameChange={(v) => {
          setDisplayName(v);
          setError("");
        }}
        onUsernameChange={handleUsernameChange}
        onEmailChange={handleEmailChange}
        onEmailBlur={handleEmailBlur}
        onPasswordChange={(v) => {
          setPassword(v);
          setError("");
        }}
        onAgreedToTermsChange={setAgreedToTerms}
        usernameValidation={usernameValidation}
        emailValidation={emailValidation}
        passwordStrength={passwordStrength}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />
    </>
  );
}
