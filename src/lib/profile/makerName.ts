// A maker's name, as a sentence about their build names them (RC-P16b).
//
// One row by id, two columns. The build page asks only when it has to say
// "A build by <maker>" — a build with no outcome — because the record it
// already holds names the maker by id alone.

import { supabase } from "@/integrations/supabase/client";

/** Display name, else @handle, else null. Never throws a name into an error. */
export async function getMakerName(creatorId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", creatorId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getMakerName failed (code ${error.code || "none"})`);
  if (!data) return null;
  return data.display_name?.trim() || (data.username ? `@${data.username}` : null);
}
