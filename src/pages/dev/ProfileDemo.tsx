/* UI-P34 — /dev/kit/pages/profile?theme=noon|dusk&viewport=desktop|mobile.

   `ProfileView` in `board` fit with the sample data, inside the frame `KitPages`
   draws. The compare harness photographs this against
   `design/reference/…/profile.html`.

   THE PHONE BOARD'S BIO IS WORDED A LITTLE DIFFERENTLY ("finance agents a person
   can check", with no "builds"), in sample content only. */

import { profileFixture } from "@/dev/fixtures/profile";
import { ProfileView } from "@/pages/site/profile/ProfileView";

import type { DesignPageProps } from "./KitPages";

const PHONE_BIO = "finance agents a person can check";

export default function ProfileDemo({ fit = "board", viewport, state = "populated" }: DesignPageProps) {
  const sample = profileFixture(state);
  if (viewport !== "mobile" || !sample.maker) return <ProfileView fit={fit} {...sample} />;
  return <ProfileView fit={fit} {...sample} maker={{ ...sample.maker, bio: PHONE_BIO }} />;
}
