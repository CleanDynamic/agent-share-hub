import { supabase } from "@/integrations/supabase/client";
import { rowToCollection, type Collection, type CollectionRow } from "./types";

export interface CreateCollectionInput {
  ownerId: string;
  name: string;
  description?: string | null;
  accentColor?: string;
  isPrivate?: boolean;
}

export async function createCollection({
  ownerId,
  name,
  description = null,
  accentColor = "#9CA3AF",
  isPrivate = true,
}: CreateCollectionInput): Promise<Collection> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) throw new Error("Collection name is required");

  const payload: any = {
    owner_id: ownerId,
    title: trimmed,
    description,
    accent_color: accentColor,
    is_public: !isPrivate,
    visibility: isPrivate ? "private" : "public",
    is_default: false,
  };

  const { data, error } = await supabase
    .from("collections")
    .insert(payload)
    .select(
      "id, owner_id, title, description, accent_color, is_default, is_public, visibility, slug, follower_count, item_count, created_at, updated_at"
    )
    .single();
  if (error) throw error;

  return rowToCollection(data as unknown as CollectionRow);
}
