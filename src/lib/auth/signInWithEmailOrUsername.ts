import { supabase } from "@/integrations/supabase/client";

/** How a password sign-in ended. The page words each refusal; this says which one it was. */
export type EmailSignInResult =
  | { outcome: "signed-in"; userId: string | null }
  | { outcome: "unknown-username" | "email-not-confirmed" | "rejected" };

/**
 * Sign in with an email or a username, and a password.
 *
 * An identifier with no "@" is a username and is resolved to its email by the
 * `get_email_by_username` function first; anything else is the email, trimmed.
 * A username that resolves to nothing is refused here, before the password is
 * tried, and says the same as a wrong password to the page, so the form never
 * tells a stranger which usernames exist.
 *
 * A network or server failure is thrown, not returned: the page has one
 * sentence for "something went wrong" and one try/catch to say it.
 */
export async function signInWithEmailOrUsername(identifier: string, password: string): Promise<EmailSignInResult> {
  let email = identifier.trim();

  if (!email.includes("@")) {
    const { data: resolved, error } = await supabase.rpc("get_email_by_username", { _username: email });
    if (error || !resolved) return { outcome: "unknown-username" };
    email = resolved;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { outcome: error.message.toLowerCase().includes("email not confirmed") ? "email-not-confirmed" : "rejected" };
  }

  return { outcome: "signed-in", userId: data.user ? data.user.id : null };
}
