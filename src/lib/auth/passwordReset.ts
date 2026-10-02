import { supabase } from "@/integrations/supabase/client";

/**
 * Email a link that lets the reader set a new password.
 *
 * True when the request was accepted. The project deliberately does not say
 * whether the address belongs to an account, so a page that shows the same
 * confirmation either way does not leak which emails are registered. A thrown
 * error is a network or server failure.
 */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<boolean> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return !error;
}

/**
 * Set the new password on the recovery session the link opened, then sign that
 * session out, so the reader has to sign in again with the new password.
 *
 * Throws the client's own error when the update is refused, which is why the
 * page can show its message as it is.
 */
export async function setNewPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;

  await supabase.auth.signOut();
}

/**
 * Call `onRecovery` when the client reports a password-recovery session, which
 * is what an implicit-flow link produces without any code of ours running.
 * Returns the function that stops listening.
 */
export function onPasswordRecovery(onRecovery: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") onRecovery();
  });
  return () => data.subscription.unsubscribe();
}
