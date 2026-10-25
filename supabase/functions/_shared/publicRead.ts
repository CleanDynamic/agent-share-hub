// The client for the functions that only read what anybody may read: the
// project's public key, so the database's own rules apply to every query.
// Deno only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function publicClient() {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
}
