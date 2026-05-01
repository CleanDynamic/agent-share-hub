import { supabase } from "@/integrations/supabase/client";
import { resolveSavedItems } from "./resolveItems";
import {
  rowToCollection,
  type Collection,
  type CollectionItemKind,
  type CollectionItemRow,
  type CollectionRow,
  type SavedItem,
  type SavedItemSort,
} from "./types";

export interface GetCollectionDetailArgs {
  collectionId: string;
  viewerId?: string | null;
  typeFilter?: CollectionItemKind | "all";
  sort?: SavedItemSort | "manual";
  limit?: number;
  offset?: number;
}

export interface GetCollectionDetailResult {
  collection: Collection;
  items: SavedItem[];
  total: number;
  isOwnCollection: boolean;
}

export async function getCollectionDetail({
  collectionId,
  viewerId = null,
  typeFilter = "all",
  sort = "manual",
  limit = 100,
  offset = 0,
}: GetCollectionDetailArgs): Promise<GetCollectionDetailResult> {
  const { data: colRow, error: colErr } = await supabase
    .from("collections")
    .select(
      "id, owner_id, title, description, accent_color, is_default, is_public, visibility, slug, follower_count, item_count, created_at, updated_at"
    )
    .eq("id", collectionId)
    .single();
  if (colErr) throw colErr;
  const collection = rowToCollection(colRow as unknown as CollectionRow);
  const isOwnCollection = !!viewerId && viewerId === collection.ownerId;

  if (collection.isPrivate && !isOwnCollection) {
    throw new Error("Collection is private");
  }

  let q = supabase
    .from("collection_items")
    .select(
      "id, collection_id, content_id, item_kind, item_id, position, note, added_by, added_at, cached_meta",
      { count: "exact" }
    )
    .eq("collection_id", collectionId);

  if (typeFilter !== "all") {
    if (typeFilter === "blueprint") {
      q = q.or(`item_kind.eq.blueprint,item_kind.is.null`);
    } else {
      q = q.eq("item_kind", typeFilter);
    }
  }

  if (sort === "recent") q = q.order("added_at", { ascending: false });
  else if (sort === "oldest") q = q.order("added_at", { ascending: true });
  else if (sort === "alphabetical") q = q.order("added_at", { ascending: false });
  else q = q.order("position", { ascending: true }); // manual

  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as CollectionItemRow[];

  const refs = rows
    .map((r) => {
      const kind = (r.item_kind ?? "blueprint") as CollectionItemKind;
      const id = r.item_id ?? r.content_id;
      return id ? { kind, id } : null;
    })
    .filter((x): x is { kind: CollectionItemKind; id: string } => !!x);
  const resolved = await resolveSavedItems(refs);

  let items: SavedItem[] = rows
    .map((r) => {
      const kind = (r.item_kind ?? "blueprint") as CollectionItemKind;
      const id = r.item_id ?? r.content_id;
      if (!id) return null;
      const display = resolved.get(`${kind}:${id}`);
      const cached = (r.cached_meta ?? {}) as any;
      return {
        collectionItemId: r.id,
        kind,
        id,
        title: display?.title ?? cached.title ?? null,
        slug: display?.slug ?? cached.slug ?? null,
        cover_image_url:
          display?.cover_image_url ?? cached.cover_image_url ?? null,
        author: display?.author ?? null,
        stats: display?.stats ?? null,
        addedAt: r.added_at,
        position: r.position,
        inCollections: [{ id: collection.id, name: collection.name }],
        cached_meta: r.cached_meta,
      } as SavedItem;
    })
    .filter((x): x is SavedItem => !!x);

  if (sort === "alphabetical") {
    items = items.sort((a, b) =>
      (a.title ?? "").localeCompare(b.title ?? "")
    );
  }

  return {
    collection,
    items,
    total: count ?? items.length,
    isOwnCollection,
  };
}
