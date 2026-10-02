/* UI-P28 — /dev/kit/pages/gallery?theme=noon|dusk&viewport=desktop|mobile.

   `GalleryView` in `board` fit with the sample data, inside the frame `KitPages`
   draws. The compare harness photographs this against `design/reference/…/gallery.html`.

   THE PHONE BOARD IS DRAWN A LITTLE DIFFERENTLY FROM THE DESKTOP ONE, in sample
   content only: its Filters button reads "Filters · 2" (two facets applied), its
   featured outcome is the shorter sentence, and its fourth and fifth cards swap. */

import { galleryFixture } from "@/dev/fixtures/gallery";
import { GalleryView } from "@/pages/site/gallery/GalleryView";

import type { DesignPageProps } from "./KitPages";

const PHONE_OUTCOME = "Drafts a first reply to every ticket in the house tone. Never sends on its own.";

export default function GalleryDemo({ fit = "board", viewport, state = "populated" }: DesignPageProps) {
  const sample = galleryFixture(state);
  if (viewport !== "mobile" || state !== "populated") return <GalleryView fit={fit} {...sample} />;

  const cards = [...sample.wall.cards];
  [cards[3], cards[4]] = [cards[4], cards[3]];
  return (
    <GalleryView
      fit={fit}
      {...sample}
      appliedCount={2}
      featured={sample.featured && { ...sample.featured, outcome: PHONE_OUTCOME }}
      wall={{ ...sample.wall, cards }}
    />
  );
}
