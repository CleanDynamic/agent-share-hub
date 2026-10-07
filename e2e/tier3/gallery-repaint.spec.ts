// Tier 3 — the repainted gallery, repointed by UI-P49 to the feed.
//
// WHY THIS IS A BROWSER SPEC AND NOT A UNIT TEST. Everything asserted here is
// RESOLVED LAYOUT: how wide the feed's column comes out inside the frame at
// four widths in two themes, whether it is centred, whether every row's cover
// is the 2:1 the feed draws, and whether the page scrolls sideways. jsdom has
// no layout engine, so none of it is testable anywhere else.
//
// The BG-P19 grid assertions (column counts, gutters, the facet band, the
// stagger) are gone: UI-P49 replaced the four-column wall and the facet column
// with the one-column feed, so there is no grid left to measure.

import { expect, test, type Page } from "@playwright/test";

import { fakeFeedBackend } from "./support/galleryFeedBackend";

const WIDTHS = [1440, 1100, 1024, 700] as const;
const THEMES = ["noon", "dusk"] as const;

/** Set the theme before first paint, the way index.html's boot script reads it. */
async function withTheme(page: Page, theme: string) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value);
    } catch {
      /* private window — the default theme is a fine ground for a measurement */
    }
  }, theme);
}

const overflowsX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`UI-P49 — one column of at most 680, centred, at ${width} on ${theme}, with no sideways scroll`, async ({ page }) => {
      await withTheme(page, theme);
      await fakeFeedBackend(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/gallery");

      const cards = page.locator('[data-visual-slot="gallery-card"]');
      await expect(cards).toHaveCount(4);

      const boxes = await cards.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map((r) => ({ left: Math.round(r.left), width: Math.round(r.width) })));
      // One column: every card starts at one left edge and is one width.
      expect(new Set(boxes.map((b) => b.left)).size).toBe(1);
      expect(new Set(boxes.map((b) => b.width)).size).toBe(1);
      expect(boxes[0].width).toBeLessThanOrEqual(680);

      // Centred in the frame's column: the heading row spans the same 680 the cards do.
      const column = await page.getByTestId("gallery-view").evaluate((view) => {
        const inner = view.firstElementChild as HTMLElement;
        const outer = view.getBoundingClientRect();
        const box = inner.getBoundingClientRect();
        return { leftGap: Math.round(box.left - outer.left), rightGap: Math.round(outer.right - box.right) };
      });
      expect(Math.abs(column.leftGap - column.rightGap)).toBeLessThanOrEqual(1);

      expect(await overflowsX(page)).toBe(false);
    });
  }
}

test("UI-P49 — every row's cover is 2:1", async ({ page }) => {
  await fakeFeedBackend(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/gallery");

  const covers = page.locator('[data-card-part="cover"]');
  await expect(covers).toHaveCount(4);
  const ratios = await covers.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map((r) => r.width / r.height));
  for (const ratio of ratios) expect(ratio).toBeCloseTo(2, 1);
});

test("UI-P49 — the empty state fits a phone without scrolling sideways", async ({ page }) => {
  await fakeFeedBackend(page, []);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery");

  await expect(page.getByTestId("gallery-empty")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask for it on Bounties" })).toBeVisible();
  expect(await overflowsX(page)).toBe(false);
});
