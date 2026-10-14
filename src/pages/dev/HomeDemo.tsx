/* UI-P27 — /dev/kit/pages/home?theme=noon|dusk&viewport=desktop|mobile.

   `HomeView` in `board` fit with the sample data, inside the frame `KitPages`
   draws. The compare harness photographs this against `design/reference/…/home.html`.

   THE PHONE BOARD DRAWS FOUR ROWS and the desktop board five, so the phone gets
   the first four of the sample's five. */

import { homeFixture } from "@/dev/fixtures/home";
import { useLook } from "@/lib/theme/look";
import { HomeView } from "@/pages/site/home/HomeView";
import { RefinedHomeView } from "@/pages/site/home/RefinedHomeView";

import type { DesignPageProps } from "./KitPages";

const PHONE_ROWS = 4;

export default function HomeDemo({ fit = "board", viewport, state = "populated" }: DesignPageProps) {
  const refined = useLook() === "refined";
  const sample = homeFixture(state);
  const feed = viewport === "mobile" ? { ...sample.feed, rows: sample.feed.rows.slice(0, PHONE_ROWS) } : sample.feed;
  /* UI-P88: `?look=refined` draws the fork, from the same sample. */
  if (refined) return <RefinedHomeView fit={fit} {...sample} feed={feed} />;
  return <HomeView fit={fit} {...sample} feed={feed} />;
}
