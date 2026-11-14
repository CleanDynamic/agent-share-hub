import { supabase } from "@/integrations/supabase/client";

export interface UsernameAvailabilityResult {
  available: boolean;
  /** A free variant to offer when the requested username is taken. */
  suggestion?: string;
  /** G13: the check could not be made. The name is not available until it can be. */
  checkFailed?: true;
}

const USERNAME_PATTERN = /^[a-z0-9_]+$/;

/**
 * Checks whether a username is free. The profiles table is world-readable
 * (RLS: "Profiles are viewable by everyone"), so this is a direct query.
 */
export async function checkUsernameAvailability(
  rawUsername: string,
): Promise<UsernameAvailabilityResult> {
  const username = rawUsername.trim().toLowerCase();

  if (username.length < 3 || !USERNAME_PATTERN.test(username)) {
    return { available: false };
  }

  // G13: fail closed. A query that errors or throws is "couldn't check", never "available".
  let found: { data: unknown; error: unknown };
  try {
    found = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  } catch {
    return { available: false, checkFailed: true };
  }
  const { data, error } = found;
  if (error) return { available: false, checkFailed: true };
  if (!data) return { available: true };

  return { available: false, suggestion: suggestUsername(username) };
}

function suggestUsername(username: string): string {
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${username}${suffix}`;
}
