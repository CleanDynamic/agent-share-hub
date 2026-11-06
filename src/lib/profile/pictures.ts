// UX-10 P3: a profile's picture and header: upload, save with crop and ALT, and remove.
//
// THE FLOW. Choose a file, upload it with progress (uploadProfilePicture), open the post media dialog on it, and Save writes
// (saveProfileImage). Back writes nothing and deletes nothing. Recrop opens the dialog on the stored picture and writes only its
// crop: the file is never changed or uploaded again.
//
// THE CROP SITE-WIDE. A profile picture is read as `avatar_url` by dozens of reads across the site. Rather than add a column to
// each, the stored URL carries its crop as a fragment, `#crop=x,y,w,h`, which the browser never sends; `Avatar` reads it and
// draws the crop (cropInCell). `avatar_crop` holds the same crop as the record. A header is read only by the profile, which reads
// `banner_crop` itself, so its URL stays plain.

import { supabase } from "@/integrations/supabase/client";
import { mediaKindFor, uploadMedia } from "@/lib/build/media";
import { pictureRejection } from "@/lib/build/postMedia";
import type { MediaCrop } from "@/lib/build/thread";

import { cropFromUrl, plainUrl, urlWithCrop } from "./avatarCrop";

import { altProblem } from "./settings";

export type ProfileImage = "avatar" | "banner";

/** The still pictures a profile takes: no video, and no GIF (a GIF can't be cropped). */
export const PROFILE_PICTURE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/** Why this file cannot be a profile picture or header, or null. pictureRejection's size and type first, then stills only. */
export function profilePictureRejection(file: File): string | null {
  const shared = pictureRejection(file);
  if (shared) return shared;
  if (mediaKindFor(file.type) !== "image" || file.type === "image/gif") {
    return `${file.name || "That file"} is ${file.type || "an unrecognised type"}. A profile picture is a still picture: png, jpg, webp or avif.`;
  }
  return null;
}

export interface UploadedProfilePicture {
  /** The public URL, with no crop. */
  url: string;
  width: number | null;
  height: number | null;
}

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error("Sign in to change your profile.");
  return id;
}

/**
 * Upload a still picture for the profile picture or the header, reporting whole percents. Refused files cost no request. The
 * upload goes through the shared `uploadMedia`, so it runs the same size and type checks, probe and progress as a post's.
 */
export async function uploadProfilePicture(file: File, which: ProfileImage, onPercent: (percent: number) => void): Promise<UploadedProfilePicture> {
  const refused = profilePictureRejection(file);
  if (refused) throw new Error(refused);
  // A picture and a header go to the same place; `which` is the caller's, and says nothing to storage.
  void which;
  const media = await uploadMedia({
    profileId: await myId(),
    file,
    onProgress: (fraction) => onPercent(Math.round(Math.min(1, Math.max(0, fraction)) * 100)),
  });
  return { url: media.url, width: media.width, height: media.height };
}

export { cropFromUrl, plainUrl, urlWithCrop };

const COLUMNS: Record<ProfileImage, { url: string; crop: string; alt: string }> = {
  avatar: { url: "avatar_url", crop: "avatar_crop", alt: "avatar_alt" },
  banner: { url: "banner_url", crop: "banner_crop", alt: "banner_alt" },
};

/** Write the picture or header with its crop and ALT: one update of the reader's own row. */
export async function saveProfileImage(which: ProfileImage, image: { url: string; crop: MediaCrop | null; alt: string }): Promise<void> {
  const problem = altProblem(image.alt);
  if (problem) throw new Error(problem);
  const columns = COLUMNS[which];
  const alt = image.alt.trim();
  const { error } = await supabase
    .from("profiles")
    .update({
      [columns.url]: which === "avatar" ? urlWithCrop(image.url, image.crop) : plainUrl(image.url),
      [columns.crop]: image.crop,
      [columns.alt]: alt || null,
    } as never)
    .eq("id", await myId());
  if (error) throw error;
}

/** Take the picture or header off the profile. The file stays in storage, as a post's does when it leaves a post. */
export async function removeProfileImage(which: ProfileImage): Promise<void> {
  const columns = COLUMNS[which];
  const { error } = await supabase
    .from("profiles")
    .update({ [columns.url]: null, [columns.crop]: null, [columns.alt]: null } as never)
    .eq("id", await myId());
  if (error) throw error;
}

/** A stored picture's pixel size, for recrop: read from the picture itself, since nothing stores it. */
export function imageSize(url: string): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve({ width: null, height: null });
      return;
    }
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null });
    image.onerror = () => resolve({ width: null, height: null });
    image.src = plainUrl(url);
  });
}
