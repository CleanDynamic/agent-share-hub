/* UX-10 P3: the profile picture and header flow, shared by the head (Change picture, Change header) and Customise profile
   (Change, Crop, Remove).

   CHOOSE A FILE, upload it with progress, open the post media dialog on it (square and round for a picture, 4:1 for a header,
   ALT kept, no Content warning), and Save writes the URL, the crop and the ALT in one update. Back without saving writes nothing
   and deletes nothing. RECROP opens the dialog on the stored picture: nothing is uploaded, only the crop and ALT are written. A
   refused file is said in a toast and costs no request.

   Data goes through `src/lib/profile/pictures.ts`; this file holds the dialog's state, not a Supabase call. */

import { useRef, useState, type ReactNode } from "react";

import { EditMediaDialog, type PictureSource } from "@/components/post/media/EditMediaDialog";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { useToast } from "@/hooks/use-toast";
import type { MediaCrop } from "@/lib/build/thread";
import { reportError } from "@/lib/errors/report";
import {
  imageSize,
  plainUrl,
  profilePictureRejection,
  PROFILE_PICTURE_ACCEPT,
  removeProfileImage,
  saveProfileImage,
  uploadProfilePicture,
  type ProfileImage,
} from "@/lib/profile/pictures";

export interface StoredPicture {
  url: string;
  crop: MediaCrop | null;
  alt: string | null;
}

export const PICTURE_COPY = {
  changePicture: "Change picture",
  changeHeader: "Change header",
  removePicture: "Remove picture",
  removeHeader: "Remove header",
  cropPicture: "Crop picture",
  cropHeader: "Crop header",
  uploading: (percent: number) => `Uploading ${percent}%`,
  failed: "Could not save the picture",
} as const;

/** The data functions the flow calls; the tests hand in their own. */
export interface PictureWriters {
  upload: typeof uploadProfilePicture;
  save: typeof saveProfileImage;
  remove: typeof removeProfileImage;
  size: typeof imageSize;
}

const WRITERS: PictureWriters = { upload: uploadProfilePicture, save: saveProfileImage, remove: removeProfileImage, size: imageSize };

interface Editing {
  which: ProfileImage;
  source: PictureSource;
  /** The URL Save writes: the new upload, or the stored file on a recrop. */
  url: string;
}

export interface ProfilePictures {
  /** Opens the file chooser for the picture or the header. */
  change: (which: ProfileImage, returnTo?: HTMLElement | null) => void;
  /** Opens the dialog on the stored picture: nothing is uploaded. */
  recrop: (which: ProfileImage, stored: StoredPicture, returnTo?: HTMLElement | null) => void;
  remove: (which: ProfileImage) => void;
  /** The upload under way, as a whole percent, or null. */
  uploading: { which: ProfileImage; percent: number } | null;
  /** The file input and the dialog, rendered once by the page. */
  element: ReactNode;
}

export function useProfilePictures({ onSaved, writers = WRITERS }: { onSaved: () => void; writers?: PictureWriters }): ProfilePictures {
  const phone = useIsPhone();
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<{ which: ProfileImage; returnTo: HTMLElement | null }>({ which: "avatar", returnTo: null });
  const [uploading, setUploading] = useState<ProfilePictures["uploading"]>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const fail = (error: unknown, title: string = PICTURE_COPY.failed) => {
    reportError(error, { source: "profile", context: "profile pictures" });
    toast({ title, description: error instanceof Error ? error.message : undefined, variant: "destructive" });
  };

  const change = (which: ProfileImage, returnTo: HTMLElement | null = null) => {
    pending.current = { which, returnTo };
    input.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const { which, returnTo } = pending.current;
    const refused = profilePictureRejection(file);
    if (refused) {
      toast({ title: refused, variant: "destructive" });
      return;
    }
    setUploading({ which, percent: 0 });
    try {
      const uploaded = await writers.upload(file, which, (percent) => setUploading({ which, percent }));
      setEditing({ which, url: uploaded.url, source: { still: uploaded.url, width: uploaded.width, height: uploaded.height, crop: null, alt: "", returnTo } });
    } catch (error) {
      fail(error);
    } finally {
      setUploading(null);
    }
  };

  const recrop = async (which: ProfileImage, stored: StoredPicture, returnTo: HTMLElement | null = null) => {
    const url = plainUrl(stored.url);
    const size = await writers.size(url);
    setEditing({ which, url, source: { still: url, width: size.width, height: size.height, crop: stored.crop, alt: stored.alt ?? "", returnTo } });
  };

  const remove = async (which: ProfileImage) => {
    setEditing(null);
    try {
      await writers.remove(which);
      onSaved();
    } catch (error) {
      fail(error);
    }
  };

  const element = (
    <>
      <input
        ref={input}
        type="file"
        accept={PROFILE_PICTURE_ACCEPT}
        hidden
        data-testid="profile-picture-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onFile(file);
        }}
      />
      <EditMediaDialog
        request={null}
        editor={null}
        phone={phone}
        picture={editing?.source ?? null}
        aspects={editing?.which === "banner" ? ["header"] : ["square"]}
        round={editing?.which !== "banner"}
        showWarning={false}
        onClose={() => setEditing(null)}
        onSave={(edit) => {
          const now = editing;
          if (!now) return;
          void writers
            .save(now.which, { url: now.url, crop: edit.crop, alt: edit.alt })
            .then(onSaved)
            .catch((error) => fail(error));
        }}
        remove={
          editing
            ? {
                label: editing.which === "banner" ? PICTURE_COPY.removeHeader : PICTURE_COPY.removePicture,
                onRemove: () => void remove(editing.which),
              }
            : undefined
        }
      />
    </>
  );

  return { change, recrop: (which, stored, returnTo) => void recrop(which, stored, returnTo), remove: (which) => void remove(which), uploading, element };
}
