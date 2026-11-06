/* UX-10: /dev/kit/pages/profile?theme=noon|dusk&viewport=desktop|mobile&state=…&own=1.

   `ProfileView` with the sample data, inside the frame `KitPages` draws: someone else's profile, or your own with `own=1`. The old
   UI-P34 board is archived (design/reference/archive/), so there is nothing to compare this against. */

import { profileFixture } from "@/dev/fixtures/profile";
import { ProfileView } from "@/pages/site/profile/ProfileView";

import type { DesignPageProps } from "./KitPages";

export default function ProfileDemo({ state = "populated" }: DesignPageProps) {
  const own = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("own") === "1";
  return (
    <div data-design-ready="true">
      <ProfileView {...profileFixture(state, own)} />
    </div>
  );
}
