/* UI-P47 — /dev/kit/pages/compose?theme=noon|dusk&viewport=desktop|mobile.

   `ComposeView` with the sample draft, inside the frame `KitPages` draws.
   `?state=empty` is the new-draft screen. No board is compared. */

import { composeViewProps } from "@/dev/fixtures/compose";
import { ComposeView } from "@/pages/site/compose/ComposeView";

import type { DesignPageProps } from "./KitPages";

export default function ComposeDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  return <ComposeView fit={fit} {...composeViewProps(state)} />;
}
