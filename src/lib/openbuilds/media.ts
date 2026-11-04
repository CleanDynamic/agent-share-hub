// Media on a topic or a reply (UX-04): the private build-media bucket, under its own prefix.
//
// No bucket of its own. An object goes to build-media at entries/<author id>/<uuid>.<ext>, which the policies of
// 20261107168000_ux04_entry_media.sql allow for its author, and the attachment records the path. Pictures are read through signedMediaUrl
// (src/lib/build/media.ts) as every build-media object is: pass { bucket: ENTRY_MEDIA_BUCKET, path, kind }.

import { supabase } from "@/integrations/supabase/client";
import { BUILD_MEDIA_BUCKET } from "@/lib/build/media";
import { currentUserId } from "@/lib/social/types";
import { PostError, signedOut } from "./types";

export const ENTRY_MEDIA_BUCKET = BUILD_MEDIA_BUCKET;
export const ENTRY_MEDIA_PREFIX = "entries";

/** The path a new object of the author's goes to. */
export const entryMediaPath = (authorId: string, extension: string): string =>
  `${ENTRY_MEDIA_PREFIX}/${authorId}/${crypto.randomUUID()}.${extension.replace(/^\./, "").toLowerCase() || "bin"}`;

const kindOf = (mime: string): "image" | "video" | "file" => (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "file");

export interface UploadedEntryMedia {
  path: string;
  mediaKind: "image" | "video" | "file";
}

/** Upload one file as the signed-in user. The result is what an attachment of kind media carries. */
export async function uploadEntryMedia(file: File): Promise<UploadedEntryMedia> {
  const userId = await currentUserId();
  if (!userId) throw signedOut("uploadEntryMedia");
  const extension = file.name.includes(".") ? (file.name.split(".").pop() ?? "") : "";
  const path = entryMediaPath(userId, extension);
  const { error } = await supabase.storage.from(ENTRY_MEDIA_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new PostError("uploadEntryMedia", "uploadEntryMedia failed", null, null);
  return { path, mediaKind: kindOf(file.type) };
}

/** UX-05: signed addresses for the pictures and files on a page of posts, one per path, started together. A failed one is left out. */
export async function signEntryMedia(items: readonly { path: string; mediaKind: "image" | "video" | "file" }[], width = 640): Promise<Map<string, string>> {
  const { signedMediaUrl } = await import("@/lib/build/media");
  const unique = [...new Map(items.map((item) => [item.path, item])).values()];
  const signed = await Promise.all(
    unique.map(async (item) => {
      try {
        return [item.path, await signedMediaUrl({ bucket: ENTRY_MEDIA_BUCKET, path: item.path, kind: item.mediaKind }, { width })] as const;
      } catch {
        return null;
      }
    }),
  );
  return new Map(signed.filter((entry): entry is readonly [string, string] => entry !== null));
}
