/* UI-P27 — /dev/kit/pages/home?theme=noon|dusk&viewport=desktop|mobile.

   `HomeView` in `board` fit with the sample data, inside the frame `KitPages`
   draws. The compare harness photographs this against `design/reference/…/home.html`.

   THE PHONE BOARD DRAWS FOUR ROWS and the desktop board five, so the phone gets
   the first four of the sample's five. */

import { homeFixture } from "@/dev/fixtures/home";
import { HomeView } from "@/pages/site/home/HomeView";

import type { DesignPageProps } from "./KitPages";

const PHONE_ROWS = 4;

export default function HomeDemo({ fit = "board", viewport }: DesignPageProps) {
  const sample = homeFixture();
  const feed = viewport === "mobile" ? { ...sample.feed, rows: sample.feed.rows.slice(0, PHONE_ROWS) } : sample.feed;
  return <HomeView fit={fit} {...sample} feed={feed} />;
}
