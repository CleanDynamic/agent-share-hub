// UX-15 P3: the account's email, password, sign-in methods and devices.
//
// The pure half (`methodsOf`, `canUnlink`, `friendlyAuthError`, `emailProblem`, `passwordProblem`) says what the person is told; the
// other half calls Supabase Auth, from the browser, on the person's own session. Nothing here uses a service key.

import { timeoutCause } from "@/lib/query/readLimit";
import type { UserIdentity } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { calculatePasswordStrength } from "@/components/auth/PasswordStrengthMeter";
import { oneShotCaptchaToken } from "@/lib/auth/turnstile";

import { SettingsError } from "./useAction";

/** The providers the site offers (`src/lib/auth/oauth.ts`). X is registered with Supabase as `twitter`. */
export const LINKABLE = [
  { provider: "google", label: "Google" },
  { provider: "github", label: "GitHub" },
  { provider: "twitter", label: "X" },
] as const;
export type LinkableProvider = (typeof LINKABLE)[number]["provider"];

export interface SignInMethod {
  id: string;
  provider: string;
  /** `Email and password`, `Google` ... */
  label: string;
  /** The address that provider holds for the account, when it says. */
  email: string | null;
}

export const PASSWORD_MIN = 8;

export const COPY = {
  emailSent: "Check both inboxes. The change finishes when you confirm from the new address.",
  // G14: true to what happens. Other devices lose their refresh token now; the access token they hold works until it
  // expires, which is an hour by default.
  passwordChanged: "Password changed. This device stays signed in. Every other device is signed out within the hour.",
  othersNotSignedOut: "Your password changed, but other devices could not be signed out. Use Sign out everywhere.",
  // G16, in plain words: ending a session stops the device refreshing; the access token it holds runs out within the hour.
  devicesHour: "A device you sign out can keep working for up to an hour before it is signed out.",
  devicesUnavailable: "Couldn't load your devices. Sign out everywhere still works.",
  thisDevice: "This device",
  signOutDevice: (device: string) => `${device} will be signed out within the hour.`,
  signOutThisDevice: "You will be signed out here.",
  signOutEverywhere: "Sign out on every device, including this one?",
  onlyMethod: "This is the only way you can sign in. Add another first.",
  linkingOff: "Linking another account isn't switched on yet.",
} as const;

export function providerLabel(provider: string): string {
  if (provider === "email") return "Email and password";
  return LINKABLE.find((p) => p.provider === provider)?.label ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

/** The ways this account signs in, from the identities Supabase lists. Email and password first. */
export function methodsOf(identities: readonly Pick<UserIdentity, "id" | "provider" | "identity_data">[]): SignInMethod[] {
  const rows = identities.map((identity) => {
    const email = (identity.identity_data as { email?: unknown } | undefined)?.email;
    return {
      id: identity.id,
      provider: identity.provider,
      label: providerLabel(identity.provider),
      email: typeof email === "string" ? email : null,
    };
  });
  return rows.sort((a, b) => Number(b.provider === "email") - Number(a.provider === "email"));
}

export const hasPassword = (methods: readonly SignInMethod[]): boolean => methods.some((m) => m.provider === "email");

/** A method can be unlinked only while another way to sign in is left. */
export function canUnlink(methods: readonly SignInMethod[]): boolean {
  return methods.length > 1;
}

/** Providers still to link: the ones the account does not already have. */
export function linkableFor(methods: readonly SignInMethod[]): { provider: LinkableProvider; label: string }[] {
  return LINKABLE.filter((p) => !methods.some((m) => m.provider === p.provider)).map((p) => ({ provider: p.provider, label: p.label }));
}

interface AuthErrorLike {
  message?: string;
  status?: number;
  code?: string;
}

const RATE_LIMIT = "Too many requests. Wait a few minutes and try again.";

/** The sentence for an auth error: rate limits and the common refusals in words, anything else not at all (null). */
export function friendlyAuthError(error: AuthErrorLike | null | undefined): string | null {
  if (!error) return null;
  const code = error.code ?? "";
  if (error.status === 429 || code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return RATE_LIMIT;
  if (code === "email_exists" || code === "email_address_invalid") return code === "email_exists" ? "That address is already in use." : "That email address doesn't look right.";
  if (code === "same_password") return "Choose a password you haven't used.";
  if (code === "weak_password") return "Choose a stronger password.";
  if (code === "identity_already_exists") return "That account is already linked to another person.";
  if (code === "manual_linking_disabled") return COPY.linkingOff;
  if (code === "single_identity_not_deletable") return COPY.onlyMethod;
  if (code === "reauthentication_needed" || code === "reauth_nonce_missing") return "Sign in again, then try once more.";
  return null;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** What is wrong with a new email address, in a sentence, or null. */
export function emailProblem(next: string, current: string | null): string | null {
  const value = next.trim();
  if (!value) return "Enter your new email address.";
  if (!EMAIL_SHAPE.test(value)) return "That email address doesn't look right.";
  if (current && value.toLowerCase() === current.toLowerCase()) return "That is already your email address.";
  return null;
}

/** What is wrong with a new password: the same rule sign-up and reset use (8 characters), plus "not the old one". */
export function passwordProblem(next: string, current: string | null): string | null {
  if (next.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (current !== null && next === current) return "Choose a password you haven't used.";
  return null;
}

export { calculatePasswordStrength };

// ── Supabase ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface AccountSummary {
  email: string | null;
  methods: SignInMethod[];
}

export async function loadAccount(): Promise<AccountSummary> {
  const [{ data: userData, error: userError }, { data: idData, error: idError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getUserIdentities(),
  ]);
  if (userError) throw userError;
  if (idError) throw idError;
  return { email: userData.user?.email ?? null, methods: methodsOf(idData?.identities ?? []) };
}

/** Ask for an email change. Supabase's secure email change asks both inboxes. */
export async function changeEmail(next: string, current: string | null): Promise<void> {
  const problem = emailProblem(next, current);
  if (problem) throw new SettingsError(problem);
  const { error } = await supabase.auth.updateUser({ email: next.trim() }, { emailRedirectTo: `${window.location.origin}/settings/account` });
  if (error) throw friendlyAuthError(error) ? new SettingsError(friendlyAuthError(error)!) : error;
}

/**
 * Set a new password. With a password already, the current one is checked first by signing in with it (this is the
 * re-authentication Supabase does not do for `updateUser` on its own); a person with no password sets one without.
 * G14: once the new password is set, every other device is signed out and this one is kept.
 */
export async function changePassword(input: { email: string | null; current: string | null; next: string; hasPassword: boolean }): Promise<void> {
  const problem = passwordProblem(input.next, input.hasPassword ? input.current : null);
  if (problem) throw new SettingsError(problem);
  if (input.hasPassword) {
    if (!input.current) throw new SettingsError("Enter your current password.");
    if (!input.email) throw new SettingsError("Sign in again, then try once more.");
    // The current-password check is a sign-in, so it carries a bot-check token like every other (invisible widget).
    const { token: captchaToken } = await oneShotCaptchaToken();
    const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.current, options: { captchaToken } });
    if (error) throw new SettingsError(friendlyAuthError(error) ?? "That isn't your current password.");
  }
  const { error } = await supabase.auth.updateUser({ password: input.next });
  if (error) throw friendlyAuthError(error) ? new SettingsError(friendlyAuthError(error)!) : error;
  const { error: othersError } = await supabase.auth.signOut({ scope: "others" });
  if (othersError) throw new SettingsError(COPY.othersNotSignedOut);
}

/** Start linking a provider. The browser goes to the provider and comes back to this page. */
export async function linkProvider(provider: LinkableProvider): Promise<void> {
  const { error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo: `${window.location.origin}/settings/account` } });
  if (error) throw friendlyAuthError(error) ? new SettingsError(friendlyAuthError(error)!) : error;
}

/** Unlink one method. The identity object is read again: Supabase wants the whole thing, not its id. */
export async function unlinkMethod(id: string): Promise<void> {
  const { data, error: listError } = await supabase.auth.getUserIdentities();
  if (listError) throw listError;
  const identity = data?.identities.find((one) => one.id === id);
  if (!identity) throw new SettingsError("That sign-in method has already gone.");
  if ((data?.identities.length ?? 0) < 2) throw new SettingsError(COPY.onlyMethod);
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) throw friendlyAuthError(error) ? new SettingsError(friendlyAuthError(error)!) : error;
}

/** Every device, including this one. */
export async function signOutEverywhere(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw error;
}

/** G16: one of the member's sessions, as the my-sessions function sends it. No address and no token. */
export interface DeviceSession {
  id: string;
  createdAt: string | null;
  lastActive: string | null;
  userAgent: string | null;
  current: boolean;
}

interface HttpErrorLike {
  context?: { status?: number; json: () => Promise<unknown> };
}

async function messageOf(error: unknown, fallback: string): Promise<string> {
  const response = (error as HttpErrorLike).context;
  // A request that got no answer has the thrown error as its context, not a response: there is no body to read.
  const body = typeof response?.json === "function" ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
  return body?.error ?? fallback;
}

/** The member's own sessions, newest activity first, this device marked (through the my-sessions function). */
export async function listMySessions(): Promise<DeviceSession[]> {
  const { data, error } = await supabase.functions.invoke("my-sessions", { method: "POST", body: { action: "list" } });
  if (error) throw new SettingsError(await messageOf(error, COPY.devicesUnavailable), timeoutCause(error).cause);
  return ((data as { sessions?: DeviceSession[] } | null)?.sessions ?? []).slice();
}

/** Sign out one session. This device signs out in the browser; any other goes through the my-sessions function. */
export async function signOutDevice(session: Pick<DeviceSession, "id" | "current">): Promise<void> {
  if (session.current) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.functions.invoke("my-sessions", { method: "POST", body: { action: "revoke", sessionId: session.id } });
  if (error) throw new SettingsError(await messageOf(error, "Couldn't sign that device out. Try again."));
}

/** "Chrome on macOS", from the browser's own description of itself. Nothing else about the device is read. */
export function describeDevice(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS\//.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Mac OS X|Macintosh/.test(ua)
              ? "macOS"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Unknown device";
}

/** "Last active 16 Nov, 09:05", in the reader's own time. */
export function lastActiveLabel(iso: string | null): string {
  if (!iso) return "Last active: not known";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Last active: not known";
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `Last active ${day}, ${time}`;
}
