import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { OAuthButtons, type OAuthProvider } from "./OAuthButtons";
import { AuthDivider } from "./AuthDivider";
import { AuthInput, type InputValidation } from "./AuthInput";
import { AuthCheckbox } from "./AuthCheckbox";
import { AuthButton } from "./AuthButton";
import { PasswordStrengthMeter, type PasswordStrength } from "./PasswordStrengthMeter";
import { t } from "@/lib/theme/tokens";
import { fieldMessageStyle } from "@/lib/theme/controls";
import { FIGTREE } from "@/lib/theme/type";

export type SignupMethod = "email" | OAuthProvider;

export interface SignupCardProps {
  displayName: string;
  username: string;
  email: string;
  password: string;
  agreedToTerms: boolean;
  onDisplayNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onEmailBlur?: () => void;
  onPasswordChange: (value: string) => void;
  onAgreedToTermsChange: (value: boolean) => void;
  usernameValidation: InputValidation;
  emailValidation: InputValidation;
  passwordStrength: PasswordStrength;
  onSubmit: (method: SignupMethod) => void;
  isSubmitting: boolean;
  /** General submit error shown below the form (e.g. email already registered). */
  error?: string;
}

export function SignupCard({
  displayName,
  username,
  email,
  password,
  agreedToTerms,
  onDisplayNameChange,
  onUsernameChange,
  onEmailChange,
  onEmailBlur,
  onPasswordChange,
  onAgreedToTermsChange,
  usernameValidation,
  emailValidation,
  passwordStrength,
  onSubmit,
  isSubmitting,
  error,
}: SignupCardProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);

  const handleOAuthClick = (provider: OAuthProvider) => {
    setLoadingProvider(provider);
    onSubmit(provider);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit("email");
  };

  const isFormValid =
    displayName.trim() &&
    username.trim() &&
    email.trim() &&
    password.length >= 8 &&
    agreedToTerms &&
    usernameValidation.state !== "invalid" &&
    usernameValidation.state !== "checking" &&
    emailValidation.state !== "invalid";

  /* Both underlined at rest — a link told apart by colour alone fails WCAG
     1.4.1, and a touch reader never gets the hover that would reveal it. */
  const linkStyle = {
    color: t.action,
    textDecoration: "underline",
    textUnderlineOffset: "4px",
    textDecorationThickness: "1px",
  };

  const footerLinkStyle = linkStyle;

  return (
    <AuthShell>
      <OAuthButtons onOAuthClick={handleOAuthClick} loadingProvider={loadingProvider} />

      <AuthDivider text="or sign up with email" />

      <form onSubmit={handleFormSubmit}>
        <div className="flex flex-col" style={{ gap: "16px" }}>
          <AuthInput
            label="Display name"
            value={displayName}
            onChange={onDisplayNameChange}
            placeholder="Your name"
            required
            autoComplete="name"
          />

          <AuthInput
            label="Username"
            value={username}
            onChange={(val) => onUsernameChange(val.toLowerCase())}
            placeholder="username"
            helperText={username ? `neoscale.ai/${username}` : undefined}
            validation={usernameValidation}
            required
            autoComplete="username"
          />

          <AuthInput
            label="Email"
            type="email"
            value={email}
            onChange={onEmailChange}
            onBlur={onEmailBlur}
            placeholder="you@example.com"
            validation={emailValidation}
            required
            autoComplete="email"
          />

          <div>
            <AuthInput
              label="Password"
              value={password}
              onChange={onPasswordChange}
              placeholder="At least 8 characters"
              showPasswordToggle
              required
              autoComplete="new-password"
            />
            {password && <PasswordStrengthMeter strength={passwordStrength} />}
          </div>

          <div style={{ marginTop: "4px" }}>
            <AuthCheckbox
              id="terms"
              checked={agreedToTerms}
              onChange={onAgreedToTermsChange}
              label={
                <>
                  I agree to the{" "}
                  <Link to="/terms" style={linkStyle}>
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" style={linkStyle}>
                    Privacy Policy
                  </Link>
                </>
              }
            />
          </div>
        </div>

        {error && (
          /* Under the fields it is about, never only a toast. */
          <p
            role="alert"
            style={{
              ...fieldMessageStyle,
              marginTop: "14px",
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
          loadingText="Creating account..."
        >
          Create account
        </AuthButton>
      </form>

      <div
        style={{
          marginTop: "20px",
          textAlign: "center",
          fontFamily: FIGTREE,
          fontSize: "12px",
          fontWeight: 400,
          color: t.text2,
        }}
      >
        Already have an account?{" "}
        <Link to="/login" style={footerLinkStyle}>
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
