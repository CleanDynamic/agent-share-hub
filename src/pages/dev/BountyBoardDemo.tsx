/* UI-P37 — /dev/kit/pages/bounty-board?theme=noon|dusk&viewport=desktop|mobile&state=…

   `BountiesView` with the sample data, in the frame `KitPages` draws. Not in `design/reference/index.json` (the board's
   own compare is UI-P33's), so `audit:design` never reaches it; it is here to read the four states. */

import { bountiesFixture } from "@/dev/fixtures/bounties";
import { BountiesView } from "@/pages/site/bounties/BountiesView";

import type { DesignPageProps } from "./KitPages";

export default function BountyBoardDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  return <BountiesView fit={fit} {...bountiesFixture(state)} />;
}
