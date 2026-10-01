/* UI-P29 — /dev/kit/pages/build?theme=noon|dusk&viewport=desktop|mobile.

   `BuildView` in `board` fit with the sample data, inside the frame `KitPages`
   draws. The compare harness photographs this against `design/reference/…/build.html`.

   THE PHONE BOARD IS DRAWN A LITTLE DIFFERENTLY FROM THE DESKTOP ONE, in sample
   content only: a shorter outcome, a credit that names the source alone, the
   part's text without its last sentence, four of the five events and no
   completeness block. `buildFixture` takes the viewport. */

import { buildFixture } from "@/dev/fixtures/build";
import { BuildView } from "@/pages/site/build/BuildView";

import type { DesignPageProps } from "./KitPages";

export default function BuildDemo({ fit = "board", viewport }: DesignPageProps) {
  return <BuildView fit={fit} {...buildFixture(viewport)} />;
}
