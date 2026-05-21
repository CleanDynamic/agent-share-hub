import { supabase } from "@/integrations/supabase/client";
import type { OAuthProvider } from "@/components/auth/OAuthButtons";

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
 */
export async function startOAuthSignIn(provider: OAuthProvider): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: SUPABASE_PROVIDER[provider],
    options: {
      redirectTo: `${window.location.origin}/auth/callback?provider=${provider}`,
    },
  });

  if (error) {
    return `Couldn't connect to ${provider}. Please try again.`;
  }
  return null;
}
