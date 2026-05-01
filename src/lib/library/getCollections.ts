import { supabase } from "@/integrations/supabase/client";
import { resolveSavedItems } from "./resolveItems";
import type {
  CollectionItemKind,
  CollectionPreview,
  CollectionRow,
  CollectionSort,
  CoverItem,
} from "./types";

export interface GetCollectionsArgs {
  userId: string;
  viewerId?: string | null;
  query?: string;
  sort?: CollectionSort;
  limit?: number;
  offset?: number;
}

export interface GetCollectionsResult {
  collections: CollectionPreview[];
  total: number;
}

const COLLECTION_COLUMNS =
  "id, owner_id, title, description, accent_color, is_default, is_public, visibility, slug, follower_count, item_count, created_at, updated_at";

export async function getCollections({
  userId,
  viewerId = null,
  query,
  sort = "recent",
  limit = 25,
  offset = 0,
}: GetCollectionsArgs): Promise<GetCollectionsResult> {
  let q = supabase
    .from("collections")
    .select(COLLECTION_COLUMNS, { count: "exact" })
    .eq("owner_id", userId);

  if (viewerId !== userId) q = q.eq("is_public", true);
  if (query && query.trim()) q = q.ilike("title", `%${query.trim()}%`);

  if (sort === "alphabetical") q = q.order("title", { ascending: true });
  else if (sort === "items") q = q.order("item_count", { ascending: false });
  else q = q.order("updated_at", { ascending: false });

  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as CollectionRow[];

  // Fetch up to 4 most-recent items per collection (in one query).
  const coverItemsByCollection = new Map<string, CoverItem[]>();
  if (rows.length) {
    const { data: items } = await supabase
      .from("collection_items")
      .select(
        "collection_id, item_kind, item_id, content_id, cached_meta, added_at"
      )
      .in(
        "collection_id",
        rows.map((r) => r.id)
      )
      .order("added_at", { ascending: false });

    type Ref = { kind: CollectionItemKind; id: string };
    const refs: Ref[] = [];
    const grouped: Record<string, any[]> = {};
    for (const it of (items ?? []) as any[]) {
      const arr = (grouped[it.collection_id] ??= []);
      if (arr.length >= 4) continue;
      const kind = (it.item_kind ?? "blueprint") as CollectionItemKind;
      const id = it.item_id ?? it.content_id;
      if (!id) continue;
      arr.push({ ...it, _kind: kind, _id: id });
      refs.push({ kind, id });
    }

    const resolved = await resolveSavedItems(refs);
    for (const cid of Object.keys(grouped)) {
      coverItemsByCollection.set(
        cid,
        grouped[cid].map((it) => {
          const r = resolved.get(`${it._kind}:${it._id}`);
          const cached = (it.cached_meta ?? {}) as any;
          return {
            kind: it._kind as CollectionItemKind,
            id: it._id as string,
            title: r?.title ?? cached.title ?? null,
            cover_image_url:
              r?.cover_image_url ?? cached.cover_image_url ?? null,
          };
        })
      );
    }
  }

  const collections: CollectionPreview[] = rows.map((r) => ({
    id: r.id,
    name: r.title,
    accentColor: r.accent_color,
    isPrivate: !r.is_public,
    isDefault: r.is_default,
    itemCount: r.item_count,
    lastUpdatedAt: r.updated_at,
    coverItems: coverItemsByCollection.get(r.id) ?? [],
  }));

  return { collections, total: count ?? collections.length };
}
