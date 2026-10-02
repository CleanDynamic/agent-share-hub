// UI-P35a — the picture each build on a page of notifications leads with.
//
// ONE REQUEST for every build a page names, however many rows name it, read
// through the gallery card's own select and embedded caps (gallerySelect and
// withCardEmbeds) and resolved by resolveCover — so the thumbnail beside a
// notification is the picture the build's card leads with, never a fourth
// answer. It is the arrangement whereNext.ts uses for Home's thumbnails.
//
// A build the reader cannot read is absent, as it is from
// resolveNotificationBuilds: row-level security decides. A build with no picture
// maps to null, and the page draws CoverFallback seeded by its id.
//
// A separate read from getNotifications on purpose: the rows, their actors and
// their builds stay three requests, and a thumbnail that is slow or refused
// costs a picture, never the list.

import { supabase } from "@/integrations/supabase/client";
import { resolveCover } from "@/lib/build/cover";
import { gallerySelect, toGalleryBuild, withCardEmbeds, type GalleryMedia, type GalleryRow } from "@/lib/build/gallery";
import { buildLayerError } from "@/lib/build/types";

/** Each named build's cover media row, or null when it has none. */
export async function resolveNotificationCovers(
  buildIds: readonly string[]
): Promise<Map<string, GalleryMedia | null>> {
  const ids = [...new Set(buildIds.filter((id) => typeof id === "string" && id.length > 0))];
  const out = new Map<string, GalleryMedia | null>();
  if (ids.length === 0) return out;

  const { data, error } = await withCardEmbeds(
    supabase.from("builds").select(gallerySelect(false)).in("id", ids).limit(ids.length)
  );
  if (error) throw buildLayerError("resolveNotificationCovers", error);

  for (const row of (data ?? []) as unknown as GalleryRow[]) {
    const card = toGalleryBuild(row);
    out.set(card.id, resolveCover(card, card.nodes, card.media));
  }
  return out;
}
