/**
 * What the sign-in dialog says when the auth service refuses. Every refusal is read by its code (the message only
 * where the client library gives no code) into one of a few kinds, and each kind has one sentence of ours. Server text
 * is never shown.
 */
export type AuthRefusal = "captcha" | "unconfirmed" | "credentials" | "unknown";

interface AuthErrorLike {
  code?: string;
  message?: string;
}

export function refusalOf(error: AuthErrorLike | null | undefined): AuthRefusal {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();
  if (code === "captcha_failed" || message.includes("captcha")) return "captcha";
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) return "unconfirmed";
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "credentials";
  return "unknown";
}

export const AUTH_MESSAGES: Record<AuthRefusal, string> = {
  captcha: "Couldn't verify this request. Try again.",
  unconfirmed: "Please verify your email before signing in — check your inbox.",
  credentials: "Wrong email or password",
  unknown: "Something went wrong. Please try again.",
};

export function messageFor(refusal: AuthRefusal): string {
  return AUTH_MESSAGES[refusal];
}
