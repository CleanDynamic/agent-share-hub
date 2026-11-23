/* UI-P36 — the Join card's body.

   The same card as Sign in, with the signup form's own fields in the same field
   style: display name, username (checked as it is typed), email (checked when it
   is left), password with its strength meter, and the terms. PURE and fully
   controlled; Signup.tsx's rules live in the container and in `signupCanSubmit`.

   THE FORM'S ONE ERROR SITS UNDER THE TERMS, the last thing a reader does before
   the button. "Choose an available username" and the
   client's own refusals are about the form as a whole; what belongs to a single
   field (the username's and the email's checks) sits under that field. */

import { AtSign, Lock, Mail, User } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router-dom";

import type { InputValidation } from "@/components/auth/AuthInput";
import type { OAuthProvider } from "@/components/auth/OAuthButtons";
import { PasswordStrengthMeter, type PasswordStrength } from "@/components/auth/PasswordStrengthMeter";
import { siteUrl } from "@/lib/site";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { AuthCheck, AuthField, AuthForm, FieldMessage, OrRule, PrimaryAction, ProviderButtons } from "./AuthParts";
import { WAITING } from "@/lib/copy/copy";
import { MINIMUM_AGE } from "@/content/legal/legalConstants";
import { termsLead } from "./termsLead";


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
  /** UX-12 P4: the line under the button, shown once both legal texts are reviewed. */
  showLegalLine?: boolean;
  /** Called as a Terms or Privacy link is followed, so the page can keep what was typed. */
  onLeaveForLegal?: () => void;
}

/** A link that is told apart from the words around it by more than its colour. */
const LINK = {
  color: t.action,
  textDecoration: "underline",
  textUnderlineOffset: 4,
  textDecorationThickness: 1,
} as const;

/** The line under the button sits in `label` and its links keep the text's colour, told apart by their underline. */
const LEGAL_LINK = { color: "inherit", textDecoration: "underline", textUnderlineOffset: 4, textDecorationThickness: 1 } as const;

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
  showLegalLine = false,
  onLeaveForLegal,
}: SignupFormProps) {
  const errorId = useId();
  const tied = error ? errorId : undefined;
  /* Synth 13: the fields, the terms and "Join free", then "or", the providers and the terms line. */
  return (
    <>
      <AuthForm onSubmit={onSubmit}>
        <AuthField
          label="Display name"
          icon={User}
          value={displayName}
          onChange={onDisplayNameChange}
          placeholder="Your name"
          required
          describedBy={tied}
          autoComplete="name"
        />
        <AuthField
          label="Username"
          icon={AtSign}
          value={username}
          onChange={(value) => onUsernameChange(value.toLowerCase())}
          placeholder="username"
          helperText={username ? siteUrl(`/profile/${username}`).replace(/^https?:\/\//, "") : undefined}
          validation={usernameValidation}
          required
          describedBy={tied}
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
          describedBy={tied}
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
            describedBy={tied}
            autoComplete="new-password"
          />
          {password ? <PasswordStrengthMeter strength={passwordStrength} /> : <p style={{ margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>At least 8 characters</p>}
        </div>
        <div>
          <AuthCheck id="terms" checked={agreedToTerms} onChange={onAgreedToTermsChange}>
            {termsLead(MINIMUM_AGE)}{" "}
            <Link to="/terms" style={LINK} onClick={onLeaveForLegal}>
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" style={LINK} onClick={onLeaveForLegal}>
              Privacy policy
            </Link>
          </AuthCheck>
          {/* G14, G15: the form's error is tied to its fields and said once, as their description, when focus goes to them. */}
          <FieldMessage id={errorId} live={false}>{error}</FieldMessage>
        </div>
        <PrimaryAction disabled={!canSubmit} loading={isSubmitting} loadingText={WAITING.signingUp}>
          Sign up
        </PrimaryAction>
      </AuthForm>
      <OrRule />
      <ProviderButtons onProvider={onProvider} loadingProvider={loadingProvider} />
        {showLegalLine ? (
          <p data-testid="signup-legal-line" style={{ margin: 0, textAlign: "center", fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>
            By signing up you agree to the{" "}
            <Link to="/terms" style={LEGAL_LINK} onClick={onLeaveForLegal}>
              Terms
            </Link>{" "}
            and have read the{" "}
            <Link to="/privacy" style={LEGAL_LINK} onClick={onLeaveForLegal}>
              Privacy policy
            </Link>
            .
          </p>
        ) : null}
    </>
  );
}

export default SignupForm;
