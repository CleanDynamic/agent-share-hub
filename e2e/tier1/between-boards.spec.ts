// Tier 1 — UI-P39, the widths between the boards.
//
// ONE BREAKPOINT, ONE SWITCH. `SiteFrameView` alone picks the chrome: at 768 and
// up the desktop header and footer, below it the phone header and dock. The spec
// sets the viewport either side of the line on one page and reads which chrome
// is drawn; it also reads that no page scrolls sideways at the in-between widths.
//
// SIGNED IN THE WAY TIER 2 DOES (see site-frame.spec.ts): /notifications is
// behind ProtectedRoute, and the stub answers everything locally.

import { expect, test, type Page } from "@playwright/test";
import { installSupabaseStub, notificationsSeed } from "../tier2/support/supabaseStub";

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await installSupabaseStub(page, notificationsSeed());
  await page.goto("/notifications?frame=site");
  await expect(page.getByTestId("site-frame")).toBeVisible();
}

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("the chrome switch", () => {
  test("767 is the phone's chrome", async ({ page }) => {
    await open(page, 767);
    await expect(page.getByTestId("site-frame")).toHaveAttribute("data-viewport", "mobile");
    await expect(page.getByTestId("mobile-header")).toBeVisible();
    await expect(page.getByTestId("dock")).toBeVisible();
    await expect(page.getByTestId("site-header")).toHaveCount(0);
    await expect(page.getByTestId("site-footer")).toHaveCount(0);
  });

  test("768 is the desktop's chrome", async ({ page }) => {
    await open(page, 768);
    await expect(page.getByTestId("site-frame")).toHaveAttribute("data-viewport", "desktop");
    await expect(page.getByTestId("site-header")).toBeVisible();
    await expect(page.getByTestId("site-footer")).toBeVisible();
    await expect(page.getByTestId("mobile-header")).toHaveCount(0);
    await expect(page.getByTestId("dock")).toHaveCount(0);
  });

  test("crossing the line swaps the chrome without a reload", async ({ page }) => {
    await open(page, 768);
    await expect(page.getByTestId("site-header")).toBeVisible();
    await page.setViewportSize({ width: 767, height: 900 });
    await expect(page.getByTestId("mobile-header")).toBeVisible();
    await expect(page.getByTestId("site-header")).toHaveCount(0);
  });

  test("the header's search is an icon below 900 that opens the search sheet", async ({ page }) => {
    await open(page, 899);
    await expect(page.getByTestId("site-header").getByRole("search")).toHaveCount(0);
    await page.getByTestId("site-header").getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
  });

  test("New build keeps its accessible name when it loses its label", async ({ page }) => {
    await open(page, 979);
    await expect(page.getByTestId("site-header").getByRole("button", { name: "New build" })).toBeVisible();
  });

  for (const width of [320, 767, 768, 834, 1023, 1024, 1279, 1280, 2560]) {
    test(`nothing scrolls sideways at ${width}`, async ({ page }) => {
      await open(page, width);
      expect(await sideways(page)).toBeLessThanOrEqual(0);
    });
  }
});
