import { supabase } from "@/integrations/supabase/client";
import { resolveSavedItems } from "./resolveItems";
import type {
  CollectionItemKind,
  CollectionItemRow,
  SavedItem,
  SavedItemSort,
} from "./types";

export interface GetAllSavedItemsArgs {
  userId: string;
  typeFilter?: CollectionItemKind | "all";
  sort?: SavedItemSort;
  limit?: number;
  offset?: number;
}

export interface GetAllSavedItemsResult {
  items: SavedItem[];
  total: number;
}

export async function getAllSavedItems({
  userId,
  typeFilter = "all",
  sort = "recent",
  limit = 50,
  offset = 0,
}: GetAllSavedItemsArgs): Promise<GetAllSavedItemsResult> {
  // Get the user's collections first (so we can both filter and label).
  const { data: cols, error: colsErr } = await supabase
    .from("collections")
    .select("id, title")
    .eq("owner_id", userId);
  if (colsErr) throw colsErr;
  const collectionIds = (cols ?? []).map((c: any) => c.id as string);
  const collectionNameById = new Map<string, string>(
    (cols ?? []).map((c: any) => [c.id, c.title])
  );
  if (collectionIds.length === 0) return { items: [], total: 0 };

  let q = supabase
    .from("collection_items")
    .select(
      "id, collection_id, content_id, item_kind, item_id, position, note, added_by, added_at, cached_meta",
      { count: "exact" }
    )
    .in("collection_id", collectionIds);

  if (typeFilter !== "all") {
    if (typeFilter === "blueprint") {
      // Legacy rows have item_kind=NULL but content_id set.
      q = q.or(`item_kind.eq.blueprint,item_kind.is.null`);
    } else {
      q = q.eq("item_kind", typeFilter);
    }
  }

  if (sort === "alphabetical") q = q.order("added_at", { ascending: false });
  else if (sort === "oldest") q = q.order("added_at", { ascending: true });
  else q = q.order("added_at", { ascending: false });

  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as CollectionItemRow[];

  const refs: { kind: CollectionItemKind; id: string }[] = [];
  for (const r of rows) {
    const kind = (r.item_kind ?? "blueprint") as CollectionItemKind;
    const id = r.item_id ?? r.content_id;
    if (id) refs.push({ kind, id });
  }
  const resolved = await resolveSavedItems(refs);

  // Build a single "in which collections" lookup across all of the user's
  // collections, so each item shows the correct pills.
  const { data: allMembership } = await supabase
    .from("collection_items")
    .select("collection_id, content_id, item_kind, item_id")
    .in("collection_id", collectionIds);
  const membershipByItemKey = new Map<string, Set<string>>();
  for (const m of (allMembership ?? []) as any[]) {
    const k = (m.item_kind ?? "blueprint") as CollectionItemKind;
    const id = m.item_id ?? m.content_id;
    if (!id) continue;
    const key = `${k}:${id}`;
    if (!membershipByItemKey.has(key)) membershipByItemKey.set(key, new Set());
    membershipByItemKey.get(key)!.add(m.collection_id);
  }

  let items: SavedItem[] = rows
    .map((r) => {
      const kind = (r.item_kind ?? "blueprint") as CollectionItemKind;
      const id = r.item_id ?? r.content_id;
      if (!id) return null;
      const display = resolved.get(`${kind}:${id}`);
      const cached = (r.cached_meta ?? {}) as any;
      const inCollectionIds = Array.from(
        membershipByItemKey.get(`${kind}:${id}`) ?? new Set<string>()
      );
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
        inCollections: inCollectionIds.map((cid) => ({
          id: cid,
          name: collectionNameById.get(cid) ?? "Collection",
        })),
        cached_meta: r.cached_meta,
      } as SavedItem;
    })
    .filter((x): x is SavedItem => !!x);

  if (sort === "alphabetical") {
    items = items.sort((a, b) =>
      (a.title ?? "").localeCompare(b.title ?? "")
    );
  }

  return { items, total: count ?? items.length };
}
