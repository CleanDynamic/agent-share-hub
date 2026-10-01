// Tier 1 — UI-P28, the Gallery in the site frame.
//
// IT NEEDS NO AUTH AND NO DATA, like home-site-frame.spec.ts: whatever the
// gallery query returns (rows, nothing, or a refused read), the page owes the
// visitor the frame, one h1, the four lenses, the three facet groups on desktop
// or the Filters sheet on a phone, and a page that does not move sideways at any
// width the frame supports. The address is the gallery's state, so the spec also
// walks it: a lens is written to the URL and read back.
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

  test("has one h1 and the four lenses", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Builds worth running" })).toBeVisible();
    for (const lens of ["All", "Proven", "Rebuilt", "Unsolved"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${lens}`) }).first()).toBeVisible();
    }
  });

  test("writes the lens to the address and reads it back", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: /^Proven/ }).first().click();
    await expect(page).toHaveURL(/\/gallery\?lens=proven$/);
    await expect(page.getByRole("button", { name: /^Proven/ }).first()).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(page.getByTestId("gallery-view")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Proven/ }).first()).toHaveAttribute("aria-pressed", "true");
  });

  test("offers the facets: three groups on desktop, a Filters sheet on a phone", async ({ page }) => {
    await open(page);
    if (isPhone(page)) {
      await page.getByRole("button", { name: /^Filters/ }).click();
      const sheet = page.getByRole("dialog", { name: "Filters" });
      await expect(sheet).toBeVisible();
      for (const label of ["Made for", "Made with", "Shape"]) await expect(sheet.getByText(label)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
    } else {
      for (const group of ["made-for", "made-with", "shape"]) {
        await expect(page.getByTestId(`gallery-facets-${group}`)).toBeVisible();
      }
    }
  });

  test("tidies an address it cannot read, and keeps one it can", async ({ page }) => {
    await open(page, undefined, "noon", "/gallery?frame=site&lens=trending&shape=toaster");
    await expect(page).toHaveURL(/\/gallery$/);
    await page.goto("/gallery?shape=agent");
    await expect(page.getByTestId("gallery-view")).toBeVisible();
    await expect(page).toHaveURL(/\/gallery\?shape=agent$/);
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
