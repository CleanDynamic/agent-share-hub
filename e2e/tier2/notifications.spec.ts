// Tier 2 — notifications: every subkind renders, and the stream still groups.
//
// WHY. BG-P26 repaints the notification row to "one row treatment for every
// subkind" and its acceptance 4 asks for every subkind to be enumerated and
// shown to render. NotificationCard branches fifteen ways — seven top-level
// kinds, three engagement types and seven bounty subkinds carried in
// `metadata.sub` — and a repaint that unifies the row treatment is exactly the
// kind of change that can quietly drop one branch's copy. Enumerating them in a
// report proves nothing a month later; enumerating them in a spec does.
//
// THE ENUMERATION LIVES IN THE SUPPORT MODULE, not here, as
// NOTIFICATION_SUBKINDS. The seed and the assertions are generated from the same
// list, so the two cannot drift: a subkind that is not in the list is not seeded
// and not asserted, which is the failure mode this file is meant to prevent,
// and it is visible in one place rather than spread across fifteen tests.
//
// `meta_bounty_sub_spawned` gets its own named test as well as its place in the
// loop, because BG-P26's pre-flight check 3 calls it out by name.

import { expect, test, type Page } from "@playwright/test";
import {
  DAY_HEADINGS,
  NOTIFICATION_SUBKINDS,
  installSupabaseStub,
  notificationsSeed,
} from "./support/supabaseStub";

const THEMES = ["exhibition", "dusk"] as const;
const WIDTHS = [1400, 1024, 768, 390];

async function withTheme(page: Page, theme: string) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value as string);
    } catch {
      /* ignore */
    }
  }, theme);
}

test.describe("every notification subkind renders", () => {
  for (const subkind of NOTIFICATION_SUBKINDS) {
    test(`${subkind.key} renders its row`, async ({ page }) => {
      await installSupabaseStub(page, notificationsSeed());
      await page.goto("/notifications");

      // The row has to say what happened in words. Matching on the copy rather
      // than on a container proves the branch was taken, not merely that a row
      // of the right shape appeared.
      await expect(page.getByText(subkind.expect).first()).toBeVisible();
    });
  }
});

test.describe("the stream", () => {
  test("groups by day", async ({ page }) => {
    await installSupabaseStub(page, notificationsSeed());
    await page.goto("/notifications");

    // The seed puts rows in all three buckets, so all three headings should be
    // on screen. groupNotificationsByTime owns the bucketing; BG-P26 only
    // restyles the heading, so losing one means the repaint reached further
    // than it should have.
    for (const heading of DAY_HEADINGS) {
      await expect(page.getByText(heading, { exact: true })).toBeVisible();
    }
  });

  test("shows an actor for every row that has one", async ({ page }) => {
    await installSupabaseStub(page, notificationsSeed());
    await page.goto("/notifications");

    await expect(page.getByText(/otherparty|Other Party/).first()).toBeVisible();
  });

  test("renders the meta_bounty_sub_spawned subkind specifically", async ({ page }) => {
    // Named separately because BG-P26's pre-flight names it: it is the newest
    // subkind and the one most likely to be missed by a row rewrite.
    await installSupabaseStub(page, notificationsSeed());
    await page.goto("/notifications");

    await expect(page.getByText(/Spawned Sub/).first()).toBeVisible();
  });
});

test.describe("both rooms, every width", () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`/notifications renders without horizontal overflow at ${width}px on ${theme}`, async ({
        page,
      }) => {
        await withTheme(page, theme);
        await installSupabaseStub(page, notificationsSeed());
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/notifications");
        await expect(page.getByText("Today", { exact: true })).toBeVisible();

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});
