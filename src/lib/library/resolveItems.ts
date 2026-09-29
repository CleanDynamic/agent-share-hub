import { supabase } from "@/integrations/supabase/client";
import { gallerySelect, toGalleryBuild, withCardEmbeds, type GalleryBuild, type GalleryRow } from "@/lib/build/gallery";
import { db, socialError, uniqueIds } from "@/lib/social/types";
import type { CollectionItemKind, SavedItem } from "./types";

const CONTENT_KINDS: CollectionItemKind[] = ["blueprint", "blog", "bounty"];

type Resolved = Pick<SavedItem, "title" | "slug" | "cover_image_url" | "author" | "stats" | "build">;

/**
 * RC-P18 — the builds behind a list of collection items, as the gallery's own
 * card reads them: GALLERY_BUILD_COLUMNS and the card's embeds
 * (gallerySelect(false) with withCardEmbeds, as where next and the saved list
 * read theirs), in ONE `.in` request for the whole list ⟦neoscale-performance⟧.
 * A build the reader can no longer read (a draft again, or hidden) is absent.
 * Errors carry the operation, code and status only.
 */
export async function resolveBuildItems(buildIds: readonly string[]): Promise<Map<string, GalleryBuild>> {
  const ids = uniqueIds(buildIds);
  if (ids.length === 0) return new Map();

  const response = await withCardEmbeds(db.from("builds").select(gallerySelect(false)).in("id", ids).limit(ids.length));
  if (response.error) throw socialError("resolveBuildItems", response);

  return new Map(
    ((response.data ?? []) as unknown as GalleryRow[]).map((row) => [row.id, toGalleryBuild(row)]),
  );
}

/**
 * Resolve display data for a list of saved items. Batched per kind: one
 * request for the builds, one for the legacy posts and one for their authors.
 * Returns a map keyed by `${kind}:${id}` -> partial SavedItem fields.
 */
export async function resolveSavedItems(
  refs: { kind: CollectionItemKind; id: string }[]
): Promise<Map<string, Resolved>> {
  const out = new Map<string, Resolved>();
  if (refs.length === 0) return out;

  const byKind: Record<string, Set<string>> = {};
  for (const r of refs) (byKind[r.kind] ??= new Set()).add(r.id);

  // ---- builds (RC-P18)
  const buildIds = Array.from(byKind.build ?? []);
  if (buildIds.length > 0) {
    const builds = await resolveBuildItems(buildIds);
    for (const [id, build] of builds) {
      out.set(`build:${id}`, {
        title: build.title ?? null,
        slug: build.slug,
        cover_image_url: null,
        author: null,
        stats: null,
        build,
      });
    }
  }

  // ---- content_items: blueprint / blog / bounty
  const contentIds = new Set<string>();
  for (const k of CONTENT_KINDS) byKind[k]?.forEach((id) => contentIds.add(id));

  if (contentIds.size > 0) {
    const { data: items } = await supabase
      .from("content_items")
      .select(
        "id, title, slug, cover_image_url, creator_id, avg_rating, view_count, comment_count, post_type"
      )
      .in("id", Array.from(contentIds))
      .limit(contentIds.size);

    const creatorIds = Array.from(
      new Set(((items ?? []) as any[]).map((i) => i.creator_id).filter(Boolean))
    );
    const profileById = new Map<string, any>();
    if (creatorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", creatorIds)
        .limit(creatorIds.length);
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
