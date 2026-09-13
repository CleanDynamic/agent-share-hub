// The thread editor's live preview, split out so compose does not pay for it up
// front.
//
// WHY ITS OWN FILE AND A DEFAULT EXPORT. This is the one place the composer
// touches BG-P09's GalleryCard, and that card brings its shape bodies, the media
// resolver and the signing hook with it — about 19kB of chunk the compose route
// had no reason to fetch before. Compose is the heaviest page in the application
// and the prompt's constraint is that it must not gain weight, so the preview is
// imported with React.lazy from CoverStrip: the editor is interactive on the
// route's own payload, and the card arrives a moment later, which is the right
// order for a surface whose primary ask is the picture and the sentence.
//
// THE REAL CARD, NOT A DRAWING OF ONE. Fed by postEntriesOf over the draft and
// its post rows — the same component, the same resolver and the same thread the
// feed will render. A preview built out of its own markup is a preview that can
// be wrong, and this one cannot: if the card changes, this changes with it.

import { useMemo } from "react";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { cardMedia, useSignedMedia } from "@/components/gallery/cardMedia";
import type { Build, BuildMedia, GalleryBuild, GalleryMedia } from "@/lib/build";

export default function ThreadPreviewCard({
  build,
  rows,
}: {
  build: Build;
  rows: BuildMedia[];
}) {
  /* nodes: [] because the preview is of the POST, and the post is the thread.
     A body that reads nodes renders its own empty branch, which is exactly what
     a reader sees for a build whose record is still only a picture. */
  const previewBuild = useMemo(
    () => ({ ...build, nodes: [], media: rows as unknown as GalleryMedia[] }) as GalleryBuild,
    [build, rows]
  );
  const srcByPath = useSignedMedia(useMemo(() => cardMedia(previewBuild), [previewBuild]));

  return <GalleryCard build={previewBuild} srcByPath={srcByPath} layout="feed" />;
}
