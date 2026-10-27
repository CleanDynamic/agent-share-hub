// Tier 1: Builds in the site frame (SV-11; was UI-P28's Gallery spec).
//
// IT NEEDS NO AUTH AND NO DATA: whatever the builds read returns (rows, nothing, or a refused read), the page owes the
// visitor the frame, one h1, the view switch, the filter column, and a page that does not move sideways at any width the
// frame supports. The address is the page's state, so the spec also walks it: a view is written to the URL and read
// back, and the old /gallery address lands on /builds.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["noon", "dusk"] as const;
const SWEEP = [390, 768, 1024, 1280, 1440];

async function open(page: Page, viewport?: number, theme: (typeof THEMES)[number] = "noon", path = "/builds?frame=site") {
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
  // The page, or its loading state while the read is out: both draw the head, the switch and the filter column.
  await expect(page.locator('main#main [data-testid="builds-page"], main#main [data-testid="builds-loading"]').first()).toBeVisible();
}

test.describe("/builds in the site frame", () => {
  test("draws one h1, the view switch and the filters inside <main>", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const views = page.getByRole("navigation", { name: "View" });
    for (const name of ["Table", "Maps", "Classification"]) await expect(views.getByRole("link", { name })).toBeVisible();
    await expect(views.getByRole("link", { name: "Table" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("complementary", { name: "Filters" })).toBeVisible();
  });

  test("writes the view to the address and reads it back", async ({ page }) => {
    await open(page);
    await page.getByRole("navigation", { name: "View" }).getByRole("link", { name: "Maps" }).click();
    await expect(page).toHaveURL(/\/builds\?(.*&)?view=maps$/);
    await page.reload();
    await expect(page.getByRole("navigation", { name: "View" }).getByRole("link", { name: "Maps" })).toHaveAttribute("aria-current", "page");
  });

  test("sends the old Gallery address to Builds, keeping its search", async ({ page }) => {
    await page.goto("/gallery?frame=site&lens=proven");
    await expect(page).toHaveURL(/\/builds\?.*lens=proven/);
  });
});

test.describe("no horizontal scroll", () => {
  for (const theme of THEMES) {
    for (const viewport of SWEEP) {
      test(`/builds at ${viewport}px on ${theme}`, async ({ page }) => {
        await open(page, viewport, theme);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});
