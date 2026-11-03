// Tier 1 — UX-01 P10, the build page's loading shape matches the page.
//
// The skeleton draws the steps layout (tabs, step rows, What you need); a build with steps then replaces it. The layout shift across
// that change, summed over the page's life, stays under 0.1. (The old skeleton, Anatomy and Watch it get built, measures the same
// here: the page's crossfade hides the jump from this metric, so this test guards the number and the unit test guards the shape.) The record is held back so the skeleton is on screen first.

import { expect, test, type Page } from "@playwright/test";

import { SLUG, stubBuild } from "./support/buildPageStub";

const shiftsOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cls: number }).__cls);

for (const [name, size] of [["desktop", { width: 1400, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
  test(`${name}: the skeleton to the page of a build with steps shifts less than 0.1`, async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await stubBuild(page, { heroKind: "image", delayBuildMs: 1200 });
    await page.setViewportSize(size);
    await page.goto(`/b2/${SLUG}`);
    await expect(page.getByTestId("build-steps-loading")).toBeVisible();
    await expect(page.getByTestId("build-need-loading")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("build-loading")).toHaveCount(0);
    await page.waitForTimeout(800);
    const cls = await shiftsOf(page);
    console.log(`${name}: CLS ${cls.toFixed(4)}`);
    expect(cls).toBeLessThan(0.1);
  });
}
