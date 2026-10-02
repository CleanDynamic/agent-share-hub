import { supabase } from "@/integrations/supabase/client";

export interface EmailSignUp {
  email: string;
  password: string;
  displayName: string;
  username: string;
  /** Where the confirmation link in the email lands. */
  emailRedirectTo: string;
}

/**
 * How a sign-up ended. `signedIn` is true when the project returned a session,
 * which it only does when email verification is off; otherwise the account
 * exists and the reader has to open the link first.
 */
export type EmailSignUpResult =
  | { outcome: "created"; signedIn: boolean }
  | { outcome: "already-registered" | "refused"; message: string };

/**
 * Create an account with an email and a password.
 *
 * The `handle_new_user` trigger reads `display_name` and `username` from the
 * sign-up metadata, in snake case, so those two keys are not ours to rename.
 * An "already registered" refusal is told apart by its wording, because the
 * client library gives no code for it.
 */
export async function signUpWithEmail(input: EmailSignUp): Promise<EmailSignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        display_name: input.displayName,
        username: input.username,
      },
      emailRedirectTo: input.emailRedirectTo,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    const taken = message.includes("already") && (message.includes("registered") || message.includes("exist"));
    return { outcome: taken ? "already-registered" : "refused", message: error.message };
  }

  return { outcome: "created", signedIn: Boolean(data.session) };
}
