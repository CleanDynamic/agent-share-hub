// Tier 1 — UI-P20, the site frame behind the flag, proved on /notifications.
//
// THE FLAG IS NEVER TURNED ON IN DATA. The spec uses the development override,
// `?frame=site` (src/lib/shell/flags.ts), which only exists in a dev build and
// holds for the browser session; the `site_frame` row stays off. With the
// override absent every other tier-1 spec renders the frame it always did.
//
// IT SIGNS IN THE WAY TIER 2 DOES: /notifications is behind ProtectedRoute, so
// the Supabase stub from tier 2 injects an unexpired session and answers
// PostgREST and the realtime socket locally. Nothing here reaches the network.
//
// ONE SPEC, TWO PROJECTS. Desktop (1440) draws the site header, the breadcrumb
// and the footer; mobile (Pixel 7, 412) draws the phone header and the dock and
// none of the desktop chrome.

import { expect, test, type Page } from "@playwright/test";
import { installSupabaseStub, notificationsSeed } from "../tier2/support/supabaseStub";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

async function open(page: Page, path = "/notifications?frame=site") {
  await installSupabaseStub(page, notificationsSeed());
  await page.goto(path);
  await expect(page.getByTestId("site-frame")).toBeVisible();
}

test.describe("/notifications in the site frame", () => {
  test("draws the frame's chrome for the viewport", async ({ page }) => {
    await open(page);

    if (isPhone(page)) {
      await expect(page.getByTestId("mobile-header")).toBeVisible();
      await expect(page.getByTestId("dock")).toBeVisible();
      await expect(page.getByTestId("site-header")).toHaveCount(0);
      await expect(page.getByTestId("site-footer")).toHaveCount(0);
      await expect(page.getByTestId("breadcrumb")).toHaveCount(0);
    } else {
      await expect(page.getByTestId("site-header")).toBeVisible();
      await expect(page.getByTestId("site-footer")).toBeVisible();
      await expect(page.getByTestId("dock")).toHaveCount(0);
      await expect(page.getByTestId("mobile-header")).toHaveCount(0);
      await expect(page.getByTestId("breadcrumb")).toHaveText(/^Home\s*\/\s*Activity$/);
    }
  });

  test("the page's own content renders inside <main>", async ({ page }) => {
    await open(page);
    await expect(page.locator("main#main").getByText("Today", { exact: true })).toBeVisible();
  });

  test("marks Activity as the current page", async ({ page }) => {
    await open(page);
    const current = isPhone(page)
      ? page.getByTestId("dock-tile-activity")
      : page.getByTestId("site-header").getByRole("link", { name: /^Activity/ });
    await expect(current).toHaveAttribute("aria-current", "page");
  });

  test("the skip link is the first focusable element and targets main", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toHaveAttribute("href", "#main");
  });

  test('"/" focuses the header search (desktop)', async ({ page }) => {
    test.skip(isPhone(page), "the search field is a sheet on a phone");
    await open(page);
    await page.locator("body").click({ position: { x: 4, y: 400 } });
    await page.keyboard.press("/");
    await expect(page.getByTestId("site-header").getByRole("searchbox", { name: "Search builds" })).toBeFocused();
  });

  test("the phone's Search button opens the search sheet", async ({ page }) => {
    test.skip(!isPhone(page), "desktop has the header field");
    await open(page);
    await page.getByRole("button", { name: "Search" }).click();
    const sheet = page.getByRole("dialog", { name: "Search" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("searchbox", { name: "Search builds" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });
});

test.describe("no horizontal scroll", () => {
  for (const width of [390, 768, 960, 1024, 1180, 1280, 1440]) {
    test(`/notifications at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
