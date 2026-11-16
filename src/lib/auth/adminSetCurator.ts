import { supabase } from "@/integrations/supabase/client";

type SetCuratorRpc = (fn: "admin_set_curator", args: { _user_id: string; _value: boolean }) => PromiseLike<{ error: { message: string } | null }>;

/**
 * Make someone a curator, or stop them being one (security step 0).
 *
 * The flag changes only through the database function admin_set_curator, which checks is_admin for the caller from
 * the token and writes one admin_audit row. A direct update of profiles.is_curator is refused by the database. The
 * function is not in the generated types yet, so the call is typed here, once.
 */
export async function adminSetCurator(userId: string, value: boolean): Promise<void> {
  const rpc = supabase.rpc.bind(supabase) as unknown as SetCuratorRpc;
  const { error } = await rpc("admin_set_curator", { _user_id: userId, _value: value });
  if (error) throw new Error(error.message);
}
