// UX-15 P5: the private-profile switch. It is `profiles.is_private`, the same column the profile reads today
// (`getProfileSummary`, and `profile_reader_view` in the database): this only gives its owner a place to change it.

import { supabase } from "@/integrations/supabase/client";

export async function loadIsPrivate(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("profiles").select("is_private").eq("id", userId).limit(1).maybeSingle();
  if (error) throw error;
  return Boolean((data as { is_private?: boolean | null } | null)?.is_private);
}

export async function setIsPrivate(userId: string, on: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ is_private: on } as never).eq("id", userId);
  if (error) throw error;
}

/** Customise profile opens from this address on the reader's own profile: its `Who sees` group is the other half of privacy. */
export const CUSTOMISE_PROFILE_HREF = "/profile?customise=1";
