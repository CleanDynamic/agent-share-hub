import { supabase } from "@/integrations/supabase/client";

/**
 * Decides where a freshly authenticated user should land:
 *  - /onboarding/profile — first-time OAuth user with no display name / username
 *  - /onboarding         — profile set but interests onboarding not done
 *  - /                   — fully set up (home)
 */
export async function resolvePostAuthRoute(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, username, user_interests")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return "/";

  if (!data.display_name || !data.username) {
    return "/onboarding/profile";
  }

  const interests = (data.user_interests as string[] | null) ?? [];
  if (interests.length === 0) {
    return "/onboarding";
  }

  return "/";
}
