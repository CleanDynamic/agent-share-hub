/**
 * What the sign-in dialog says when the auth service refuses (G14). Every refusal is read by its code (the message
 * only where the client library gives no code) into one of a few kinds, and each kind has one sentence of ours.
 * Server text is never shown; a code we do not know is "Couldn't do that. Try again."
 */
export type AuthRefusal = "captcha" | "credentials" | "rate-limit" | "weak-password" | "same-password" | "invalid-email" | "unknown";

interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

export function refusalOf(error: AuthErrorLike | null | undefined): AuthRefusal {
  if (!error) return "unknown";
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "captcha_failed" || message.includes("captcha")) return "captcha";
  // G12: an unconfirmed email is refused in the same words as a wrong password, so sign-in never says an address exists.
  if (code === "invalid_credentials" || code === "email_not_confirmed") return "credentials";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || error.status === 429) return "rate-limit";
  if (code === "weak_password") return "weak-password";
  if (code === "same_password") return "same-password";
  if (code === "email_address_invalid" || code === "validation_failed") return "invalid-email";
  if (code) return "unknown";
  // No code: the few messages the client library is known to send without one.
  if (message.includes("invalid login credentials") || message.includes("email not confirmed")) return "credentials";
  if (message.includes("rate limit")) return "rate-limit";
  if (message.includes("different from the old password")) return "same-password";
  return "unknown";
}

export const AUTH_MESSAGES: Record<AuthRefusal, string> = {
  captcha: "Couldn't verify this request. Try again.",
  credentials: "That email or password isn't right.",
  "rate-limit": "Too many tries. Wait a minute, then try again.",
  "weak-password": "Choose a stronger password.",
  "same-password": "Choose a password you haven't used before.",
  "invalid-email": "Enter a valid email address.",
  unknown: "Couldn't do that. Try again.",
};

export function messageFor(refusal: AuthRefusal): string {
  return AUTH_MESSAGES[refusal];
}
