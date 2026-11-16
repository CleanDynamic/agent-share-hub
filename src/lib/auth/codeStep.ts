// Part A, G2 and G7: the sign-in's code step.
//
// After a correct password, a member with a verified authenticator holds an aal1 session that the database (G3) treats
// as signed in to public data only. The dialog then asks for a code; a right one raises the session to aal2. Leaving
// the step (Back to sign in, closing the dialog, five wrong codes) signs that aal1 session out of this browser.
//
// Kept apart from mfa.ts so the dialog's host, mounted on every page, imports only the client.

import { supabase } from "@/integrations/supabase/client";

/** G7: wrong codes in a row before the attempt ends. */
export const MAX_CODE_TRIES = 5;

const TRIES_KEY = "ob-code-tries";

function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/**
 * The authenticator to ask for, when this session still owes a code: it is aal1 and the member has a verified factor.
 * Null otherwise, including for every member with no factor (G6) and for a session already at aal2.
 */
export async function pendingCodeFactor(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data || data.currentLevel !== "aal1" || data.nextLevel !== "aal2") return null;
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return factors?.totp?.find((factor) => factor.status === "verified")?.id ?? null;
}

/** Wrong codes so far in this attempt. Kept for the tab, so a reload does not start the count again. */
export function wrongTries(): number {
  return safely(() => Number(sessionStorage.getItem(TRIES_KEY) ?? "0") || 0, 0);
}

/** Count one wrong code; the new count. */
export function recordWrongTry(): number {
  const next = wrongTries() + 1;
  safely(() => sessionStorage.setItem(TRIES_KEY, String(next)), undefined);
  return next;
}

export function clearTries(): void {
  safely(() => sessionStorage.removeItem(TRIES_KEY), undefined);
}

/** End the code step: the aal1 session is signed out of this browser, and the count starts again. */
export async function abandonCodeStep(): Promise<void> {
  clearTries();
  await supabase.auth.signOut({ scope: "local" });
}
