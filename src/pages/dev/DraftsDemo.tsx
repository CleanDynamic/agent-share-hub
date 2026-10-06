/* UI-P46 — /dev/kit/pages/drafts?theme=noon|dusk&viewport=desktop|mobile.

   `DraftsView` with the sample data, inside the frame `KitPages` draws. No board
   is compared. */

import { draftsViewProps } from "@/dev/fixtures/drafts";
import { DraftsView } from "@/pages/site/drafts/DraftsView";

import type { DesignPageProps } from "./KitPages";

export default function DraftsDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  return <DraftsView fit={fit} {...draftsViewProps(state)} />;
}
