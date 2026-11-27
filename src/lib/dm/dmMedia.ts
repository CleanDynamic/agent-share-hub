// DM images and voice notes live in private buckets (`dm-images`, `dm-voice`) that only a thread's participants may read.
//
// A message used to store a URL signed for a year, so anyone who once had it (a participant later removed, a forwarded
// link) kept the file for a year. A message now stores a reference to the object, `storage:<bucket>/<path>`, and the
// thread signs it when it draws the message, for a few minutes, as the person looking: the bucket's own rule decides.
// Messages written before this change hold a signed URL; it is read back to its object and signed again the same way.

import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const DM_MEDIA_BUCKETS = ["dm-images", "dm-voice"] as const;
export type DmMediaBucket = (typeof DM_MEDIA_BUCKETS)[number];

/** How long a drawn link lasts. Long enough to look at or play a message, short enough not to be worth keeping. */
export const DM_MEDIA_TTL_SECONDS = 10 * 60;

const PREFIX = "storage:";

export interface DmMediaObject {
  bucket: DmMediaBucket;
  path: string;
}

function isBucket(value: string): value is DmMediaBucket {
  return (DM_MEDIA_BUCKETS as readonly string[]).includes(value);
}

/** What a message stores for an uploaded file. */
export function dmMediaRef(bucket: DmMediaBucket, path: string): string {
  return `${PREFIX}${bucket}/${path}`;
}

/**
 * The object a stored value points at: a `storage:` reference, or a Supabase signed or public URL into one of the DM
 * buckets (messages from before references). Anything else (an outside link, empty) is null and is drawn as it is.
 */
export function parseDmMedia(value: string | null | undefined): DmMediaObject | null {
  if (!value) return null;
  if (value.startsWith(PREFIX)) {
    const rest = value.slice(PREFIX.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return null;
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    return isBucket(bucket) && path ? { bucket, path } : null;
  }
  const match = value.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/?#]+)\/([^?#]+)/);
  if (!match) return null;
  const bucket = decodeURIComponent(match[1]);
  const path = match[2].split("/").map(decodeURIComponent).join("/");
  return isBucket(bucket) && path ? { bucket, path } : null;
}

/** A short-lived link to a message's file, signed as the person looking; the stored value itself when it is not a DM object. */
export function useDmMediaUrl(value: string | null | undefined): string | null {
  const object = parseDmMedia(value);
  const query = useQuery({
    queryKey: ["dm-media", object?.bucket, object?.path],
    enabled: object !== null,
    staleTime: (DM_MEDIA_TTL_SECONDS - 60) * 1000,
    gcTime: DM_MEDIA_TTL_SECONDS * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(object!.bucket).createSignedUrl(object!.path, DM_MEDIA_TTL_SECONDS);
      if (error || !data?.signedUrl) throw error ?? new Error("No signed URL");
      return data.signedUrl;
    },
  });
  if (object === null) return value ?? null;
  return query.data ?? null;
}
