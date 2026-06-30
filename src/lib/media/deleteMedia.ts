import { supabase } from "@/integrations/supabase/client";

export type DeleteMediaArgs = {
  bucket: string;
  path: string;
};

/**
 * Removes a single file from a Supabase Storage bucket.
 * Storage RLS decides whether the call succeeds.
 */
export async function deleteMedia({ bucket, path }: DeleteMediaArgs): Promise<void> {
  if (!bucket || !path) return;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
