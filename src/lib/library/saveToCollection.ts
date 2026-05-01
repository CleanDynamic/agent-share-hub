import { supabase } from "@/integrations/supabase/client";
import type { CollectionItemKind, CollectionItemRow } from "./types";

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

/**
 * Snapshot title/slug/cover into cached_meta for resilience and insert.
 */
async function buildCachedMeta(
  itemKind: CollectionItemKind,
  itemId: string
): Promise<Record<string, any>> {
  if (
    itemKind === "blueprint" ||
    itemKind === "blog" ||
    itemKind === "bounty"
  ) {
    const { data } = await supabase
      .from("content_items")
      .select("title, slug, cover_image_url, post_type, creator_id")
      .eq("id", itemId)
      .maybeSingle();
    return {
      title: (data as any)?.title ?? null,
      slug: (data as any)?.slug ?? null,
      cover_image_url: (data as any)?.cover_image_url ?? null,
      post_type: (data as any)?.post_type ?? null,
      creator_id: (data as any)?.creator_id ?? null,
      snapshotted_at: new Date().toISOString(),
    };
  }
  return { snapshotted_at: new Date().toISOString() };
}

export async function saveToCollection(
  collectionId: string,
  itemKind: CollectionItemKind,
  itemId: string
): Promise<CollectionItemRow> {
  const userId = await currentUserId();
  const cachedMeta = await buildCachedMeta(itemKind, itemId);

  // Position = last + 1
  const { data: maxRow } = await supabase
    .from("collection_items")
    .select("position")
    .eq("collection_id", collectionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = ((maxRow as any)?.position ?? -1) + 1;

  const payload: any = {
    collection_id: collectionId,
    item_kind: itemKind,
    item_id: itemId,
    // Maintain the legacy NOT NULL column; safe for content kinds, harmless otherwise.
    content_id: itemId,
    added_by: userId,
    position: nextPos,
    cached_meta: cachedMeta,
  };

  const { data, error } = await supabase
    .from("collection_items")
    .insert(payload)
    .select(
      "id, collection_id, content_id, item_kind, item_id, position, note, added_by, added_at, cached_meta"
    )
    .single();
  if (error) throw error;

  // Bump parent collection's updated_at + item_count.
  await supabase
    .from("collections")
    .update({ updated_at: new Date().toISOString() } as any)
    .eq("id", collectionId);

  return data as unknown as CollectionItemRow;
}

export async function removeFromCollection(
  collectionId: string,
  itemKind: CollectionItemKind,
  itemId: string
): Promise<void> {
  // Match either the new (item_kind/item_id) or legacy (content_id) shape.
  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .or(
      `and(item_kind.eq.${itemKind},item_id.eq.${itemId}),and(item_kind.is.null,content_id.eq.${itemId})`
    );
  if (error) throw error;

  await supabase
    .from("collections")
    .update({ updated_at: new Date().toISOString() } as any)
    .eq("id", collectionId);
}
