import { supabase } from "@/integrations/supabase/client";

import { refusalOf, type AuthRefusal } from "./authMessages";

export interface EmailSignUp {
  email: string;
  password: string;
  displayName: string;
  username: string;
  /** Where the confirmation link in the email lands. */
  emailRedirectTo: string;
  /** The bot-check token (G6); the auth service checks it. */
  captchaToken?: string;
}

/**
 * How a sign-up ended. `signedIn` is true when the project returned a session,
 * which it only does when email verification is off; otherwise the account
 * exists and the reader has to open the link first.
 */
export type EmailSignUpResult =
  | { outcome: "created"; signedIn: boolean }
  | { outcome: "refused"; refusal: AuthRefusal };

/**
 * Create an account with an email and a password.
 *
 * The `handle_new_user` trigger reads `display_name` and `username` from the
 * sign-up metadata, in snake case, so those two keys are not ours to rename.
 * G11: an address that already has an account is answered exactly like a new
 * one waiting for its link, so nothing tells a stranger which addresses are
 * registered. (With email confirmation on, the auth service already does this;
 * the wording check covers a project where it is off.)
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
      captchaToken: input.captchaToken,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    const taken = message.includes("already") && (message.includes("registered") || message.includes("exist"));
    if (taken) return { outcome: "created", signedIn: false };
    return { outcome: "refused", refusal: refusalOf(error) };
  }

  return { outcome: "created", signedIn: Boolean(data.session) };
}
