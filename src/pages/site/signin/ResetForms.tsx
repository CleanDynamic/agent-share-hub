/* UI-P36 — the bodies of the reset and verify cards.

   The words are the existing words: the request form, the new-password form,
   "Check your inbox", the dead link and the checking spinner say what they said
   before, and the verify page's own three cards (pending, "You're in", dead
   link) are the existing cards, drawn inside this card by the container. What
   changes is the surface they sit on: the fields are the join form's fields.

   PURE and fully controlled, like the other bodies. */

import type { ReactNode } from "react";
import { AlertCircle, Loader2, Lock, Mail } from "lucide-react";

import { PasswordStrengthMeter, type PasswordStrength } from "@/components/auth/PasswordStrengthMeter";
import { FrameLink } from "@/components/shell/FrameLink";
import { t } from "@/lib/theme/tokens";
import { cardTitle, FIGTREE } from "@/lib/theme/type";

import { AuthField, AuthForm, FieldMessage, PrimaryAction } from "./AuthParts";

const LEDE = {
  margin: 0,
  fontFamily: FIGTREE,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: 1.55,
  color: t.text2,
} as const;

/** The card's title and the sentence under it. The 8px that closes the pair, with the card's own gap, is the 20 the cards had. */
function Heading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <h2 style={{ ...cardTitle, margin: 0, color: t.text }}>{title}</h2>
      <p style={{ ...LEDE, marginTop: 6 }}>{children}</p>
    </div>
  );
}

/** "Back to sign in", underlined so it is told apart by more than its colour. */
function BackToSignIn({ marginTop = 0 }: { marginTop?: number }) {
  return (
    <FrameLink
      to="/login"
      style={{
        alignSelf: "center",
        marginTop,
        padding: "4px 0",
        fontFamily: FIGTREE,
        fontSize: 12,
        fontWeight: 500,
        color: t.action,
        textDecoration: "underline",
        textUnderlineOffset: 4,
        textDecorationThickness: 1,
      }}
    >
      Back to sign in
    </FrameLink>
  );
}

/* ── request ── */

export interface ResetRequestFormProps {
  email: string;
  onEmailChange: (value: string) => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  error?: string;
}

export function ResetRequestForm({ email, onEmailChange, canSubmit, isSubmitting, onSubmit, error }: ResetRequestFormProps) {
  return (
    <>
      <Heading title="Reset your password">
        Enter your email and we&apos;ll send a link that lets you set a new password. The link works once and expires after an hour.
      </Heading>
      <AuthForm onSubmit={onSubmit}>
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={onEmailChange}
          placeholder="you@example.com"
          required
          autoComplete="email"
          error={error}
        />
        <PrimaryAction disabled={!canSubmit} loading={isSubmitting} loadingText="Sending...">
          Send reset link
        </PrimaryAction>
      </AuthForm>
      <BackToSignIn />
    </>
  );
}

/* ── confirm ── */

export interface ResetConfirmFormProps {
  password: string;
  confirmPassword: string;
  passwordStrength: PasswordStrength;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  /** Under the confirm field: the two do not match. */
  mismatchError?: string;
  /** Under the form: the new password was refused. */
  error?: string;
}

export function ResetConfirmForm({
  password,
  confirmPassword,
  passwordStrength,
  onPasswordChange,
  onConfirmPasswordChange,
  canSubmit,
  isSubmitting,
  onSubmit,
  mismatchError,
  error,
}: ResetConfirmFormProps) {
  return (
    <>
      <Heading title="Choose a new password">
        Your reset link is valid. Set a new password below and we&apos;ll sign you in with it.
      </Heading>
      <AuthForm onSubmit={onSubmit}>
        <div>
          <AuthField
            label="New password"
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
          <AuthField
            label="Confirm password"
            icon={Lock}
            showPasswordToggle
            value={confirmPassword}
            onChange={onConfirmPasswordChange}
            placeholder="Re-enter your password"
            required
            autoComplete="new-password"
            error={mismatchError}
          />
          <FieldMessage>{error}</FieldMessage>
        </div>
        <PrimaryAction disabled={!canSubmit} loading={isSubmitting} loadingText="Updating...">
          Update password
        </PrimaryAction>
      </AuthForm>
    </>
  );
}

/* ── the states ── */

/** The centred column the three short states share: an icon or spinner, a title, a sentence. */
function Centred({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>{children}</div>;
}

/** Pending is `--text2`: nothing has succeeded and nothing has failed. */
export function LinkChecking({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Centred>
      <Loader2 className="animate-spin" aria-hidden="true" style={{ width: 56, height: 56, color: t.text2 }} />
      <h2 style={{ ...cardTitle, margin: "14px 0 0", color: t.text }}>{title}</h2>
      <p role="status" style={{ ...LEDE, marginTop: 4 }}>
        {children}
      </p>
    </Centred>
  );
}

export function ResetSent({ email }: { email: string }) {
  return (
    <Centred>
      <h2 style={{ ...cardTitle, margin: 0, color: t.text }}>Check your inbox</h2>
      <p style={{ ...LEDE, marginTop: 6 }}>
        If an account exists with <span style={{ color: t.text }}>{email}</span>, we sent a reset link. Open it and you can set a new
        password — it works once and expires after an hour.
      </p>
      <BackToSignIn marginTop={12} />
    </Centred>
  );
}

export function ResetLinkError({ onRequestNew }: { onRequestNew: () => void }) {
  return (
    <Centred>
      <AlertCircle aria-hidden="true" style={{ width: 56, height: 56, color: t.catBreakage, strokeWidth: 1.5 }} />
      <h2 style={{ ...cardTitle, margin: "14px 0 0", color: t.text }}>This reset link doesn&apos;t work</h2>
      <p style={{ ...LEDE, marginTop: 6 }}>
        It may have expired or already been used. Request a new one and we&apos;ll email a fresh link — your password has not changed.
      </p>
      <div style={{ width: "100%", marginTop: 12 }}>
        <PrimaryAction type="button" onClick={onRequestNew}>
          Request a new one
        </PrimaryAction>
      </div>
      <BackToSignIn marginTop={6} />
    </Centred>
  );
}
