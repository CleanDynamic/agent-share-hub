// Mobile prompt 29b: one fixed frame. At 390 x 844 the top bar sits at the same place on Home, Builds, OpenBuilds and Activity;
// the page (not a box inside it) scrolls; and the desktop footer is not drawn.
// Run: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/phone/phone-fixed-frame-29b --project=desktop

import { expect, test } from "@playwright/test";

import { installPhoneStub } from "./support/phoneStub";

const PAGES = ["/", "/builds", "/openbuilds", "/notifications"] as const;

test.describe("phone fixed frame at 390 x 844", () => {
  test.beforeEach(async ({ page }) => {
    await installPhoneStub(page);
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("the top bar's top edge is identical on Home, Builds, OpenBuilds and Activity", async ({ page }) => {
    const tops: number[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      const bar = page.getByTestId("phone-top-bar");
      await expect(bar).toBeVisible();
      tops.push((await bar.boundingBox())!.y);
      expect((await bar.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(new Set(tops).size).toBe(1);
  });

  test("the page is the scroller and nothing in the frame scrolls on its own", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.getByTestId("phone-top-bar")).toBeVisible();
      const inner = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-testid=site-frame], [data-testid=site-frame] *")]
          .filter((el) => /^(auto|scroll)$/.test(getComputedStyle(el).overflowY) && !el.closest("[role=dialog]"))
          .filter((el) => el.scrollHeight > el.clientHeight + 1)
          .map((el) => el.tagName + (el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}]` : "")),
      );
      expect(inner, path).toEqual([]);
    }
    await page.goto("/");
    await expect(page.locator("[data-feed-post]").first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollTop)).toBeGreaterThan(0);
  });

  test("the desktop footer is not drawn", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.getByTestId("phone-top-bar")).toBeVisible();
      await expect(page.getByTestId("site-footer")).toHaveCount(0);
    }
  });
});
