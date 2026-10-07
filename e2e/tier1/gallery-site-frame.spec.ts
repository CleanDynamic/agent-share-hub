// Tier 1 — UI-P28, the Gallery in the site frame.
//
// IT NEEDS NO AUTH AND NO DATA, like home-site-frame.spec.ts: whatever the
// gallery query returns (rows, nothing, or a refused read), the page owes the
// visitor the frame, one h1, the feed's controls (the Feed | Dashboard switch
// and three menus on desktop, three chips opening sheets on a phone), and a page
// that does not move sideways at any width the frame supports. The address is
// the gallery's state, so the spec also walks it: a view is written to the URL
// and read back.
//
// UI-P49 changed the page on purpose: the lens row, the stats and the facet
// column are gone, so their assertions are replaced by the feed's.
//
// RUNS WITH THE DEV OVERRIDE. `?frame=site` forces the new frame for the browser
// session (src/lib/shell/flags.ts); the `site_frame` row stays off. The page
// tidies the address, which drops the parameter — the override is held in
// sessionStorage, so the frame stays.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["noon", "dusk"] as const;
const SWEEP = [390, 768, 1024, 1280, 1440];

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

async function open(page: Page, viewport?: number, theme: (typeof THEMES)[number] = "noon", path = "/gallery?frame=site") {
  await page.addInitScript((choice) => {
    try {
      window.localStorage.setItem("bg-theme", choice);
    } catch {
      /* private window: the default theme is a fine fallback for a layout check */
    }
  }, theme);
  if (viewport) await page.setViewportSize({ width: viewport, height: 900 });
  await page.goto(path);
  await expect(page.getByTestId("site-frame")).toBeVisible();
  await expect(page.getByTestId("gallery-view")).toBeVisible();
}

test.describe("/gallery in the site frame", () => {
  test("draws the frame's chrome and the Gallery inside <main>", async ({ page }) => {
    await open(page);
    if (isPhone(page)) {
      await expect(page.getByTestId("mobile-header")).toBeVisible();
      await expect(page.getByTestId("dock")).toBeVisible();
    } else {
      await expect(page.getByTestId("site-header")).toBeVisible();
      await expect(page.getByTestId("breadcrumb")).toHaveText(/^Home\s*\/\s*Gallery$/);
    }
    await expect(page.locator("main#main").getByTestId("gallery-view")).toBeVisible();
  });

  test("has one h1, Gallery, and the feed's controls", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Gallery" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search the gallery" })).toBeVisible();
    for (const menu of ["model", "for", "sort"]) await expect(page.getByTestId(`feed-menu-${menu}`)).toBeVisible();
  });

  test("writes the view to the address and reads it back; a phone has no switch", async ({ page }) => {
    await open(page);
    const switcher = page.getByRole("radiogroup", { name: "Gallery view" });
    if (isPhone(page)) {
      await expect(switcher).toHaveCount(0);
      return;
    }
    await switcher.getByRole("radio", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/gallery\?view=dashboard$/);
    await page.reload();
    // UI-P50: the address now reads back as the dashboard, not the feed.
    await expect(page.getByTestId("gallery-dashboard")).toBeVisible();
    await expect(switcher.getByRole("radio", { name: "Dashboard" })).toHaveAttribute("aria-checked", "true");
  });

  test("offers the sort: a dropdown on desktop, a sheet on a phone", async ({ page }) => {
    await open(page);
    await page.getByTestId("feed-menu-sort").click();
    if (isPhone(page)) {
      const sheet = page.getByRole("dialog", { name: "Sort" });
      await expect(sheet).toBeVisible();
      await sheet.getByRole("menuitemradio", { name: /^Most rebuilt/ }).click();
    } else {
      await page.getByRole("menuitemradio", { name: /^Most rebuilt/ }).click();
    }
    await expect(page).toHaveURL(/\/gallery\?sort=rebuilt$/);
  });

  test("tidies an address it cannot read, and keeps one it can", async ({ page }) => {
    await open(page, undefined, "noon", "/gallery?frame=site&lens=trending&shape=toaster&model=gpt-9");
    await expect(page).toHaveURL(/\/gallery$/);
    await page.goto("/gallery?model=sonnet-5-5&sort=confirmed");
    await expect(page.getByTestId("gallery-view")).toBeVisible();
    await expect(page).toHaveURL(/\/gallery\?model=sonnet-5-5&sort=confirmed$/);
  });
});

test.describe("no horizontal scroll", () => {
  for (const theme of THEMES) {
    for (const viewport of SWEEP) {
      test(`/gallery at ${viewport}px on ${theme}`, async ({ page }) => {
        await open(page, viewport, theme);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});
