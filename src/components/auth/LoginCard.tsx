import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "./AuthShell";
import { OAuthButtons, type OAuthProvider } from "./OAuthButtons";
import { AuthDivider } from "./AuthDivider";
import { AuthInput } from "./AuthInput";
import { AuthCheckbox } from "./AuthCheckbox";
import { AuthButton } from "./AuthButton";

export type LoginMethod = "email" | OAuthProvider;

export interface LoginCardProps {
  emailOrUsername: string;
  password: string;
  rememberMe: boolean;
  onEmailOrUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
  onForgotPassword: () => void;
  onSubmit: (method: LoginMethod) => void;
  onBack?: () => void;
  isSubmitting: boolean;
  /** Inline error shown below the form (e.g. wrong email or password). */
  error?: string;
}

export function LoginCard({
  emailOrUsername,
  password,
  rememberMe,
  onEmailOrUsernameChange,
  onPasswordChange,
  onRememberMeChange,
  onForgotPassword,
  onSubmit,
  isSubmitting,
  error,
}: LoginCardProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);

  const handleOAuthClick = (provider: OAuthProvider) => {
    setLoadingProvider(provider);
    onSubmit(provider);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit("email");
  };

  const isFormValid = emailOrUsername.trim() && password.trim();

  const footerLinkStyle = {
    color: "#E8571A",
    textDecoration: "none",
  };

  return (
    <AuthShell>
      <OAuthButtons onOAuthClick={handleOAuthClick} loadingProvider={loadingProvider} />

      <AuthDivider text="or sign in with email" />

      <form onSubmit={handleFormSubmit}>
        <div className="flex flex-col" style={{ gap: "16px" }}>
          <AuthInput
            label="Email or username"
            value={emailOrUsername}
            onChange={onEmailOrUsernameChange}
            placeholder="Email or username"
            required
            autoComplete="username"
          />

          <div>
            <AuthInput
              label="Password"
              value={password}
              onChange={onPasswordChange}
              placeholder="Enter your password"
              showPasswordToggle
              required
              autoComplete="current-password"
            />

            {/* Remember me & Forgot password row */}
            <div
              className="flex items-center justify-between"
              style={{ marginTop: "12px" }}
            >
              <AuthCheckbox
                id="remember"
                checked={rememberMe}
                onChange={onRememberMeChange}
                label="Keep me signed in"
              />
              <button
                type="button"
                onClick={onForgotPassword}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#E8571A",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                Forgot password?
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p
            style={{
              marginTop: "14px",
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              fontWeight: 400,
              color: "#ef4444",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <AuthButton
          type="submit"
          disabled={!isFormValid}
          isLoading={isSubmitting && !loadingProvider}
          loadingText="Signing in..."
        >
          Sign in
        </AuthButton>
      </form>

      <div
        style={{
          marginTop: "20px",
          textAlign: "center",
          fontFamily: "Inter, sans-serif",
          fontSize: "12px",
          fontWeight: 400,
          color: "rgba(255, 255, 255, 0.55)",
        }}
      >
        New here?{" "}
        <Link to="/signup" style={footerLinkStyle}>
          Create a free account
        </Link>
      </div>
    </AuthShell>
  );
}
