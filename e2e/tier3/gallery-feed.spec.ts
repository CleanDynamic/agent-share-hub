// UI-P49 — the Gallery feed, in a real browser.
//
// One build per row, organised by the model version people reproduced it on.
// THE BACKEND IS FAKED (support/galleryFeedBackend.ts): what is asserted is
// what a reader sees, what the address says, and what the page asks for.

import { expect, test, type Page } from "@playwright/test";

import { fakeFeedBackend } from "./support/galleryFeedBackend";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

async function pickModel(page: Page, name: string) {
  await page.getByTestId("feed-menu-model").click();
  if (isPhone(page)) {
    await page.getByRole("dialog", { name: "Model" }).getByRole("menuitemradio", { name: new RegExp(`^${name}`) }).click();
  } else {
    await page.getByRole("menuitemradio", { name: new RegExp(`^${name}`) }).click();
  }
}

test("picking Sonnet 5.5 splits the list into two sections and the plaques speak for it", async ({ page }) => {
  await fakeFeedBackend(page);
  await page.goto("/gallery");

  const feed = page.getByTestId("gallery-feed");
  await expect(feed.getByRole("heading", { level: 3 })).toHaveCount(4);
  await expect(page.getByTestId("feed-count")).toHaveText("4 builds, newest first");
  // With Any model, the renamer's plaque is its own overall figure.
  const renamer = feed.locator('[data-visual-slot="gallery-card"]', { hasText: "Photo renamer by date taken" });
  await expect(renamer.getByText("11 reproduced")).toBeVisible();

  await pickModel(page, "Sonnet 5.5");
  await expect(page).toHaveURL(/\/gallery\?model=sonnet-5-5$/);

  const on = page.getByTestId("feed-section-reproduced");
  const not = page.getByTestId("feed-section-not-yet");
  await expect(on.getByRole("heading", { level: 2 })).toHaveText("Reproduced on Sonnet 5.5 · 2");
  await expect(not.getByRole("heading", { level: 2 })).toHaveText("Not yet reproduced on Sonnet 5.5 · 2");
  await expect(on.getByRole("heading", { level: 3 })).toHaveText(["Photo renamer by date taken", "Inbox triage for a small shop"]);

  // The same build now speaks for Sonnet 5.5 alone, and the CV has none on it.
  await expect(on.locator('[data-visual-slot="gallery-card"]', { hasText: "Photo renamer" }).getByText("5 reproduced")).toBeVisible();
  await expect(not.locator('[data-visual-slot="gallery-card"]', { hasText: "CV tailored" }).getByText("not yet reproduced")).toBeVisible();
  await expect(page.getByTestId("feed-count")).toHaveText("2 of 4 builds reproduced on Sonnet 5.5, newest first");
});

test("search narrows the list, and Clear all clears it but keeps the sort", async ({ page }) => {
  await fakeFeedBackend(page);
  await page.goto("/gallery?sort=reproduced");
  await expect(page.getByTestId("gallery-feed").getByRole("heading", { level: 3 })).toHaveCount(4);

  await page.getByRole("searchbox", { name: "Search the gallery" }).fill("receipt");
  await expect(page).toHaveURL(/\/gallery\?sort=reproduced&q=receipt$/);
  await expect(page.getByTestId("gallery-feed").getByRole("heading", { level: 3 })).toHaveText(["Receipt photos to an expenses sheet"]);
  await expect(page.getByRole("button", { name: "Remove “receipt”" })).toBeVisible();

  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page).toHaveURL(/\/gallery\?sort=reproduced$/);
  await expect(page.getByRole("searchbox", { name: "Search the gallery" })).toHaveValue("");
  await expect(page.getByTestId("gallery-feed").getByRole("heading", { level: 3 })).toHaveCount(4);
});

test("a search nobody has hung a build for says so, with the way to ask", async ({ page }) => {
  await fakeFeedBackend(page);
  await page.goto("/gallery?q=zzzz");
  await expect(page.getByText("Nobody has hung a build for “zzzz” yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask for it on Bounties" })).toBeVisible();
});

test("Dashboard sets view=dashboard (desktop); on a phone the switch is hidden", async ({ page }) => {
  const backend = await fakeFeedBackend(page);
  await page.goto("/gallery");
  await expect(page.getByTestId("gallery-feed")).toBeVisible();

  const switcher = page.getByRole("radiogroup", { name: "Gallery view" });
  if (isPhone(page)) {
    await expect(switcher).toHaveCount(0);
  } else {
    await switcher.getByRole("radio", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/gallery\?view=dashboard$/);
    await expect(switcher.getByRole("radio", { name: "Dashboard" })).toHaveAttribute("aria-checked", "true");
    // Until UI-P50, the dashboard view is still the feed.
    await expect(page.getByTestId("gallery-feed")).toBeVisible();
  }

  // The page never asks for the stats or the lens counts it no longer shows (both are HEAD counts on builds).
  expect(backend.headCounts).toBe(0);
  expect(backend.buildRequests.length).toBeGreaterThan(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
