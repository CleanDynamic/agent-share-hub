import { supabase } from "@/integrations/supabase/client";
import type { CollectionItemKind, SavedItem } from "./types";

const CONTENT_KINDS: CollectionItemKind[] = ["blueprint", "blog", "bounty"];

/**
 * Resolve display data for a list of saved items. Batched per kind.
 * Returns a map keyed by `${kind}:${id}` -> partial SavedItem fields.
 */
export async function resolveSavedItems(
  refs: { kind: CollectionItemKind; id: string }[]
): Promise<
  Map<
    string,
    Pick<SavedItem, "title" | "slug" | "cover_image_url" | "author" | "stats">
  >
> {
  const out = new Map<
    string,
    Pick<SavedItem, "title" | "slug" | "cover_image_url" | "author" | "stats">
  >();
  if (refs.length === 0) return out;

  const byKind: Record<string, Set<string>> = {};
  for (const r of refs) (byKind[r.kind] ??= new Set()).add(r.id);

  // ---- content_items: blueprint / blog / bounty
  const contentIds = new Set<string>();
  for (const k of CONTENT_KINDS) byKind[k]?.forEach((id) => contentIds.add(id));

  if (contentIds.size > 0) {
    const { data: items } = await supabase
      .from("content_items")
      .select(
        "id, title, slug, cover_image_url, creator_id, avg_rating, view_count, comment_count, post_type"
      )
      .in("id", Array.from(contentIds));

    const creatorIds = Array.from(
      new Set(((items ?? []) as any[]).map((i) => i.creator_id).filter(Boolean))
    );
    const profileById = new Map<string, any>();
    if (creatorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", creatorIds);
      for (const p of (profs ?? []) as any[]) profileById.set(p.id, p);
    }

    for (const it of (items ?? []) as any[]) {
      const author = it.creator_id
        ? {
            id: it.creator_id as string,
            username: profileById.get(it.creator_id)?.username ?? null,
            display_name:
              profileById.get(it.creator_id)?.display_name ?? null,
            avatar_url: profileById.get(it.creator_id)?.avatar_url ?? null,
          }
        : null;

      const value = {
        title: it.title ?? null,
        slug: it.slug ?? null,
        cover_image_url: it.cover_image_url ?? null,
        author,
        stats: {
          avgRating: Number(it.avg_rating ?? 0),
          viewCount: Number(it.view_count ?? 0),
          commentCount: Number(it.comment_count ?? 0),
        },
      };
      // The same content_item id can be saved as 'blueprint' or 'blog'.
      // Map under whichever kind(s) the caller asked for.
      for (const k of CONTENT_KINDS) {
        if (byKind[k]?.has(it.id)) out.set(`${k}:${it.id}`, value);
      }
    }
  }

  // ---- stage / block: live in content_items.stage_grids JSONB; surface a label.
  for (const k of ["stage", "block"] as const) {
    byKind[k]?.forEach((id) => {
      out.set(`${k}:${id}`, {
        title: k === "stage" ? "Stage" : "Block",
        slug: null,
        cover_image_url: null,
        author: null,
        stats: null,
      });
    });
  }

  return out;
}
