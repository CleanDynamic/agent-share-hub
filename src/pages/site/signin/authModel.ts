/* UI-P36 — the sign-in pages' small pure pieces: what the switch carries across,
   what an emailed link carried, and when each form may be sent.

   The gates are the ones the legacy cards computed in their render; the link
   reading is the one ResetPassword and VerifyEmail did inline. They are here so
   the containers and the route can share them, and so each can be tested. */

import type { EmailOtpType } from "@supabase/supabase-js";

import type { InputValidation } from "@/components/auth/AuthInput";

export type AuthMode = "login" | "signup" | "reset" | "verify";

/**
 * The query string the Sign in · Join free switch carries to the other page:
 * the address the visitor was heading for, as `?redirect=…`. `returnTo` is the
 * alias Login also honours; it is carried under the name the rest of the app
 * writes. Nothing else rides along.
 */
export function carriedSearch(params: URLSearchParams): string {
  const redirect = params.get("redirect") || params.get("returnTo");
  return redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
}

/** What an emailed link carried, read the way ResetPassword and VerifyEmail read it. */
export interface EmailLinkParams {
  /** A token in the path or the query. */
  tokenHash: string;
  /** A PKCE code. */
  code: string;
  /** An error the link came back with. */
  urlError: string;
  /** What the token is for, when the link says (a confirmation: "email" unless told otherwise). */
  otpType: EmailOtpType;
  /** The URL's hash holds a session or an error: the implicit flow. */
  hashHasAuth: boolean;
  /** Any of the above: the visitor arrived from an email, not by typing the address. */
  present: boolean;
}

export function readEmailLink(pathToken: string | undefined, search: URLSearchParams, hash: string): EmailLinkParams {
  const tokenHash = pathToken || search.get("token_hash") || search.get("token") || "";
  const code = search.get("code") || "";
  const urlError = search.get("error_description") || search.get("error") || "";
  const otpType = (search.get("type") || "email") as EmailOtpType;
  const hashHasAuth = /access_token|error/.test(hash);
  return { tokenHash, code, urlError, otpType, hashHasAuth, present: Boolean(tokenHash || code || urlError || hashHasAuth) };
}

/** Sign in is sent when both fields have something in them. */
export function loginCanSubmit(emailOrUsername: string, password: string): boolean {
  return Boolean(emailOrUsername.trim() && password.trim());
}

export interface SignupGate {
  displayName: string;
  username: string;
  email: string;
  password: string;
  agreedToTerms: boolean;
  usernameValidation: InputValidation;
  emailValidation: InputValidation;
}

/** Join is sent when every field is filled, the password is long enough, the terms are ticked and nothing is invalid or still being checked. */
export function signupCanSubmit(gate: SignupGate): boolean {
  return Boolean(
    gate.displayName.trim() &&
      gate.username.trim() &&
      gate.email.trim() &&
      gate.password.length >= 8 &&
      gate.agreedToTerms &&
      gate.usernameValidation.state !== "invalid" &&
      gate.usernameValidation.state !== "checking" &&
      gate.emailValidation.state !== "invalid",
  );
}

/** The reset request is sent when there is an email to send it to. */
export function resetRequestCanSubmit(email: string): boolean {
  return email.trim().length > 0;
}

/** The new password is sent when it is long enough and confirmed with something. */
export function resetConfirmCanSubmit(password: string, confirmPassword: string): boolean {
  return password.length >= 8 && confirmPassword.length > 0;
}
