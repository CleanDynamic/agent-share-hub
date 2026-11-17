// The address a reader signed up with, kept for this tab so "Check your inbox" can name it (sessionStorage,
// `pending_verification_email`). Prompt 9 (G16): it goes as soon as it has no use: when verification completes (the
// session it opens signs the reader in), on sign-out, and when the sign-in dialog closes. Storage can be missing or refuse
// (a private window): every touch is in a try.

export const PENDING_VERIFICATION_KEY = "pending_verification_email";

export function rememberPendingVerification(email: string): void {
  try {
    sessionStorage.setItem(PENDING_VERIFICATION_KEY, email);
  } catch {
    /* storage refused: the view still has the address from the route's state */
  }
}

export function pendingVerificationEmail(): string {
  try {
    return sessionStorage.getItem(PENDING_VERIFICATION_KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetPendingVerification(): void {
  try {
    sessionStorage.removeItem(PENDING_VERIFICATION_KEY);
  } catch {
    /* nothing kept */
  }
}

/** The auth events after which the kept address has no use: a sign-in (verification completing opens one) and a sign-out. */
export function forgetOnAuthEvent(event: string): void {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") forgetPendingVerification();
}
