// Tier 1 — UI-P27, Home in the site frame.
//
// IT NEEDS NO AUTH AND NO DATA, like wide-layout.spec.ts. Signed out, the three
// panels that depend on a person say so in words, whatever the feed returns, so
// what is asserted is what the page owes every visitor: the frame, one h1, the
// two links into the site, the empty states, and a page that does not move
// sideways at any width the frame supports.
//
// RUNS WITH THE DEV OVERRIDE. `?frame=site` forces the new frame for the browser
// session (src/lib/shell/flags.ts); the `site_frame` row stays off. With it
// absent, `/` is the legacy Home and wide-layout.spec.ts measures that.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["noon", "dusk"] as const;
const SWEEP = [390, 768, 1024, 1280, 1440];

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

async function open(page: Page, viewport?: number, theme: (typeof THEMES)[number] = "noon") {
  await page.addInitScript((choice) => {
    try {
      window.localStorage.setItem("bg-theme", choice);
    } catch {
      /* private window: the default theme is a fine fallback for a layout check */
    }
  }, theme);
  if (viewport) await page.setViewportSize({ width: viewport, height: 900 });
  await page.goto("/?frame=site");
  await expect(page.getByTestId("site-frame")).toBeVisible();
  await expect(page.getByTestId("home-view")).toBeVisible();
}

test.describe("/ in the site frame", () => {
  test("draws the frame's chrome and Home's page inside <main>", async ({ page }) => {
    await open(page);
    if (isPhone(page)) {
      await expect(page.getByTestId("mobile-header")).toBeVisible();
      await expect(page.getByTestId("dock")).toBeVisible();
      await expect(page.getByTestId("site-header")).toHaveCount(0);
    } else {
      await expect(page.getByTestId("site-header")).toBeVisible();
      await expect(page.getByTestId("site-footer")).toBeVisible();
      await expect(page.getByTestId("breadcrumb")).toHaveText(/^Home$/);
    }
    await expect(page.locator("main#main").getByTestId("home-view")).toBeVisible();
  });

  test("has one h1, the tagline's sentence, and a way into the gallery", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Every AI build, hung with its proof." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enter the gallery" }).first()).toBeVisible();
  });

  test("signed out, each personal panel says what to do instead of showing a number", async ({ page }) => {
    await open(page);
    await expect(page.getByText("Sign in to take this week's challenges.")).toBeVisible();
    await expect(page.getByText("Run a build today to start a streak.")).toBeVisible();
    await expect(page.getByTestId("weekly-challenge")).toHaveCount(0);
  });

  test("Following asks a signed-out visitor to sign in and come back", async ({ page }) => {
    await open(page);
    await page.getByRole("group", { name: "Whose builds" }).getByRole("button", { name: "Following" }).click();
    await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)/);
  });

  test("Enter the gallery goes to /gallery", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Enter the gallery" }).first().click();
    await expect(page).toHaveURL(/\/gallery/);
  });
});

test.describe("no horizontal scroll", () => {
  for (const theme of THEMES) {
    for (const viewport of SWEEP) {
      test(`/ at ${viewport}px on ${theme}`, async ({ page }) => {
        await open(page, viewport, theme);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});
