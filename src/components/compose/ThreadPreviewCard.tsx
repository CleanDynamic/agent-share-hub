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
import type { Build, BuildMedia, GalleryBuild, GalleryMedia, GalleryNode } from "@/lib/build";

/** Stable, so the memo below is not invalidated by a fresh array each render. */
const NO_NODES: GalleryNode[] = [];

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
  /* THE GENERATED TYPES ARE BEHIND THE SCHEMA for two columns. `builds` has
     source_title_at_fork and source_handle_at_fork — the gallery's own query
     selects them and GalleryBuild requires them — but src/integrations/supabase
     does not know about them yet, which is the same drift ForkAttribution and
     PublishControl already hit. They are read off the row here rather than the
     whole object being cast through `unknown`: the credit is structural on a
     rebuilt card, so the preview of a rebuilt draft has to carry it, and a blind
     cast would also hide a real mismatch in the thirty fields that do line up.
     rebuild_note and rebuild_count drift the same way and are read the same way;
     the count defaults to 0 rather than null because it is a tally, and "no
     rebuilds" is zero of them rather than an unknown. */
  const fork = build as Partial<
    Pick<
      GalleryBuild,
      "source_title_at_fork" | "source_handle_at_fork" | "rebuild_note" | "rebuild_count"
    >
  >;

  const previewBuild = useMemo<GalleryBuild>(
    () => ({
      ...build,
      source_title_at_fork: fork.source_title_at_fork ?? null,
      source_handle_at_fork: fork.source_handle_at_fork ?? null,
      rebuild_note: fork.rebuild_note ?? null,
      rebuild_count: fork.rebuild_count ?? 0,
      nodes: NO_NODES,
      media: rows as unknown as GalleryMedia[],
    }),
    [
      build,
      fork.rebuild_count,
      fork.rebuild_note,
      fork.source_handle_at_fork,
      fork.source_title_at_fork,
      rows,
    ]
  );
  const srcByPath = useSignedMedia(useMemo(() => cardMedia(previewBuild), [previewBuild]));

  return <GalleryCard build={previewBuild} srcByPath={srcByPath} layout="feed" />;
}
