import { supabase } from "@/integrations/supabase/client";

/**
 * Reorder items in a collection. `itemIdsInOrder` is the list of
 * collection_items.id values in their new top-to-bottom order.
 *
 * Issued as parallel updates; Postgres applies them atomically per row.
 */
export async function reorderCollectionItems(
  collectionId: string,
  itemIdsInOrder: string[]
): Promise<void> {
  if (itemIdsInOrder.length === 0) return;

  await Promise.all(
    itemIdsInOrder.map((id, index) =>
      supabase
        .from("collection_items")
        .update({ position: index } as any)
        .eq("id", id)
        .eq("collection_id", collectionId)
    )
  );

  await supabase
    .from("collections")
    .update({ updated_at: new Date().toISOString() } as any)
    .eq("id", collectionId);
}
