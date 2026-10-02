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
import { FrameLink } from "@/components/shell/FrameLink";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { AuthCheck, AuthField, AuthForm, OrRule, PrimaryAction, ProviderButtons } from "./AuthParts";
import { useAuthSizes } from "./authSizes";

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
}: LoginFormProps) {
  const { phone } = useAuthSizes();
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>
          <AuthCheck id="remember" checked={rememberMe} onChange={onRememberMeChange}>
            Keep me signed in
          </AuthCheck>
          <FrameLink
            to="/reset-password"
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
        <PrimaryAction disabled={!canSubmit} loading={isSubmitting} loadingText="Signing in...">
          Sign in
        </PrimaryAction>
      </AuthForm>
    </>
  );
}

export default LoginForm;
