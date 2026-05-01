import { supabase } from "@/integrations/supabase/client";
import { rowToCollection, type Collection, type CollectionRow } from "./types";

export interface UpdateCollectionPatch {
  name?: string;
  description?: string | null;
  accentColor?: string;
  isPrivate?: boolean;
}

export async function updateCollection(
  collectionId: string,
  patch: UpdateCollectionPatch
): Promise<Collection> {
  const update: Record<string, any> = {};
  if (patch.name !== undefined) update.title = patch.name.trim();
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.accentColor !== undefined) update.accent_color = patch.accentColor;
  if (patch.isPrivate !== undefined) {
    update.is_public = !patch.isPrivate;
    update.visibility = patch.isPrivate ? "private" : "public";
  }
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("collections")
    .update(update as any)
    .eq("id", collectionId)
    .select(
      "id, owner_id, title, description, accent_color, is_default, is_public, visibility, slug, follower_count, item_count, created_at, updated_at"
    )
    .single();
  if (error) throw error;

  return rowToCollection(data as unknown as CollectionRow);
}

export async function deleteCollection(collectionId: string): Promise<void> {
  // Refuse to delete the default "Saved items" collection.
  const { data: row, error: getErr } = await supabase
    .from("collections")
    .select("is_default")
    .eq("id", collectionId)
    .maybeSingle();
  if (getErr) throw getErr;
  if ((row as any)?.is_default) {
    throw new Error("Cannot delete the default Saved items collection");
  }

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", collectionId);
  if (error) throw error;
}
