// Tier 1: UX-01 P4, something paints before the scripts run.
//
// index.html carries a static copy of the site frame's header row and empty surface, for the site routes at desktop width. It is
// there with JavaScript off, it is taken away before first paint on any other path or width, and its surface sits where the
// mounted surface sits, so React replacing it moves nothing.
//
// A static file cannot know the path: with JavaScript off, every path gets the shell on a desktop. So "a path that is not a site
// route shows nothing" is tested with the app's own script held back (the inline script, which is not the app, still runs).

import { expect, test, type Page } from "@playwright/test";

import { fakeThreadBackend } from "./support/postThreadBackend";

const surfaceBox = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  return box;
};
/** In `vite dev` the stylesheet is injected by the app's own script, so the shell has no colours before it: this needs the built bundle (`npm run build`, `vite preview`, E2E_BASE_URL). */
const needsBuilt = async (page: Page) => test.skip((await page.locator('link[rel="stylesheet"]').count()) === 0, "needs the built bundle: the stylesheet is a link only there");
const holdApp = (page: Page) => page.route(/\/(src\/main\.tsx|assets\/index-[^/]+\.js)/, (route) => route.abort());

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  test("/ at 1440 shows the shell: the header row and the surface", async ({ page }) => {
    await page.goto("/");
    await needsBuilt(page);
    const shell = page.locator("#boot-shell");
    await expect(shell).toBeVisible();
    const surface = await surfaceBox(page, "#boot-shell > div:nth-child(2)");
    expect(surface.x).toBeCloseTo(6, 0);
    expect(surface.y).toBe(48);
    expect(surface.width).toBe(1428);
  });
});

test.describe("with JavaScript off, phone width", () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  test("a 390-wide / shows nothing", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#boot-shell")).toBeHidden();
  });
});

test.describe("the inline script", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("/login shows nothing before the app runs", async ({ page }) => {
    await holdApp(page);
    await page.goto("/login");
    await expect(page.locator("#boot-shell")).toHaveCount(0);
  });
  test("a 390-wide / shows nothing before the app runs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await holdApp(page);
    await page.goto("/");
    await expect(page.locator("#boot-shell")).toHaveCount(0);
  });
  test("/ at 1440 keeps the shell until the app mounts", async ({ page }) => {
    await holdApp(page);
    await page.goto("/");
    await expect(page.locator("#boot-shell")).toBeVisible();
  });
});

test("the shell's surface matches the mounted surface within 1 px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await holdApp(page);
  await page.goto("/");
  await needsBuilt(page);
  const shell = await surfaceBox(page, "#boot-shell > div:nth-child(2)");

  const mounted = await page.context().newPage();
  await mounted.setViewportSize({ width: 1440, height: 900 });
  await fakeThreadBackend(mounted);
  await mounted.goto("/");
  await expect(mounted.locator('[data-ui="surface"]')).toBeVisible();
  await expect(mounted.locator("#boot-shell")).toHaveCount(0);
  const live = await surfaceBox(mounted, '[data-ui="surface"]');
  for (const edge of ["x", "y", "width"] as const) expect(Math.abs(shell[edge] - live[edge]), edge).toBeLessThanOrEqual(1);
});
