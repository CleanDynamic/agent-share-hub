import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { LoginCard, type LoginMethod } from "@/components/auth/LoginCard";
import { startOAuthSignIn } from "@/lib/auth/oauth";
import { resolvePostAuthRoute } from "@/lib/auth/postAuthRoute";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoggedIn } = useAuth();
  // Honour both the existing `redirect` param and the `returnTo` alias.
  const redirectParam = searchParams.get("redirect") || searchParams.get("returnTo");

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Already signed in — bounce to the destination (or home).
  useEffect(() => {
    if (isLoggedIn) navigate(redirectParam || "/", { replace: true });
  }, [isLoggedIn, navigate, redirectParam]);

  const handleEmailLogin = async () => {
    setIsSubmitting(true);
    setError("");
    try {
      let emailToUse = emailOrUsername.trim();

      // Resolve username → email when the identifier isn't an email address.
      if (!emailToUse.includes("@")) {
        const { data: resolved, error: rpcError } = await supabase.rpc(
          "get_email_by_username",
          { _username: emailToUse },
        );
        if (rpcError || !resolved) {
          setError("Wrong email or password");
          setIsSubmitting(false);
          return;
        }
        emailToUse = resolved;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("email not confirmed")) {
          setError("Please verify your email before signing in — check your inbox.");
        } else {
          setError("Wrong email or password");
        }
        setIsSubmitting(false);
        return;
      }

      const destination =
        redirectParam || (data.user ? await resolvePostAuthRoute(data.user.id) : "/");
      navigate(destination, { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (method: LoginMethod) => {
    if (method === "email") {
      await handleEmailLogin();
      return;
    }
    // OAuth — this redirects the whole page to the provider.
    const oauthError = await startOAuthSignIn(method);
    if (oauthError) setError(oauthError);
  };

  return (
    <>
      <SeoHead
        title="Sign in — NeoScale"
        description="Sign in to your NeoScale account."
        path="/login"
        noIndex
      />
      <LoginCard
        emailOrUsername={emailOrUsername}
        password={password}
        rememberMe={rememberMe}
        onEmailOrUsernameChange={(v) => {
          setEmailOrUsername(v);
          setError("");
        }}
        onPasswordChange={(v) => {
          setPassword(v);
          setError("");
        }}
        onRememberMeChange={setRememberMe}
        onForgotPassword={() => navigate("/reset-password")}
        onSubmit={handleSubmit}
        onBack={() => navigate(-1)}
        isSubmitting={isSubmitting}
        error={error}
      />
    </>
  );
}
