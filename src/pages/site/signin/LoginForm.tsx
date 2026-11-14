/* UI-P36 — the Sign in card's body.

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

import { AuthCheck, AuthField, AuthForm, Gap, OrRule, PrimaryAction, ProviderButtons, PushDown } from "./AuthParts";
import { DIALOG, useAuthSizes } from "./authSizes";
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
  /** Where "Forgot password?" goes: the dialog's reset view, as an address, so it does not leave the page behind. */
  forgotTo?: string;
  /** The history state that link carries (how deep into the dialog it goes). */
  forgotState?: unknown;
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
  forgotTo = "/reset-password",
  forgotState,
}: LoginFormProps) {
  const { phone } = useAuthSizes();
  const room = useRoom();
  if (!phone) {
    /* The dialog's column (Reference A): providers, 16, the divider, 16, the two fields 16 apart, 4 and the reserved error
       line, 8, the remember row, then the primary on the bottom padding line. */
    return (
      <>
        <ProviderButtons onProvider={onProvider} loadingProvider={loadingProvider} />
        <Gap size={16} />
        <OrRule>Or with email</OrRule>
        <Gap size={16} />
        <AuthForm onSubmit={onSubmit}>
          <AuthField
            label="Email or username"
            icon={User}
            value={emailOrUsername}
            onChange={onEmailOrUsernameChange}
            placeholder="Email or username"
            required
            autoComplete="username"
          />
          <Gap size={16} />
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
            reserveMessage
          />
          <Gap size={8} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: DIALOG.row, fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>
            <AuthCheck id="remember" checked={rememberMe} onChange={onRememberMeChange}>
              Keep me signed in
            </AuthCheck>
            <FrameLink
              to={forgotTo}
              state={forgotState}
              style={{
                lineHeight: `${DIALOG.row}px`,
                color: SIGNIN_COLOURS[room].link,
                textDecoration: "underline",
                textUnderlineOffset: 4,
                textDecorationThickness: 1,
              }}
            >
              Forgot password?
            </FrameLink>
          </div>
          <PushDown />
          <PrimaryAction disabled={!canSubmit} loading={isSubmitting} loadingText="Signing in">
            Sign in
          </PrimaryAction>
        </AuthForm>
      </>
    );
  }
  return (
    <>
      <ProviderButtons onProvider={onProvider} loadingProvider={loadingProvider} />
      <OrRule>or with email</OrRule>
      <AuthForm onSubmit={onSubmit}>
        <AuthField
          label="Email or username"
          icon={User}
          value={emailOrUsername}
          onChange={onEmailOrUsernameChange}
          placeholder="Email or username"
          required
          autoComplete="username"
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
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>
          <AuthCheck id="remember" checked={rememberMe} onChange={onRememberMeChange}>
            Keep me signed in
          </AuthCheck>
          <FrameLink
            to={forgotTo}
            data-hit=""
            /* The reference's phone says "Forgot?"; the name is the whole sentence. */
            aria-label={phone ? "Forgot password?" : undefined}
            style={{
              position: "relative",
              /* A 28px target in a row the reference draws about 19px tall. */
              padding: "6px 0",
              margin: "-6px 0",
              lineHeight: "19px",
              color: t.action,
              textDecoration: "underline",
              textUnderlineOffset: 4,
              textDecorationThickness: 1,
            }}
          >
            {phone ? "Forgot?" : "Forgot password?"}
          </FrameLink>
        </div>
        <PrimaryAction disabled={!canSubmit} loading={isSubmitting} loadingText="Signing in">
          Sign in
        </PrimaryAction>
      </AuthForm>
    </>
  );
}

export default LoginForm;
