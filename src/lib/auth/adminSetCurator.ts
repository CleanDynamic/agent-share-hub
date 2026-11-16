import { supabase } from "@/integrations/supabase/client";

/**
 * Make someone a curator, or stop them being one (security step 0).
 *
 * The flag changes only through the database function admin_set_curator, which checks is_admin for the caller from
 * the token and writes one admin_audit row. A direct update of profiles.is_curator is refused by the database.
 */
export async function adminSetCurator(userId: string, value: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_set_curator", { _user_id: userId, _value: value });
  if (error) throw new Error(error.message);
}
