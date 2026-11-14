import { supabase } from "@/integrations/supabase/client";

import { refusalOf, type AuthRefusal } from "./authMessages";

/** How a password sign-in ended. The page words each refusal; this says which one it was. */
export type EmailSignInResult =
  | { outcome: "signed-in"; userId: string | null }
  | { outcome: "not-an-email" }
  | { outcome: "refused"; refusal: AuthRefusal };

/**
 * Sign in with an email address and a password (G4: email only).
 *
 * Text with no "@" is not an email address and is refused here, before any request, so nothing ever looks a username
 * up. The captcha token, when there is one, goes straight to the auth service, which is what enforces it.
 *
 * A network or server failure is thrown, not returned: the page has one
 * sentence for "something went wrong" and one try/catch to say it.
 */
export async function signInWithEmail(identifier: string, password: string, captchaToken?: string): Promise<EmailSignInResult> {
  const email = identifier.trim();
  if (!email.includes("@")) return { outcome: "not-an-email" };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });

  if (error) {
    const refusal = refusalOf(error);
    // A refusal with no code we know is still a refusal of the credentials, as before.
    return { outcome: "refused", refusal: refusal === "unknown" ? "credentials" : refusal };
  }

  return { outcome: "signed-in", userId: data.user ? data.user.id : null };
}
