/**
 * What the sign-in dialog says when the auth service refuses. Every refusal is read by its code (the message only
 * where the client library gives no code) into one of a few kinds, and each kind has one sentence of ours. Server text
 * is never shown.
 */
export type AuthRefusal = "captcha" | "credentials" | "unknown";

interface AuthErrorLike {
  code?: string;
  message?: string;
}

export function refusalOf(error: AuthErrorLike | null | undefined): AuthRefusal {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();
  if (code === "captcha_failed" || message.includes("captcha")) return "captcha";
  // G12: an unconfirmed email is refused in the same words as a wrong password, so sign-in never says an address exists.
  if (code === "invalid_credentials" || code === "email_not_confirmed") return "credentials";
  if (message.includes("invalid login credentials") || message.includes("email not confirmed")) return "credentials";
  return "unknown";
}

export const AUTH_MESSAGES: Record<AuthRefusal, string> = {
  captcha: "Couldn't verify this request. Try again.",
  credentials: "That email or password isn't right.",
  unknown: "Something went wrong. Please try again.",
};

export function messageFor(refusal: AuthRefusal): string {
  return AUTH_MESSAGES[refusal];
}
