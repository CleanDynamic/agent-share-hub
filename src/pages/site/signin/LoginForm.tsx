/* Synth 13 Part B: "Sign in with your email address.", the two fields with their labels above, "Forgot password?" as an
   underlined 13 Text 3 link, "Sign in" full width, then "or", the providers and the terms line.

   UI-P36 — the Sign in card's body.

   The three providers, "or with email", the two fields, the remember and forgot
   row, and the primary action. PURE and fully controlled: the container owns
   every value, every handler and the one error, exactly as Login.tsx does, and
   this draws them.

   THE ONE ERROR SITS UNDER THE PASSWORD. "Wrong email or password", "verify your
   email first" and "something went wrong" are all about the pair of fields, and
   the password is the last of them. It is announced politely and is an empty live
   region the rest of the time. */

import { Lock, User } from "lucide-react";

import type { OAuthProvider } from "@/components/auth/OAuthButtons";
import { useRoom } from "@/components/brand/useRoom";
import { FrameLink } from "@/components/shell/FrameLink";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { AuthCheck, AuthField, AuthForm, OrRule, PrimaryAction, ProviderButtons, TermsLine } from "./AuthParts";
import { DIALOG } from "./authSizes";
import { SIGNIN_COLOURS } from "./signinColours";

export interface LoginFormProps {
  emailOrUsername: string;
  password: string;
  rememberMe: boolean;
  onEmailOrUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
  /** Both fields have something in them. */
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  onProvider: (provider: OAuthProvider) => void;
  loadingProvider: OAuthProvider | null;
  error?: string;
  /** G19: why the dialog opened, in the password field's message line until there is an error to say there. */
  notice?: string;
  /** Where "Forgot password?" goes: the dialog's reset view, as an address, so it does not leave the page behind. */
  forgotTo?: string;
  /** The history state that link carries (how deep into the dialog it goes). */
  forgotState?: unknown;
  /** G12: "Resend verification email" under the form, and the one sentence it answers once used. */
  onResendVerification?: () => void;
  resendAnswer?: string;
}

/** G12: the resend link, and in its place, the same row, the one answer it ever gives. */
function ResendVerification({ onResend, answer, colour }: { onResend: () => void; answer?: string; colour: string }) {
  return (
    <div aria-live="polite" style={{ display: "flex", alignItems: "center", height: DIALOG.row, fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>
      {answer ? (
        <span>{answer}</span>
      ) : (
        <button
          type="button"
          onClick={onResend}
          style={{
            background: "none",
            border: 0,
            padding: 0,
            font: "inherit",
            lineHeight: `${DIALOG.row}px`,
            color: colour,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 4,
            textDecorationThickness: 1,
          }}
        >
          Resend verification email
        </button>
      )}
    </div>
  );
}

export function LoginForm({
  emailOrUsername,
  password,
  rememberMe,
  onEmailOrUsernameChange,
  onPasswordChange,
  onRememberMeChange,
  canSubmit,
  isSubmitting,
  onSubmit,
  onProvider,
  loadingProvider,
  error,
  notice,
  forgotTo = "/reset-password",
  forgotState,
  onResendVerification,
  resendAnswer,
}: LoginFormProps) {
  const room = useRoom();
  /* Synth 13: one layout at every width. The line, the two fields, Forgot password and Keep me signed in, the main
     button, then "or", the providers and the terms line. */
  return (
    <>
      <p style={{ margin: 0, textAlign: "center", fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text2 }}>Sign in with your email address.</p>
      <AuthForm onSubmit={onSubmit}>
        <AuthField
          label="Email"
          icon={User}
          value={emailOrUsername}
          onChange={onEmailOrUsernameChange}
          placeholder="Email"
          required
          autoComplete="email"
        />
        <AuthField
          label="Password"
          icon={Lock}
          showPasswordToggle
          value={password}
          onChange={onPasswordChange}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
          error={error}
          notice={notice}
          reserveMessage
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: DIALOG.row, fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>
          <AuthCheck id="remember" checked={rememberMe} onChange={onRememberMeChange}>
            Keep me signed in
          </AuthCheck>
          <FrameLink
            to={forgotTo}
            state={forgotState}
            style={{
              lineHeight: `${DIALOG.row}px`,
              fontSize: 13,
              color: t.label,
              textDecoration: "underline",
              textUnderlineOffset: 4,
              textDecorationThickness: 1,
            }}
          >
            Forgot password?
          </FrameLink>
        </div>
        {onResendVerification ? <ResendVerification onResend={onResendVerification} answer={resendAnswer} colour={SIGNIN_COLOURS[room].link} /> : null}
        <PrimaryAction disabled={!canSubmit} loading={isSubmitting} loadingText="Signing in">
          Sign in
        </PrimaryAction>
      </AuthForm>
      <OrRule />
      <ProviderButtons onProvider={onProvider} loadingProvider={loadingProvider} />
      <TermsLine />
    </>
  );
}

export default LoginForm;
