import type { EmailOtpType } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/** What an emailed link carried: a token hash, a PKCE code, or neither (an implicit-flow hash the client reads itself). */
export interface EmailLink {
  tokenHash: string;
  code: string;
  /** What the token is for: "recovery" for a reset link, "email" or "signup" for a confirmation. */
  type: EmailOtpType;
}

/** Polls for a session the client may be establishing from the URL: 20 looks, 200ms apart. */
const SESSION_LOOKS = 20;
const SESSION_LOOK_MS = 200;

/**
 * Turn an emailed link into a session. True when there is one.
 *
 * The three ways a project delivers the link, in the order they are tried:
 *  - a token hash is spent with `verifyOtp` and nothing else is tried; a token
 *    works once, so it is never spent twice;
 *  - otherwise the client may already have read a session out of the URL (the
 *    implicit flow), so the session is looked for first, and a PKCE code is
 *    exchanged on the first look that finds none;
 *  - a link that produces nothing within the looks is a dead link.
 *
 * `isCancelled` stops the polling when the page that asked has gone. Anything
 * thrown is a dead link too.
 */
export async function verifyEmailLink(link: EmailLink, isCancelled: () => boolean = () => false): Promise<boolean> {
  try {
    if (link.tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
      if (error) throw error;
      return true;
    }

    for (let look = 0; look < SESSION_LOOKS && !isCancelled(); look++) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return true;

      if (link.code && look === 0) {
        const { error } = await supabase.auth.exchangeCodeForSession(link.code);
        if (!error) return true;
      }

      await new Promise((resolve) => setTimeout(resolve, SESSION_LOOK_MS));
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Send the confirmation email again. True when it went; a refusal is false and
 * the page simply lets the reader try again.
 */
export async function resendSignupEmail(email: string): Promise<boolean> {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  return !error;
}
