import { supabase } from "@/integrations/supabase/client";
import type { OAuthProvider } from "@/components/auth/OAuthButtons";

import { safeReturnPath } from "./safeReturnPath";

// Supabase provider IDs. "X" is registered with Supabase as "twitter".
const SUPABASE_PROVIDER: Record<OAuthProvider, "google" | "github" | "twitter"> = {
  google: "google",
  github: "github",
  x: "twitter",
};

/**
 * Starts an OAuth sign-in. On success the browser is redirected to the
 * provider and then back to /auth/callback. Returns an error message if the
 * redirect could not be started, otherwise null.
 *
 * G18: `returnTo`, when there is one, rides to the callback as `redirect`, through safeReturnPath; the callback checks
 * it again on the way back.
 */
export async function startOAuthSignIn(provider: OAuthProvider, returnTo: string | null = null): Promise<string | null> {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("provider", provider);
  if (returnTo !== null) callback.searchParams.set("redirect", safeReturnPath(returnTo));
  const { error } = await supabase.auth.signInWithOAuth({
    provider: SUPABASE_PROVIDER[provider],
    options: {
      redirectTo: callback.toString(),
    },
  });

  if (error) {
    return `Couldn't connect to ${provider}. Please try again.`;
  }
  return null;
}
