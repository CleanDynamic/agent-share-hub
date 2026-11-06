/* Handles for a set of people, by id: one read for the page rather than one per row. A person whose profile is gone, or who has no
   username, maps to null. (The build page's contributors are its only reader.) */

import { supabase } from "@/integrations/supabase/client";

export async function listHandles(ids: readonly string[]): Promise<Map<string, string | null>> {
  const wanted = [...new Set(ids)];
  const handles = new Map<string, string | null>();
  if (wanted.length === 0) return handles;

  const { data, error } = await supabase.from("profiles").select("id, username").in("id", wanted).limit(wanted.length);
  if (error) throw new Error(`listHandles failed: ${error.message}`);

  for (const row of (data ?? []) as Array<{ id: string; username: string | null }>) handles.set(row.id, row.username ?? null);
  return handles;
}
