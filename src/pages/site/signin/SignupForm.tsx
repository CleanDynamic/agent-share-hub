/* UI-P36 — the Join card's body.

   The same card as Sign in, with the signup form's own fields in the same field
   style: display name, username (checked as it is typed), email (checked when it
   is left), password with its strength meter, and the terms. PURE and fully
   controlled; Signup.tsx's rules live in the container and in `signupCanSubmit`.

   THE FORM'S ONE ERROR SITS UNDER THE TERMS, the last thing a reader does before
   the button. "Choose an available username", "already registered" and the
   client's own refusals are about the form as a whole; what belongs to a single
   field (the username's and the email's checks) sits under that field. */

import { AtSign, Lock, Mail, User } from "lucide-react";
import { Link } from "react-router-dom";

import type { InputValidation } from "@/components/auth/AuthInput";
import type { OAuthProvider } from "@/components/auth/OAuthButtons";
import { PasswordStrengthMeter, type PasswordStrength } from "@/components/auth/PasswordStrengthMeter";
import { t } from "@/lib/theme/tokens";

import { AuthCheck, AuthField, AuthForm, FieldMessage, OrRule, PrimaryAction, ProviderButtons } from "./AuthParts";

export interface SignupFormProps {
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
  /** Every field is filled and valid and the terms are ticked. */
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  onProvider: (provider: OAuthProvider) => void;
  loadingProvider: OAuthProvider | null;
  error?: string;
}

/** A link that is told apart from the words around it by more than its colour. */
const LINK = {
  color: t.action,
  textDecoration: "underline",
  textUnderlineOffset: 4,
  textDecorationThickness: 1,
} as const;

export function SignupForm({
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
  canSubmit,
  isSubmitting,
  onSubmit,
  onProvider,
  loadingProvider,
  error,
}: SignupFormProps) {
  return (
    <>
      <ProviderButtons onProvider={onProvider} loadingProvider={loadingProvider} />
      <OrRule>or with email</OrRule>
      <AuthForm onSubmit={onSubmit}>
        <AuthField
          label="Display name"
          icon={User}
          value={displayName}
          onChange={onDisplayNameChange}
          placeholder="Your name"
          required
          autoComplete="name"
        />
        <AuthField
          label="Username"
          icon={AtSign}
          value={username}
          onChange={(value) => onUsernameChange(value.toLowerCase())}
          placeholder="username"
          helperText={username ? `buildgallery.ai/profile/${username}` : undefined}
          validation={usernameValidation}
          required
          autoComplete="username"
        />
        <AuthField
          label="Email"
          icon={Mail}
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
          <AuthField
            label="Password"
            icon={Lock}
            showPasswordToggle
            value={password}
            onChange={onPasswordChange}
            placeholder="At least 8 characters"
            required
            autoComplete="new-password"
          />
          {password ? <PasswordStrengthMeter strength={passwordStrength} /> : null}
        </div>
        <div>
          <AuthCheck id="terms" checked={agreedToTerms} onChange={onAgreedToTermsChange}>
            I agree to the{" "}
            <Link to="/terms" style={LINK}>
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" style={LINK}>
              Privacy Policy
            </Link>
          </AuthCheck>
          <FieldMessage>{error}</FieldMessage>
        </div>
        <PrimaryAction disabled={!canSubmit} loading={isSubmitting} loadingText="Creating account...">
          Create account
        </PrimaryAction>
      </AuthForm>
    </>
  );
}

export default SignupForm;
