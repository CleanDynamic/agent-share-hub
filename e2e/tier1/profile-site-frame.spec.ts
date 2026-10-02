// Tier 1 — UI-P34, the Profile in the site frame.
//
// IT NEEDS NO AUTH AND NO DATA, like home-site-frame.spec.ts. Every REST read
// is answered with no rows, so the handle is nobody's and the page draws its own
// "not found" state; what is asserted is what the page owes every visitor: the frame,
// one h1, a way out, and a page that does not move sideways at any width the
// frame supports. The page itself is compared against the reference boards by
// `npm run audit:design -- --grep "profile"`.
//
// RUNS WITH THE DEV OVERRIDE. `?frame=site` forces the new frame for the browser
// session (src/lib/shell/flags.ts); the `site_frame` row stays off. With it
// absent, /profile/:handle is the legacy page.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["noon", "dusk"] as const;
const SWEEP = [390, 768, 1024, 1280, 1440];
const ADDRESS = "/profile/no-such-maker-ui-p34?frame=site";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

async function open(page: Page, viewport?: number, theme: (typeof THEMES)[number] = "noon") {
  await page.addInitScript((choice) => {
    try {
      window.localStorage.setItem("bg-theme", choice);
    } catch {
      /* private window: the default theme is a fine fallback for a layout check */
    }
  }, theme);
  await page.route(/\/rest\/v1\//, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  if (viewport) await page.setViewportSize({ width: viewport, height: 900 });
  await page.goto(ADDRESS);
  await expect(page.getByTestId("site-frame")).toBeVisible();
}

test.describe("/profile/:handle in the site frame", () => {
  test("draws the frame's chrome around the page", async ({ page }) => {
    await open(page);
    if (isPhone(page)) {
      await expect(page.getByTestId("mobile-header")).toBeVisible();
      await expect(page.getByTestId("dock")).toBeVisible();
    } else {
      await expect(page.getByTestId("site-header")).toBeVisible();
      await expect(page.getByTestId("site-footer")).toBeVisible();
    }
  });

  test("says the profile is not there, with one h1 and a way to the gallery", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Profile not found" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.locator("main#main").getByRole("button", { name: "Back to the gallery" }).click();
    await expect(page).toHaveURL(/\/gallery/);
  });
});

test.describe("no horizontal scroll", () => {
  for (const theme of THEMES) {
    for (const viewport of SWEEP) {
      test(`/profile/:handle at ${viewport}px on ${theme}`, async ({ page }) => {
        await open(page, viewport, theme);
        await expect(page.getByRole("heading", { level: 1, name: "Profile not found" })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});
