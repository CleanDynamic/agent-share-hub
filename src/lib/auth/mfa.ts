// Part A: the second factor (an authenticator app), on the member's own session, from the browser.
//
// Supabase Auth holds the factors and checks the codes. A session becomes aal2 only when a code from a verified factor
// is checked on it. The database (G3) then asks for aal2 from every member who has a verified factor.
//
// G1: adding or removing an authenticator first proves it is the member: their password when they have no factor yet,
// otherwise a fresh code from the authenticator. Nothing here uses a service key.

import { supabase } from "@/integrations/supabase/client";
import { oneShotCaptchaToken } from "@/lib/auth/turnstile";
import { SettingsError } from "@/lib/settings/useAction";

/** A verified authenticator, as the Settings group lists it. */
export interface Authenticator {
  id: string;
  name: string;
  createdAt: string;
}

/** What the member needs to add an authenticator: a QR code to scan, or the same secret to type. */
export interface Enrolment {
  factorId: string;
  /** An SVG data address from Supabase, for an <img>. */
  qrCode: string;
  secret: string;
}

export const CODE_LENGTH = 6;
export const DEFAULT_NAME = "Authenticator app";

export const MFA_COPY = {
  group: "Two-step sign-in",
  intro: "After your password, enter a code from an authenticator app on your phone.",
  none: "Not set up. Add an authenticator to ask for a code after your password.",
  add: "Add an authenticator",
  remove: "Remove",
  scan: "Scan this QR code with your authenticator app, or type the key below into it.",
  keyLabel: "Key",
  confirmCode: "Enter the 6-digit code it shows",
  passwordFirst: "Enter your password to continue.",
  codeFirst: "Enter a code from your authenticator to continue.",
  setPasswordFirst: "Set a password first. Then you can add an authenticator.",
  wrongCode: "That code didn't work. Check the time on your phone is right, and try again.",
  wrongPassword: "That isn't your password.",
  codeShape: "Enter the 6 digits from your authenticator.",
  removed: "Authenticator removed.",
  added: "Authenticator added. You'll be asked for a code after your password.",
  nameTaken: "You already have an authenticator with that name. Choose another.",
} as const;

interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

/** True for exactly six digits. Spaces a phone puts in the middle are taken out first. */
export function cleanCode(text: string): string | null {
  const digits = text.replace(/\s+/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

function refusal(error: AuthErrorLike, fallback: string): SettingsError {
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (/mfa_verification_failed|invalid totp|invalid code|expired/.test(text)) return new SettingsError(MFA_COPY.wrongCode);
  if (/friendly name|already exists|mfa_factor_name_conflict/.test(text)) return new SettingsError(MFA_COPY.nameTaken);
  return new SettingsError(fallback);
}

/** The member's verified authenticators, oldest first. */
export async function listAuthenticators(): Promise<Authenticator[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp ?? [])
    .filter((factor) => factor.status === "verified")
    .map((factor) => ({ id: factor.id, name: factor.friendly_name?.trim() || DEFAULT_NAME, createdAt: factor.created_at }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Check a code from one of the member's authenticators on this session. The session is aal2 afterwards. */
export async function verifyCode(factorId: string, text: string): Promise<void> {
  const code = cleanCode(text);
  if (!code) throw new SettingsError(MFA_COPY.codeShape);
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw refusal(error, MFA_COPY.wrongCode);
}

/**
 * G1: prove it is the member before a factor changes. With a factor: a fresh code from it. Without: the password, checked
 * by signing in with it (with the bot check, as every sign-in has).
 */
export async function confirmIdentity(input: { email: string | null; factors: readonly Authenticator[]; password?: string | null; code?: string | null; factorId?: string | null }): Promise<void> {
  if (input.factors.length > 0) {
    const factorId = input.factorId ?? input.factors[0].id;
    await verifyCode(factorId, input.code ?? "");
    return;
  }
  if (!input.password) throw new SettingsError(MFA_COPY.passwordFirst);
  if (!input.email) throw new SettingsError("Sign in again, then try once more.");
  const { token: captchaToken } = await oneShotCaptchaToken();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password, options: { captchaToken } });
  if (error) throw new SettingsError(MFA_COPY.wrongPassword);
}

/** Start adding an authenticator. A half-finished one from an earlier try is cleared first, so its name is free. */
export async function startAuthenticator(name: string): Promise<Enrolment> {
  const friendlyName = name.trim().slice(0, 60) || DEFAULT_NAME;
  const { data: listed } = await supabase.auth.mfa.listFactors();
  for (const factor of listed?.all ?? []) {
    if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName });
  if (error || !data) throw refusal(error ?? {}, "Couldn't start adding an authenticator. Try again.");
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Finish adding it: the first code it shows proves it is set up. The session is aal2 afterwards. */
export async function confirmAuthenticator(factorId: string, text: string): Promise<void> {
  await verifyCode(factorId, text);
}

/** Give up on a half-finished authenticator. */
export async function cancelAuthenticator(factorId: string): Promise<void> {
  await supabase.auth.mfa.unenroll({ factorId });
}

/** Remove a verified authenticator. Supabase asks for an aal2 session, which confirmIdentity has just made. */
export async function removeAuthenticator(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw refusal(error, "Couldn't remove that authenticator. Try again.");
}

/** "16 Nov 2026" */
export function addedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Added";
  return `Added ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}
